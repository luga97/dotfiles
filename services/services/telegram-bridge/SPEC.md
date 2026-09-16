# telegram-bridge — SPEC (servicio genérico, para implementar en otra sesión)

Un bot de Telegram aislado: **solo** expone una API HTTP local para enviar
mensajes y (fase 2) ejecutar comandos. No conoce correos, ni CV, ni ninguna otra
aplicación. No depende de nada: cualquier proceso local puede mandarle un
mensaje con un `curl`.

## Responsabilidad única

1. **Enviar mensajes a Telegram** que le llegan por su API HTTP local.
2. **Ejecutar comandos** (fase 2) que le escribe Luis directamente en el chat.

Regla de independencia: NO lee bases de datos de otros servicios, NO conoce
dominio alguno. El acoplamiento con cualquier productor (mail-watch hoy, otro
mañana) es exclusivamente la API HTTP.

## API (fase 1)

Escucha SOLO en loopback:

```
POST http://127.0.0.1:8787/send
Headers: Content-Type: application/json
         X-Hub-Secret: <compartido opcionalmente>
Body:    {"text": "...", "chat_id": "<opcional>", "parse_mode": "HTML"}

→ 202 {"ok": true}    (el mensaje quedó encolado, entrega garantizada en fondo)
→ 401 secret inválido / 503 bot temporalmente caído
```

- Al aceptar (202) el mensaje se persiste en la cola interna PROPIA del bridge
  (SQLite propia, ej. `~/.local/state/telegram-bridge/bridge.db`) y un worker
  interno lo entrega a la Bot API con reintentos. Así, si Telegram cae, el
  mensaje no se pierde: el productor ya recibió su 202.
- `chat_id` ausente → `TELEGRAM_BRIDGE_CHAT_ID` (el chat de Luis).
- `GET /health` → `{"ok": true, "queue": <pendientes>}` (sin autenticar; es local).

**Los reintentos del productor (ej. mail-watch: 3 intentos) solo cubren la
caída del bridge; una vez aceptado, la entrega es responsabilidad del bridge.**

## Configuración (secrets fuera de cualquier repo)

`EnvironmentFile` apuntando a env local del host (patrón `paseo.service`):

```
~/.config/telegram-bridge/telegram-bridge.env   # chmod 600, NO versionado
```

```
TELEGRAM_BOT_TOKEN=<token existente>
TELEGRAM_BRIDGE_CHAT_ID=<chat_id de Luis>
TELEGRAM_BRIDGE_PORT=8787
TELEGRAM_BRIDGE_SECRET=<opcional, compartido con los productores>
TELEGRAM_BRIDGE_DB=~/.local/state/telegram-bridge/bridge.db
```

Primer arranque: escribir /start al bot desde la cuenta de Luis y obtener
`chat_id` con `getUpdates`. El token nunca va en archivos trackeados ni en
conversaciones.

## Stack

- **Python 3 + python-telegram-bot** (está en `extra` de pacman): un proceso,
  HTTP server propio (o `aiohttp`/stdlib) + long polling de la Bot API.
  Sin webhooks, sin puertos expuestos más allá de loopback.
- Instalación vía pacman cuando aplique; si hay que usar pip, en venv dedicado
  dentro del servicio. Respetar la skill `arch-install`.

## Unidades systemd (paquete stow `services`)

```
services/.config/systemd/user/telegram-bridge.service
```

- `Type=simple`, `Restart=on-failure`, `RestartSec=5`
- `EnvironmentFile=%h/.config/telegram-bridge/telegram-bridge.env`
- `WantedBy=default.target`
- No necesita timer: long-running con polling propio de Telegram.

## Comandos (fase 2, genéricos, mismo proceso)

- `/ping` → `pong` (diagnóstico).
- `/help` → qué sabe hacer el bridge.
- Extensible: el bridge puede delegar comandos a otros servicios vía un hook
  simple (ej. directorio de "handlers" o POST a una URL registrada), pero eso
  es opt-in de cada productor — el bridge NO conoce dominios por defecto.

## Seguridad

- Bind únicamente a `127.0.0.1`; opcionalmente `X-Hub-Secret` compartido.
- El bot privado: solo responde al chat autorizado (`chat_id` de Luis).
- Token SOLO en el env local del host; nunca en repos versionados.
- Log a journald sin loguear tokens ni cuerpos completos (suficiente con IDs,
  estados y tamaños).
