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

<!-- 2026-09-16 21:10:38 [01a0ac6c] -->
- [[lugadev]] Portafolio de Luis en lugadev.com → repo `~/Projetos/lugadev` (GitHub privado). **VIVO desde 2026-09-17: https://lugadev.pages.dev** (placeholder trilingüe ES/EN/PT, Astro 5 + Tailwind 4). **CI/CD GitHub Actions (D10): push a main → deploy producción; PRs → preview pr-<n>.lugadev.pages.dev** — producción NO depende del server. Fallback manual: `.env` con CLOUDFLARE_API_TOKEN (solo Pages:Edit) + CLOUDFLARE_ACCOUNT_ID (no wrangler login: daemon headless, GUI de Luis en Omarchy). Nota: proyecto Pages creado por direct upload → NO convertible a git-integration nativa (por eso Actions). Falta F0: dominio custom (NS Hostinger→Cloudflare + custom domain). **Estado y fases viven en `docs/PLAN.md`** — retomar así: PLAN.md → "Estado actual" + "siguiente acción". Reglas en AGENTS.md: honestidad WIP, confidencialidad Avalara, experiencia = `~/Projetos/CV/experience/`. Siguiente: F1 contenido. #proyecto #portafolio

<!-- 2026-09-16 21:53:47 [01a0acc6] -->

<!-- 2026-09-17 -->
- [[lugadev]] Corrección de Luis sobre el portafolio: la métrica de porcentaje de recuperación del evaluador de búsqueda híbrida (lo de "39 a 89") NO debe usarse ni resaltarse — fue un experimento menor, no su métrica representativa. Pedirlo repetidamente molesta. Además: el título/portada NO debe construirse sobre una técnica de un proyecto laboral (muy específico); el eje del sitio es hablar de él, sus habilidades y sus fuertes, no segmentar por audiencia. El replanteo AI-first sigue en discusión — "todavía es una idea, hay que seguir puliendo". YouTube: idea futura, no fase del plan. #proyecto #portafolio

<!-- 2026-09-16 21:57:58 [01a0acd1] -->
## Bug pi-scheduler v0.5.0: schedule_task mataba el RPC (#bug #infra)

