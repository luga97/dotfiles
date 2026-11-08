---
name: dotfiles-services
description: "Patrón para agregar, modificar o depurar servicios y daemons en el repo de dotfiles de Luis (~/dotfiles/services, paquete stow enlazado a ~/services). Usar SIEMPRE que se pida instalar, levantar, respaldar, configurar o eliminar un servicio persistente: docker-compose, unidades systemd user, daemons nativos, puertos, secretos de servicios, restart policies, logs de un servicio (journalctl/docker logs), o preguntas sobre cómo corre X en este setup (searxng, activitywatch, nfs-server, telegram-bridge, dotfiles-sync, cv-mail-watch). También al mover a systemd un proceso que se arrancaba a mano."
---

# Servicios y daemons del setup (~/dotfiles/services)

TODO servicio o daemon que corre constantemente se respalda en `~/dotfiles/services/`
(paquete stow `services`, enlazado a `~/services/`). Si algo corre en segundo plano
de forma permanente y no está ahí, está fuera de respaldo.

## Revisión y seguimiento de infraestructura

1. Para responder qué está pendiente, consulta `~/dotfiles/services/INFRASTRUCTURE-PLAN.md`, `~/dotfiles/services/INVENTORY.md` y el Kanban activo; el tablero puede estar vacío mientras el plan conserva pendientes. Contrasta las casillas con actualizaciones posteriores del mismo plan.
2. Distingue observaciones históricas de comprobaciones en vivo y revalida antes de actuar; proceso activo, copia íntegra y restauración probada son evidencias distintas. Para una alerta de disco y respaldo, consulta `df -h /`, `df -i /`, el timer, el resultado y journal de la última ejecución; desglosa `du -xhd1` por niveles y señala rutas inaccesibles, pues un total parcial no explica todo el disco. Consulta como el propietario de las copias solo cuando esté autorizado. No concluyas que las copias causan la ocupación ni que una caché es descartable sin medir y revisar su contenido.
   Para cada respaldo distingue ZIP local verificado, subida remota confirmada, ejecución completa del servicio, consistencia de datos mientras el servicio escribe y restauración aislada probada. Contrasta systemd y el historial de intervención: subir un ZIP existente o ejecutar el monitor no equivale a lanzar el servicio completo, y un fallo anterior puede persistir tras una subida manual sin demostrar un fallo nuevo. Si Luis autoriza probar el job completo, inspecciona primero la unidad y la política de retención, incluidos posibles borrados; ejecuta el servicio real una sola vez, verifica su resultado y journal, y compara el hash del objeto remoto con la copia local. Informa la retención aplicada y comprueba que el timer permanezca activo; una ejecución manual no demuestra que el timer se haya disparado. No reautorices cuentas, borres archivos fuera de la retención autorizada ni reinicies servicios sin autorización específica.
3. Antes de modificar una rutina de salud, revisa el job existente y acuerda con Luis el alcance de servicios, criterios de salud, frecuencia, destinos y repetición; presenta ejemplos de mensajes y las actividades previas a la implantación. Establece una línea base de solo lectura por servicio y distingue operativo, degradado, caído y desconocido según evidencias: proceso y puertos no prueban función, y un componente de control fallido puede degradar un servicio aunque el proceso siga activo. No trates servicios pausados deliberadamente como averías ni requieras reparar las incidencias existentes para poder monitorizarlas.
4. Redacta alertas de infraestructura breves y claras: máquina y hora, una viñeta por incidencia, contexto indispensable y siguiente comprobación si se conoce; omite detalles de estados normales salvo que ayuden, sin esconder incertidumbres ni otras incidencias. Luis eligió recordatorios horarios mientras persista una incidencia para reducir el riesgo de perder un aviso; informa también de comprobaciones desconocidas y guarda silencio si todo está bien. Distingue fallos antiguos de nuevos y, si se acuerda, informa una vez la recuperación comprobada. Antes de implantar, prueba por separado alerta inicial, repetición, recuperación, silencio y errores con datos sintéticos y destino local, sin provocar fallos reales ni duplicar respaldos. Tras una ejecución manual autorizada, revisa el resultado generado y distingue una entrega encolada de una entrega confirmada; no reenvíes por incertidumbre sin revisar, para evitar duplicados. Explica que un monitor alojado en el propio servidor no puede avisar de su propia caída y que ningún transporte garantiza entrega; conserva configuración para reversión y verifica el job existente tras un cambio autorizado.

Al evaluar un servidor sin interfaz gráfica, distingue crear una cuenta sin UI de detener la sesión gráfica existente: la cuenta por sí sola no libera memoria. Mide memoria disponible y procesos gráficos, e investiga dependencias, acceso y reversión antes de proponer cambios; no sumes RSS como ahorro exacto porque hay memoria compartida.

## Diagnóstico DNS de contenedores

Si el host resuelve nombres pero un contenedor falla, compara la resolución habitual dentro del contenedor con consultas directas a resolutores alcanzables y examina los DNS efectivos de Docker y Compose; `127.0.0.11` puede ser el resolvedor integrado normal, por lo que su presencia sola no identifica el fallo. No atribuyas la causa temporal sin evidencia. Si se autoriza corregir, prefiere un cambio acotado y reversible por servicio cuando sea suficiente, comprueba impacto e interrupciones y verifica la función real, no solo HTTP 200 o estado activo. Un gestor de CI y los contenedores que crean sus jobs pueden tener configuraciones DNS distintas: la validación del gestor no demuestra que un job funcione. Protege tokens en la configuración privada, evita DNS públicos que alteren nombres privados sin acuerdo y verifica un job únicamente dentro del alcance autorizado.

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

Ejemplo real: `services/services/hermes/` — asistente persistente en home-server
que necesita acceso a las CLIs y SSH del host. Su servicio gateway lo gestiona
Hermes; el repo conserva el drop-in, instrucciones y documentación de acceso.

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
  corre lo atado a su hardware (métricas de uso local, herramientas de escritorio);
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
