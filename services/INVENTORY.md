# Inventario de servicios de Omarchy y home server

Revisión de solo lectura: 2026-11-07. Diseño vigente: desarrollo con T3 en Omarchy
y ejecución de servicios en home server; instalación T3 allí suspendida.
Este inventario distingue configuración encontrada, estado del proceso y prueba
funcional. Un proceso activo no demuestra por sí solo que todo su flujo funcione.
Los permisos de firewall no se auditaron en esta revisión.

## Distribución y estado comprobado

El responsable operativo es Luis. Los procesos de usuario se ejecutan como
`luis` en Omarchy y `user` en home server, salvo Zomboid y sus respaldos,
que usan `pzuser`. Las unidades de sistema requieren administración del host.

| Servicio | Máquina y usuario | Arranque y estado observado | Puertos y comprobación |
|---|---|---|---|
| MR review | Home server, `user` | `mr-review.service` user habilitado y activo | `127.0.0.1:8080`; `GET /health` respondió `ok:true`, sin trabajo ni cola. Funnel HTTPS público en `archlinux.tail27d0f2.ts.net:443`. No se envió un webhook real. |
| GitLab Runner | Home server, contenedor | Docker Compose, `restart: unless-stopped`, activo; binario 19.4.1 | Sin puerto publicado; inicia conexiones salientes. No se ejecutó un job ni se verificó el estado en GitLab. |
| NFS | Home server, sistema | `nfs-server.service` habilitado, `active/exited` (normal para la unidad de coordinación); export activo comprobado | TCP 2049 y servicios RPC 111/20048, con puertos auxiliares. `/home/user` exportado a LAN y tailnet según `exportfs -v`. |
| Project Zomboid | Home server, `pzuser` | `zomboid.service` habilitado y activo | UDP 16261 y 16262 abiertos. No se probó un cliente de juego. `zomboid.socket` seguía fallido por el FIFO antiguo. |
| Respaldo Zomboid | Home server, `pzuser` | `pz-backup.timer` habilitado/activo, diario 02:00 hora local, persistente. Último `pz-backup.service` fallido, salida 1 | Sin puerto; crea ZIP local y usa rclone hacia Drive. Fallo remoto conocido: `invalid_grant`. Una copia local de 229337302 bytes estaba presente. |
| Paseo | Ambas máquinas, usuario del host | `paseo.service` user habilitado y activo en ambas | `0.0.0.0:6767`; raíz HTTP 200 en ambas. La comprobación no ejecutó un agente. Conservar durante la transición móvil/Pi. |
| SearXNG | Ambas máquinas, contenedor | Docker Compose, `restart: unless-stopped`, activo en ambas | `127.0.0.1:8081` → contenedor 8080; raíz HTTP 200 en ambas. **Home server degradado:** búsqueda JSON sin resultados y motores con errores de conexión; resolución DNS dentro del contenedor falla (`EAI_AGAIN`), aunque el host resuelve. Omarchy devolvió 15 resultados en la prueba directa del agente coordinador. No retirar la instancia local hasta corregir y probar el servidor. |
| Dotfiles sync | Ambas máquinas, usuario del host | `dotfiles-sync.timer` user habilitado/activo. Último servicio con salida 0 en ambas | Sin puerto. Cada ~15 minutos con desfase; sincroniza mediante Git remoto. |
| Hermes | Home server, `user` | Instalador oficial v0.23.0; `hermes-gateway.service` habilitado y activo, linger activo; Codex OAuth, `gpt-6.1-terra` high verificado | Telegram propio conectado por polling, solo propietario; envío real correcto. CLI de T3 accesible directamente por SSH; inferencia y continuidad comprobadas, incluido un envío del propio Hermes. Sin cron jobs ni tarjetas Kanban; solo perfil default. |
| Hermes Dashboard | Home server, `user` | `hermes-dashboard.service` habilitado y activo; usa frontend existente | HTTP directo `http://archlinux:9119`, bind `100.95.235.26:9119` (solo IP Tailscale). Login `luis` con hash privado conservado. Sin Serve 9119/8443 ni túnel SSH adicional. Página/API HTTP 200 y rechazo sin sesión comprobados. Funnel 443 de MR review se conserva. |
| ActivityWatch server | Omarchy, `luis` | `aw-server.service` user habilitado y activo | `0.0.0.0:5600`; `GET /api/0/info` respondió HTTP 200. |
| ActivityWatch ventana/AFK | Omarchy, `luis` | `aw-awatcher.service` user habilitado pero `inactive/dead`, salida previa 0; no se encontró proceso equivalente | Usa API local 5600. Pendiente investigar si se desea mantener la captura de ventana/AFK; no se cambió el servicio. |
| ActivityWatch media | Omarchy, `luis` | `aw-watcher-media-player.service` user habilitado y activo | Envía a API local 5600 mediante datos MPRIS; no se comprobó un evento nuevo. |
| Voxtype | Omarchy, `luis` | `voxtype.service` user habilitado y activo, ligado a `graphical-session.target` | Sin puerto TCP observado; `/usr/bin/voxtype daemon`. No se probó un dictado. |
| Sunshine | Omarchy, `luis` | Unidad user de paquete `app-dev.lizardbyte.app.Sunshine.service`, habilitada y activa | TCP 47984, 47989, 47990, 48010 escuchando en todas las interfaces. No se probó una sesión Moonlight. |
| T3 Code | Omarchy, `luis` | App gráfica activa; el diagnóstico previo no encontró servicio independiente instalado ni entornos vinculados | Backend observado en `127.0.0.1:3773`. T3 Connect habilitado y acceso LAN deshabilitado según su CLI. No se migró ni reinició desde esta auditoría. |
| SSH y Tailscale | Ambas máquinas, sistema | `sshd` y `tailscaled` activos | SSH TCP 22. Omarchy → home server autenticado; ping Tailscale inverso funciona. SSH inverso aún no probado tras completar confianza de host. |

