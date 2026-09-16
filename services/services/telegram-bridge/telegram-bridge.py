#!/usr/bin/env python3
"""telegram-bridge — puente mínimo a la Bot API de Telegram.

Responsabilidad única:
  1. Enviar mensajes de Telegram que le llegan por su API HTTP local (POST /send).
  2. Ejecutar comandos genéricos que Luis escribe en el chat (/ping, /help).

No conoce dominio alguno: cualquier proceso local puede mandarle un mensaje
con un curl. Bind SOLO en 127.0.0.1. Los mensajes aceptados (202) se persisten
en una cola SQLite propia y un worker interno los entrega con reintentos, así
una caída de Telegram no pierde mensajes.

Secrets (token, chat_id, secret) llegan por EnvironmentFile de systemd;
nunca se loguean.
"""

import asyncio
import json
import logging
import os
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from telegram import Update
from telegram.error import TelegramError
from telegram.ext import Application, CommandHandler, ContextTypes

# ---------------------------------------------------------------------------
# Configuración (EnvironmentFile de systemd)
# ---------------------------------------------------------------------------

def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)

TELEGRAM_BOT_TOKEN = _env("TELEGRAM_BOT_TOKEN")
CHAT_ID = _env("TELEGRAM_BRIDGE_CHAT_ID")          # chat autorizado (el de Luis)
PORT = int(_env("TELEGRAM_BRIDGE_PORT", "8787"))
SECRET = _env("TELEGRAM_BRIDGE_SECRET")            # opcional, compartido con productores
DB_PATH = Path(os.path.expanduser(
    _env("TELEGRAM_BRIDGE_DB", "~/.local/state/telegram-bridge/bridge.db")
))

# Reintentos del worker interno: backoff exponencial con tope (segundos).
BACKOFF = [5, 15, 60, 300, 600]

log = logging.getLogger("telegram-bridge")

# Estado del bot: el HTTP server responde 503 /send hasta que post_init lo marca listo.
bot_ready = threading.Event()

# ---------------------------------------------------------------------------
# Cola SQLite propia del bridge
# ---------------------------------------------------------------------------

