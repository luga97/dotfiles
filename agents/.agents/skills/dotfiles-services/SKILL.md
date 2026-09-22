---
name: dotfiles-services
description: "Patrón para agregar, modificar o depurar servicios y daemons en el repo de dotfiles de Luis (~/dotfiles/services, paquete stow enlazado a ~/services). Usar SIEMPRE que se pida instalar, levantar, respaldar, configurar o eliminar un servicio persistente: docker-compose, unidades systemd user, daemons nativos, puertos, secretos de servicios, restart policies, logs de un servicio (journalctl/docker logs), o preguntas sobre cómo corre X en este setup (paseo, searxng, activitywatch, nfs-server, telegram-bridge, dotfiles-sync, cv-mail-watch). También al mover a systemd un proceso que se arrancaba a mano."
---

# Servicios y daemons del setup (~/dotfiles/services)

TODO servicio o daemon que corre constantemente se respalda en `~/dotfiles/services/`
(paquete stow `services`, enlazado a `~/services/`). Si algo corre en segundo plano
de forma permanente y no está ahí, está fuera de respaldo.

## Decisión: ¿Docker o nativo?

- **Docker (docker-compose)** por defecto.
- **Nativo (systemd user)** SOLO si el servicio necesita acceso al host: CLIs de
  agentes, git/SSH del usuario, red/hardware del host (ej.: nfs-server exporta un
  filesystem del kernel y es unidad de sistema, la única excepción).
  Razón: docker aísla; si el servicio necesita ver el host, el compose se llena de
  mounts y es más simple una unidad user.

## Patrón Docker

```
services/services/<nombre>/
├── docker-compose.yml
├── .env           # secretos — gitignored
├── .env.example   # trackeado, con placeholders
└── <datos>/       # volúmenes/datos persistentes del servicio
```

Reglas en el compose: `restart: unless-stopped` y puertos en `127.0.0.1` salvo que
se necesite acceso externo explícito (y en ese caso, documentarlo en el README).

Ejemplo real: `services/services/searxng/`.

## Patrón nativo (systemd user)

- Unidad: `services/.config/systemd/user/<nombre>.service` — stow la enlaza a
  `~/.config/systemd/user/`.
- Notas de setup: `services/services/<nombre>/README.md` (cómo se instaló el
  binario, de dónde salen los secretos, cómo verificar).
- Secretos: en un env local del host referenciado con `EnvironmentFile=`
  (ej.: `~/.config/<nombre>/<nombre>.env`) — NUNCA en el repo, que se sincroniza.
- `WantedBy=default.target` para que arranque con la sesión.
- Si depende de otro servicio user: `Requires=` + `After=` a su unidad (ej.: las
  watchers de ActivityWatch requieren aw-server; si el server muere, systemd las
  reinicia tras reconectar).

Ejemplo real: `services/services/paseo/` — daemon que controla agentes de código
desde móvil/web (https://paseo.sh). Corre nativo porque debe ver pi, `~/.pi` y git
del host. Instalado con `npm install -g @getpaseo/cli --allow-scripts=esbuild,node-pty`,
ejecuta `paseo start --foreground --web-ui`; contraseña en `~/.config/paseo/paseo.env`,
estado en `~/.paseo`, Web UI en http://localhost:6767.

## Alta o modificación de un servicio

1. Crear los archivos según el patrón (Docker o nativo) + README del servicio.
2. `cd ~/dotfiles && stow -R services` (re-enlaza).
3. Levantar:
   - Docker: `docker compose up -d` (desde el directorio del servicio).
   - Nativo: `systemctl --user daemon-reload && systemctl --user enable --now <nombre>`.
4. Verificar: `systemctl --user status <nombre>` / `docker compose ps`, y logs
   (`journalctl --user -u <nombre>` / `docker compose logs`).
5. Actualizar la tabla de servicios en `services/README.md` (en alta Y en baja).
6. Commit y push en ~/dotfiles (para el flujo del repo, ver la skill `sync-dotfiles`).

## Notas que evitan sorpresas

- **¿En qué máquina corre?** El repo es idéntico en ambas; lo que decide es el
  objetivo del servicio + el enable por-máquina. omarchy (la PC potente de Luis)
  corre lo atado a su hardware (métricas de uso local, paseo del pi local);
  **home-server** corre los servicios persistentes sin dependencia de hardware.
  Si Luis pide "un servicio" sin especificar máquina, preguntar (o deducir por
  la regla anterior) antes de levantarlo.
- **El enable es por-máquina**: `systemctl --user enable` crea el symlink en
  `~/.config/systemd/user/` (directorio real, fuera del repo) — stow solo enlaza
  el archivo de unidad. Cada máquina decide qué auto-arranca; home-server no
  hereda los enables de esta máquina.
- **No arrancar servicios a mano desde sesiones de agente** (`cmd &`): heredan
  los pipes de la sesión y mueren (o crashean al escribir) cuando la sesión
  termina, quedando como huérfanos fuera de systemd. Usar siempre las unidades;
  si es una prueba puntual, redirigir stdout/stderr a un archivo o /dev/null y
  matar el proceso al terminar.