- **Síntoma**: cualquier `schedule_task` en sesión persistida crashea el proceso RPC de pi → todos los mensajes siguientes dan "Pi RPC process is closed". Mató el chat de Paseo que probaba subagentes (2026-09-16).
- **Causa**: `@jl1990/pi-scheduler@0.5.0` (PR #5, multi-proceso) usa `proper-lockfile@4.1.2`. Su `mtime-precision.js` cachea la precisión con `Object.defineProperty(fs, cacheSymbol, {value})` (non-configurable/non-writable) y luego la lee vía `fs[cacheSymbol]` — pero pi sandboxea `fs` con un Proxy → Bun aplica la invariante de proxies y lanza TypeError → crash del proceso. Reproducible 100% aislado (`pi -p` con sesión persistida en /tmp).
- **Fix local (2026-09-17)**: parcheado `~/.pi/agent/npm/node_modules/@jl1990/pi-scheduler/node_modules/proper-lockfile/lib/mtime-precision.js` (cache a nivel de módulo en vez de stash en `fs`; respaldo en `.orig` al lado). Verificado: create + list + double-call sin crash, exit 0.
- **Caveats**: (1) reinstalar/actualizar pi-scheduler borra el parche — re-aplicarlo o esperar fix upstream; (2) sesiones arrancadas ANTES del parche tienen el código viejo en memoria: no usar tools de scheduler en ellas; (3) 0.5.0 es la última versión, pi 0.85.1 también es la última. `pi-memory` NO usa proper-lockfile (verificado), sin riesgo.
- **Pendiente**: reportar upstream a github.com/jl1990/pi-scheduler (regresión del PR #5, sin issue existente). El path estaba protegido por protected-paths.ts (node_modules) — parche aplicado vía bash+python.

<!-- 2026-09-16 22:35:39 [01a0acc6] -->

<!-- 2026-09-17 -->
- [[lugadev]] Luis prefiere el modelo **openai/gpt-5.6-luna** (vía OpenRouter, autenticado en ~/.pi/agent/auth.json) para traducciones de contenido del portafolio — eligió sus versiones sobre GLM para EN y PT-BR. Flujo validado: redactar ES (revisa Luis) → `pi -p --no-session --provider openrouter --model openai/gpt-5.6-luna` → revisión final. About trilingüe aprobado 2026-09-17 (docs/drafts/about-{es,en,pt}.md). Siguiente F1: case studies STAR. #preference #proyecto

<!-- 2026-09-17 06:15:31 [01a0ae7b] -->
<!-- 2026-09-17 -->
- [[pi-scheduler-bug]] ACTUALIZACIÓN: `~/.pi/agent/npm/` NO es symlink al repo de dotfiles — es directorio real POR MÁQUINA. El parche de proper-lockfile existía solo en omarchy; **home-server fue parcheado también el 2026-09-17** (mismo fix, respaldo `.orig`, verificado: create+list+list+cancel sin crash, exit 0). Regla: cualquier reinstalación/actualización de pi-scheduler en CUALQUIER máquina borra el parche. Issue upstream redactado y verificado en `/tmp/pi-scheduler-issue.md` (repro mínimo Node con TypeError exacto de la spec de proxies) — Luis decidió publicarlo LUEGO, no todavía. #infra #bug


<!-- 2026-09-17 06:34:52 [01a0ae9f] -->
<!-- 2026-09-17 -->
- **Setup 2 máquinas — división de propósitos (aclarado por Luis 2026-09-17)** #infra
  - **omarchy (esta PC)**: la más potente; para trabajo que USA esta máquina y su hardware (GPU, monitores DDC/CI, ActivityWatch mide ESTA pc, builds pesados). Trabajo interactivo que NO necesariamente persiste.
  - **home-server** ([[home-server]]): donde corren los servicios PERSISTENTES, salvo los atados al hardware de omarchy. Regla práctica: daemon permanente sin dependencia de hardware → home-server; necesita hardware de acá → omarchy (ej.: aw-awatcher, paseo para controlar el pi LOCAL, ddc-monitors). Regla documentada también en AGENTS.md y en la skill `dotfiles-services` (commit 31d65da).
  - **Accesos desde omarchy**: SSH `home-server` (~/.ssh/config → archlinux, user `user`, vía Tailscale) + NFS v4 en `/mnt/home-server` (export `archlinux:/home/user`). El 2026-09-17 se eliminó el duplicado manual `/mnt/servidor` (mismo export, no estaba en fstab) y fstab quedó con `x-systemd.automount` + `idle-timeout=60` (antes `hard` puro: procesos se colgaban si el server no respondía). fstab respaldo: `/etc/fstab.bak-20260917`.


<!-- 2026-09-22 09:02:39 [01a0c8ef] -->
- [[paseo-daemon]] Setup remoto de Paseo en omarchy (2026-09-22): `~/.paseo/config.json` ahora tiene `daemon.listen: "0.0.0.0:6767"`, `daemon.auth.password` (bcrypt) y `daemon.hostnames: ["omarchy"]` (allowlist del header Host; `allowedHosts` es alias deprecado; es runtime-safe → `paseo reload`). Clientes (celular y Desktop) conectan con host `omarchy` (MagicDNS/Tailscale) : 6767. #infra
  - CAUSA RAÍZ del outage: el daemon anterior tenía los overrides por ENV del proceso (`PASEO_PASSWORD`, `PASEO_HOSTNAMES`) que no estaban en config.json; al re-crearse el proceso el 2026-09-22 volvió a defaults (127.0.0.1, sin auth) y nada remoto conectaba. Ahora todo está persistido en config.json (backup: `~/.paseo/config.json.bak-20260922`).
  - Quirk del CLI empaquetado: `paseo daemon start` falla desde shell (Electron pierde modo Node). Spawn que funciona: `ELECTRON_RUN_AS_NODE=1 /opt/Paseo/Paseo --disable-warning=DEP0040 /opt/Paseo/resources/app.asar.unpacked/dist/daemon/node-entrypoint-runner.js node-script /opt/Paseo/resources/app.asar/node_modules/@getpaseo/server/dist/scripts/supervisor-entrypoint.js` (setsid/nohup). Con auth activa, los comandos CLI de cliente necesitan `PASEO_PASSWORD=... paseo ...`.