def db() -> sqlite3.Connection:
    """Conexión nueva por operación (cada hilo/tarea la suelta al terminar)."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


def init_db() -> None:
    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id          INTEGER PRIMARY KEY,
                chat_id     TEXT NOT NULL,
                text        TEXT NOT NULL,
                parse_mode  TEXT,
                status      TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed
                attempts    INTEGER NOT NULL DEFAULT 0,
                next_attempt REAL NOT NULL DEFAULT 0,
                created_at  REAL NOT NULL,
                sent_at     REAL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pending ON messages(status, next_attempt)")


def enqueue(chat_id: str, text: str, parse_mode: str | None) -> int:
    now = time.time()
    with db() as conn:
        cur = conn.execute(
            "INSERT INTO messages (chat_id, text, parse_mode, created_at, next_attempt) "
            "VALUES (?, ?, ?, ?, ?)",
            (str(chat_id), text, parse_mode, now, now),
        )
        return cur.lastrowid


def pending_count() -> int:
    with db() as conn:
        (n,) = conn.execute("SELECT COUNT(*) FROM messages WHERE status='pending'").fetchone()
        return n

# ---------------------------------------------------------------------------
# API HTTP local (fase 1) — corre en un hilo aparte del loop de asyncio
# ---------------------------------------------------------------------------

class ApiHandler(BaseHTTPRequestHandler):
    def _reply(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            # Sin autenticar: es local y no expone nada sensible.
            self._reply(200, {"ok": True, "queue": pending_count()})
        else:
            self._reply(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/send":
            self._reply(404, {"ok": False, "error": "not found"})
            return
        if not bot_ready.is_set():
            self._reply(503, {"ok": False, "error": "bot temporalmente caído"})
            return
        if SECRET and self.headers.get("X-Hub-Secret") != SECRET:
            self._reply(401, {"ok": False, "error": "secret inválido"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._reply(400, {"ok": False, "error": "JSON inválido"})
            return

        text = payload.get("text")
        if not text or not isinstance(text, str):
            self._reply(400, {"ok": False, "error": "falta 'text'"})
            return
        chat_id = payload.get("chat_id") or CHAT_ID
        if not chat_id:
            self._reply(400, {"ok": False, "error": "sin chat_id ni TELEGRAM_BRIDGE_CHAT_ID"})
            return
        parse_mode = payload.get("parse_mode")

        msg_id = enqueue(chat_id, text, parse_mode)
        log.info("POST /send aceptado: id=%s chat=%s bytes=%d", msg_id, chat_id, len(text))
        # 202: quedó encolado; la entrega (con reintentos) es responsabilidad del bridge.
        self._reply(202, {"ok": True})

    def log_message(self, fmt: str, *args) -> None:
        # Silenciamos el log por defecto de http.server (logueamos nosotros, sin cuerpos).
        pass


def start_http_server() -> ThreadingHTTPServer:
    # Bind exclusivo a loopback (seguridad).
    server = ThreadingHTTPServer(("127.0.0.1", PORT), ApiHandler)
    threading.Thread(target=server.serve_forever, daemon=True, name="http-api").start()
    log.info("API HTTP escuchando en 127.0.0.1:%d", PORT)
    return server

# ---------------------------------------------------------------------------
# Worker: entrega la cola con reintentos
# ---------------------------------------------------------------------------

async def worker(app: Application) -> None:
    bot = app.bot
    while True:
        row = None
        with db() as conn:
            (row,) = conn.execute(
                "SELECT id, chat_id, text, parse_mode, attempts FROM messages "
                "WHERE status='pending' AND next_attempt <= ? ORDER BY id LIMIT 1",
                (time.time(),),
            ).fetchone() or (None,)

        if row is None:
            await asyncio.sleep(1)
            continue

        msg_id, chat_id, text, parse_mode, attempts = row
        try:
            await bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode)
            with db() as conn:
                conn.execute(
                    "UPDATE messages SET status='sent', sent_at=? WHERE id=?",
                    (time.time(), msg_id),
                )
            log.info("entregado: id=%s chat=%s intento=%d", msg_id, chat_id, attempts + 1)
        except TelegramError as e:
            delay = BACKOFF[min(attempts, len(BACKOFF) - 1)]
            with db() as conn:
                conn.execute(
                    "UPDATE messages SET attempts=attempts+1, next_attempt=? WHERE id=?",
                    (time.time() + delay, msg_id),
                )
            log.warning("fallo entrega id=%s (intento %d): %s — reintento en %ds",
                        msg_id, attempts + 1, type(e).__name__, delay)
        except Exception:
            # Error inesperado: no marcar nada, reintentar más tarde.
            log.exception("error inesperado en worker, reintento en 30s")
            await asyncio.sleep(30)

# ---------------------------------------------------------------------------
# Comandos (fase 2) — solo el chat autorizado
# ---------------------------------------------------------------------------

def authorized(update: Update) -> bool:
    if not CHAT_ID:
        return False  # bot privado: sin chat configurado no responde a nadie
    return str(update.effective_chat.id) == str(CHAT_ID)


async def cmd_ping(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update):
        log.warning("comando /ping de chat no autorizado: %s", update.effective_chat.id)
        return
    await update.message.reply_text("pong")


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update):
        log.warning("comando /help de chat no autorizado: %s", update.effective_chat.id)
        return
    await update.message.reply_text(
        "telegram-bridge — comandos:\n"
        "/ping → pong (diagnóstico)\n"
        "/help → esta ayuda\n\n"
        "Enviar mensajes: POST http://127.0.0.1:%d/send "
        'con {"text": "..."}' % PORT
    )

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def check_env() -> None:
    missing = [n for n in ("TELEGRAM_BOT_TOKEN",) if not _env(n)]
    if missing:
        raise SystemExit(
            "Faltan variables de entorno obligatorias: %s "
            "(ver ~/.config/telegram-bridge/telegram-bridge.env)" % ", ".join(missing)
        )


async def post_init(app: Application) -> None:
    me = await app.bot.get_me()
    log.info("bot iniciado como @%s (chat autorizado: %s)", me.username or me.id, CHAT_ID or "NINGUNO")
    bot_ready.set()
    app.create_task(worker(app))


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    check_env()
    init_db()

    app = (
        Application.builder()
        .token(TELEGRAM_BOT_TOKEN)
        .post_init(post_init)
        .build()
    )
    app.add_handler(CommandHandler("ping", cmd_ping))
    app.add_handler(CommandHandler("help", cmd_help))

    start_http_server()
    log.info("cola en %s — arrancando long polling", DB_PATH)
    # run_polling gestiona SIGTERM/SIGINT (systemd stop) con shutdown limpio.
    app.run_polling(allowed_updates=["message"])


if __name__ == "__main__":
    main()
