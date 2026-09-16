# telegram-bridge (nativo, no Docker)

Puente mínimo a la Bot API de Telegram. **Responsabilidad única**: enviar
mensajes que le llegan por su API HTTP local, y ejecutar comandos genéricos
que Luis escribe en el chat. No conoce dominio alguno (ni mail, ni CV, ni otras
bases de datos): el acoplamiento con cualquier productor es exclusivamente la
API HTTP. Espeo de diseño: `SPEC.md` (junto a este README).

## Archivos

| Archivo | Destino (stow) | Qué es |
|---------|----------------|--------|
| `services/telegram-bridge/telegram-bridge.py` | `~/services/telegram-bridge/telegram-bridge.py` | daemon (Python + python-telegram-bot) |
| `services/telegram-bridge/SPEC.md` | `~/services/telegram-bridge/SPEC.md` | espejo de diseño |
| `services/telegram-bridge/README.md` | `~/services/telegram-bridge/README.md` | este README |
| `.config/systemd/user/telegram-bridge.service` | `~/.config/systemd/user/telegram-bridge.service` | unidad systemd user |

Estado (cola SQLite, no va al repo): `~/.local/state/telegram-bridge/bridge.db`
Secretos (no versionados): `~/.config/telegram-bridge/telegram-bridge.env`

## Instalación en una máquina nueva

```bash
sudo pacman -S python-telegram-bot          # desde AUR vía paru si no está en repos
cd ~/dotfiles && stow -R services

mkdir -p ~/.config/telegram-bridge
cat > ~/.config/telegram-bridge/telegram-bridge.env <<'EOF'
TELEGRAM_BOT_TOKEN=<token del bot>
TELEGRAM_BRIDGE_CHAT_ID=<chat_id de Luis>
TELEGRAM_BRIDGE_PORT=8787
# TELEGRAM_BRIDGE_SECRET=<opcional, compartido con los productores>
# TELEGRAM_BRIDGE_DB=~/.local/state/telegram-bridge/bridge.db
EOF
chmod 600 ~/.config/telegram-bridge/telegram-bridge.env

systemctl --user daemon-reload
systemctl --user enable --now telegram-bridge
```

Primer arranque del bot: escribir `/start` al bot desde la cuenta de Luis y
obtener el `chat_id` con `getUpdates` (el token nunca va en archivos
trackeados).

## Uso

```bash
# Enviar un mensaje (cualquier proceso local):
curl -s -X POST http://127.0.0.1:8787/send \
  -H 'Content-Type: application/json' \
  -d '{"text": "hola desde el bridge", "parse_mode": "HTML"}'
# → 202 {"ok": true} (quedó encolado; el bridge garantiza la entrega con reintentos)

# Salud (sin autenticar; es local):
curl -s http://127.0.0.1:8787/health
# → {"ok": true, "queue": 0}

# Logs:
journalctl --user -u telegram-bridge -f
```

Comandos en el chat (solo responde al `chat_id` autorizado): `/ping` → `pong`,
`/help` → qué sabe hacer. Extensible vía handlers opt-in de cada productor
(el bridge no conoce dominios por defecto).

## Garantías

- **202 = no se pierde**: al aceptar, el mensaje queda persistido en la cola
  SQLite propia; un worker lo entrega con backoff (5s→600s) si Telegram cae.
- Los reintentos del *productor* (ej. mail-watch: 3 intentos) solo cubren la
  caída del bridge; una vez aceptado, la entrega es responsabilidad del bridge.
- Bind únicamente a `127.0.0.1`; `X-Hub-Secret` opcional compartido.
- Logs a journald sin tokens ni cuerpos completos (IDs, estados y tamaños).
