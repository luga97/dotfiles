# services

Paquete stow con el respaldo de todo servicio o daemon que corre constantemente
en este setup: Docker (docker-compose) y nativos (unidades systemd).

Plan por fases y contexto para retomar la organización de las dos máquinas:
[infraestructura de Omarchy y home server](INFRASTRUCTURE-PLAN.md).
Estado, arranque, puertos, datos y cobertura de respaldos:
[inventario verificado](INVENTORY.md).
Telegram Bridge y el seguimiento de correo del proyecto CV están pausados por
indicación de Luis (2026-11-07); su inactividad no es una incidencia a corregir.

```bash
cd ~/dotfiles && stow -R services   # enlazar a ~/services/
```

## Servicios

| Servicio | Tipo | Notas |
|----------|------|-------|
| aw-server / aw-awatcher / aw-watcher-media-player | nativo (systemd user) | métricas de uso: server + ventana/AFK + media — ver `services/activitywatch/README.md` |
| cv-mail-watch | nativo (systemd user, timer 30 min) | respuestas a postulaciones del CV |
| gitlab-runner | docker-compose | runner propio de CI de GitLab (home-server) — ver `services/gitlab-runner/README.md` |
| hermes-gateway | nativo (systemd user, home-server) | [Hermes con Codex `gpt-6.1-terra` high y acceso SSH directo a T3 en Omarchy](services/hermes/README.md); Telegram conectado por polling y limitado al propietario; inferencia y continuidad T3 verificadas |
| hermes-dashboard | nativo (systemd user, home-server) | HTTP directo `http://archlinux:9119`, bind a IP Tailscale y login propio; sin Serve/HTTPS/túnel SSH |
| mr-review | nativo (systemd user) | agente de review de MRs: webhook GitLab + reviews con pi/PR-Agent (home-server) — ver `services/mr-review/README.md` |
| dotfiles-sync | nativo (systemd user) | sincronización de dotfiles |
| nfs-server | nativo (systemd **del sistema**) | comparte `/home/user` por NFS a LAN y tailnet |
| paseo | nativo (systemd user) | control de agentes de código desde móvil/web |
| project-zomboid / pz-backup | nativo (systemd sistema) | juego y respaldo diario en home-server; [configuración y pendientes](services/project-zomboid/README.md) |
| searxng | docker-compose | [metabuscador y relación con Ketch](services/searxng/README.md); servidor degradado por DNS, conservar local hasta migrar |
| t3code | app en Omarchy; instalación en home-server suspendida | desarrollo en Omarchy; [procedimiento headless histórico](services/t3code/README.md) fuera del trabajo activo |
| telegram-bridge | nativo (systemd user) | API HTTP local 127.0.0.1:8787 para enviar mensajes a Telegram |

> Unidades de sistema: NFS exporta desde el kernel; Zomboid y sus respaldos usan
> el usuario dedicado `pzuser`. El resto de servicios nativos de este inventario
> son unidades de usuario. Ver los README de cada servicio.
