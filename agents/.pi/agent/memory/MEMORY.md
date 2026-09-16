<!-- 2026-09-16 18:46:03 [01a0ac20] -->
- home-server: SSH `home-server` (archlinux, user `user`), tiene pi (~/.pi/agent). Repo dotfiles allá se sincroniza con el mismo timer/script. La credencial zai del Coding Plan quedó en su auth.json (no en el repo). En ambas máquinas `~/.pi/agent/memory` Y `~/.pi/agent/extensions` son symlinks al repo (`../../dotfiles/agents/.pi/agent/...`) — las extensiones se editan una vez y se sincronizan solas. Ojo: permission-gate.ts del repo NO bloquea `sudo` (deliberado, flujo SSH a home-server). #infra


<!-- 2026-09-16 20:48:53 [01a0ac7d] -->
<!-- 2026-09-16 -->
## Proyecto pc-metrics — métricas de uso de la PC (#project)

- **Repo/doc maestro**: `~/Projects/pc-metrics/DESIGN.md` — TODO el contexto del proyecto vive ahí (investigación, decisiones D1-D4, fases F1-F8, fuentes de datos verificadas). Consultar ese archivo antes de continuar cualquier trabajo relacionado.
- Base elegida: **ActivityWatch** (local, extensible) + `awatcher` (ventana+AFK en Wayland/Hyprland) + extensión navegador + aw-watcher-media-player. Todo en AUR (`activitywatch-bin`, `aw-awatcher`, `aw-watcher-media-player`), aún NO instalado.
- Custom a desarrollar en el repo: **aw-watcher-shell** (bash: hay que habilitar timestamps, hoy no hay HISTTIMEFORMAT) y **aw-watcher-ai** (sesiones JSONL de pi en `~/.pi/agent/sessions/--<cwd>--/`, paseo en `~/.paseo/agent-requests`).
- Digest semanal planeado con `pi -p` (patrón dotfiles-sync.sh). Servicio final irá a `~/dotfiles/services` (patrón systemd user).
- Subagentes worker investigando en `docs/` del repo: activitywatch-protocol.md, shell-watcher-design.md, ai-watcher-design.md.