Las tareas de Pi son procesos bajo demanda, no un daemon que deba permanecer
activo cuando no hay trabajo. Paseo y T3 gestionan sus propias sesiones y estado.

## Datos persistentes y cobertura de respaldo

Guardar una configuración en Git no respalda automáticamente los datos, secretos
ni sesiones que usa. En esta revisión no se restauró ningún servicio.

| Servicio | Datos y configuración | Respaldo comprobado o pendiente |
|---|---|---|
| MR review | Código y unidad en este repo; estado `~/.local/state/mr-review/state.json` presente; clone de trabajo `~/repos/mr-review/barbershop-saas`. Secretos en `~/.config/mr-review/secrets.env` y credenciales del clone fuera del inventario | Código/unidad versionados; no se verificó copia del estado o recuperación de credenciales. No versionar el `.git/config` del clone porque puede contener un token. |
| GitLab Runner | `~/services/gitlab-runner/data/config/config.toml` montado en `/etc/gitlab-runner`; contiene la identidad/token del runner. Volúmenes de Docker para ejecución y caché | Compose versionado. Config/token excluidos de Git; respaldo seguro y prueba de re-registro pendientes. |
| NFS | `/etc/exports` documentado en [su README](services/nfs-server/README.md); exporta `/home/user` | NFS comparte datos, no crea respaldos. Cobertura de los datos de `/home/user` por definir. En Omarchy, `/etc/fstab` define `/mnt/home-server` como automount con idle timeout 60 s; no estaba montado al consultar `findmnt`. |
| Zomboid | Binarios `/opt/pzserver`; partidas `~pzuser/Zomboid/Saves` (~960 MB), configuración `Server` (~84 KB) y `db` (~424 KB) | ZIP local verificado en intervención previa; Drive aún falla. Copias de unidades/script en [project-zomboid](services/project-zomboid/README.md). Faltan retención y prueba de restauración/consistencia. |
| Paseo | `~/.paseo/` por máquina; contraseña local en `~/.config/paseo/paseo.env`. Unidad/wrapper/README en repo | Código de arranque versionado; no se verificó respaldo de sesiones/configuración privada. README fija versión 0.8.0 y advierte incompatibilidad de flags con versiones posteriores. |
| SearXNG | `~/services/searxng/searxng-data` montado en `/etc/searxng`; caché en volumen anónimo Docker; `.env` local | Compose/settings versionados; secreto fuera de Git. No se necesita conservar la caché para reconstruir el buscador. Conservar configuración y secreto por una vía adecuada. |
| Dotfiles sync | Repo `~/dotfiles`, script `scripts/dotfiles-sync.sh`; unidades/timer en repo | Sincronización Git remota existente. Replica configuración; no sustituye respaldo de todos los datos del host. |
| Hermes y estado histórico | Hermes: `~/.hermes` en servidor; fuente en `~/.local/share/hermes-agent`. Estado histórico del puente retirado: `~/.local/state/hermes-omarchy-agents` en Omarchy | OAuth y estado privados fuera de Git. Respaldo/restauración de ese estado pendiente. Ver [README](services/hermes/README.md). |
| ActivityWatch | DB presente en `~/.local/share/activitywatch/aw-server-rust/sqlite.db`; unidades y wrapper en repo | Arranque documentado/versionado; respaldo/restauración de la base de métricas no verificados. |
| Voxtype | Directorio `~/.config/voxtype` presente; modelos y estado propios de la instalación | Unidad y config existentes; cobertura de configuración/diccionario por revisar en su paquete de dotfiles. No se copiaron modelos ni transcripciones. |
| Sunshine | Directorio `~/.config/sunshine` presente; unidad suministrada por paquete | Configuración, emparejamientos y cobertura de respaldo por verificar. No se copiaron credenciales ni claves. |
| T3 Code | CLI local usa `~/.t3`; estado del escritorio bajo su perfil de aplicación | No se verificó respaldo/restauración de sesiones. Mantener datos de runtime por host y evitar sincronizar una base viva como si fuera configuración. |
| SSH/Tailscale | Claves y confianza SSH por usuario; estado Tailscale por host | No copiar claves privadas ni estado de identidad a este repo público. Recuperación y permisos se revisarán al implementar el acceso entre hosts. |

## Alcance y pendientes

- Telegram Bridge y seguimiento de correo del proyecto CV están pausados por
  indicación de Luis: excluidos del trabajo activo. Su inactividad no es una avería.
- No se reinició ningún servicio, cambió exposición de red, ejecutó pipeline,
  envió mensaje ni reautorizó Google Drive para producir este inventario.
- Pendientes relevantes: resolver DNS del contenedor SearXNG en home server antes
  de centralizarlo, flujo de desarrollo/despliegue y evaluación de Hermes para operaciones,
  revisión de `aw-awatcher`, cobertura de datos persistentes y fiabilidad de Zomboid.
- Las unidades/código existentes demuestran cómo arrancar; las comprobaciones de
  esta tabla son muestras puntuales. Revalidar antes de retirar una instancia.

Referencia de coordinación: [plan por fases](INFRASTRUCTURE-PLAN.md).
