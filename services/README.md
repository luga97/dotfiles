# services

Paquete stow con el respaldo de todo servicio o daemon que corre constantemente
en este setup: Docker (docker-compose) y nativos (unidades systemd).

```bash
cd ~/dotfiles && stow -R services   # enlazar a ~/services/
```

## Servicios

| Servicio | Tipo | Notas |
|----------|------|-------|
| aw-server / aw-awatcher / aw-watcher-media-player | nativo (systemd user) | métricas de uso: server + ventana/AFK + media — ver `services/activitywatch/README.md` |
| cv-mail-watch | nativo (systemd user, timer 30 min) | respuestas a postulaciones del CV |
| dotfiles-sync | nativo (systemd user) | sincronización de dotfiles |
| nfs-server | nativo (systemd **del sistema**) | comparte `/home/user` por NFS a LAN y tailnet |
| paseo | nativo (systemd user) | control de agentes de código desde móvil/web |
| searxng | docker-compose | metabuscador |
| telegram-bridge | nativo (systemd user) | API HTTP local 127.0.0.1:8787 para enviar mensajes a Telegram |

> Nota: `nfs-server` es la única unidad de sistema (la exporta el kernel con
> root); su config está en `/etc/exports` del host, documentada en
> `services/nfs-server/README.md`.
