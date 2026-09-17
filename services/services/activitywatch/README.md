# activitywatch (aw-server + aw-awatcher + aw-watcher-media-player)

Métricas de uso de la PC: servidor ActivityWatch + watchers de ventana/AFK y
media. Contexto completo del proyecto en `~/Projects/pc-metrics/DESIGN.md`.

## Instalación (NO AUR)

Los paquetes AUR (`aw-awatcher`, `awatcher-bundle`) tenían los repos git vacíos
server-side ("Invalid branch" en cgit), imposible revisarlos → vía releases
oficiales de GitHub (2026-09-16):

| Componente | Versión | Vía | Ubicación |
|---|---|---|---|
| activitywatch (aw-server-rust) | 0.13.2 | zip de GitHub releases → extraído | `~/.local/opt/activitywatch` |
| aw-awatcher (ventana+AFK) | 0.4.0 | binario del `aw-awatcher_0.4.0-1_amd64.deb` | `~/.local/bin/aw-awatcher` |
| aw-watcher-media-player | 1.1.4 | `cargo build --locked` tag v1.1.4 | `~/.local/bin/aw-watcher-media-player` |

- `~/.local/bin/aw-server` es un **wrapper** propio (exporta `LD_LIBRARY_PATH`
  del bundle y ejecuta `aw-server-rust`). Es lo que apunta la unidad.
- Web UI embebida: http://localhost:5600 — db en
  `~/.local/share/activitywatch/aw-server-rust/sqlite.db`.
- **Trampa 1**: el binario `awatcher` (sin guion) del release es la build
  *bundle* con server interno en :5600 — choca con aw-server-rust. Usar
  siempre `aw-awatcher`.
- **Trampa 2**: `aw-watcher-media-player` es Rust (no Python, no está en PyPI).

## Unidades (systemd user)

| Unidad | Rol |
|---|---|
| `aw-server.service` | servidor (API REST + web UI en 127.0.0.1:5600) |
| `aw-awatcher.service` | ventana activa + AFK (buckets `aw-watcher-{window,afk}_<host>`) |
| `aw-watcher-media-player.service` | media vía MPRIS (bucket `aw-watcher-media-player_<host>`) |

Las dos watchers tienen `Requires=aw-server.service` (arrancan con él).

## Activar (solo en máquinas con sesión gráfica)

```bash
cd ~/dotfiles && stow -R services
systemctl --user daemon-reload
systemctl --user enable --now aw-server aw-awatcher aw-watcher-media-player
```

Los enlaces de `default.target.wants/` que crea `enable` quedan en
`~/.config/systemd/user/` (stow enlaza por archivo, NO dentro del repo) → la
activación es por-máquina. En headless (home-server) solo tiene sentido
`aw-server` si se quisiera centralizar ahí; por defecto NO activar nada.

## Verificación rápida

```bash
systemctl --user status aw-server aw-awatcher aw-watcher-media-player
curl -s localhost:5600/api/0/buckets/ | python3 -m json.tool
curl -s "localhost:5600/api/0/buckets/aw-watcher-window_$(hostname)/events?limit=3"
```
