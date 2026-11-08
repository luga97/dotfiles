# Hermes en home server y delegación a Omarchy

Estado 2026-11-07: Hermes v0.23.0 instalado mediante el instalador oficial directo.
Gateway de usuario habilitado y activo. Puente SSH → Pi probado con dos turnos de
la misma sesión. Login independiente de Codex iniciado; falta comprobar la
delegación dirigida por el propio modelo de Hermes una vez autorizado.

## Distribución

- Home server (`archlinux`, usuario `user`): Hermes, su estado y cliente del puente.
- Omarchy (usuario `luis`): Pi, los proyectos, las sesiones remotas y los workers.
- T3 permanece en Omarchy. Este puente no usa ni instala T3 en home server y no
  toma conversaciones existentes de T3. Paseo y servicios pausados del CV no se modifican.

## Instalación realizada

Se revisaron el PKGBUILD de AUR `hermes-agent` 0.23.0-1 y sus tres parches y dos
helpers. El intento `makepkg -si --needed` falló antes de instalar dependencias:
requiere `uv>=0.13.5`, mientras la metadata local ofrecía 0.12.9. No se realizó una
actualización general del sistema. Luis indicó usar el instalador directo.

Se descargó y revisó el instalador oficial de la versión v0.23.0:

- URL: `https://raw.githubusercontent.com/NousResearch/hermes-agent/v0.23.0/scripts/install.sh`
- SHA256 del script revisado: `abf338605dae6dd28d101673ac6aed7995c955745db46d47676bc591a7957209`.
- Commit instalado: `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`.

Comando ejecutado en un servicio transitorio de instalación, con temporales en
disco, CPUQuota 200 % y MemoryHigh 3G:

```bash
bash ~/.cache/hermes-bootstrap/install-v0.23.0.sh \
  --dir ~/.local/share/hermes-agent \
  --commit 2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19 \
  --non-interactive --skip-browser --skip-computer-use
```

El instalador valida los artefactos de herramientas y usa su entorno Python
aislado; no instala Desktop, Chromium ni computer-use. Dejó su launcher en
`~/.local/bin/hermes` y añadió ese directorio al PATH de `.profile`/`.bash_profile`.
La fuente y runtime están fuera del repo de dotfiles; las actualizaciones del
producto se hacen con `hermes update`, revisando primero la versión objetivo.

## Proveedor y servicio

Luis eligió **Codex con su suscripción**. La configuración actual es
`model.provider=openai-codex` y `model.default=gpt-6-luna`, el modelo que ya usa Pi
por defecto. El login de Hermes crea su propia sesión, sin copiar los tokens de Pi.

```bash
ssh -t home-server '~/.local/bin/hermes auth add openai-codex --no-browser --timeout 600'
```

Completar la autorización en la URL oficial que imprime el comando. No guardar el
código temporal, tokens ni `auth.json` en Git. Verificar con
`hermes auth status openai-codex` después de autorizar.

Unidad: `~/.config/systemd/user/hermes-gateway.service`, stoweada desde este repo,
habilitada **solo en home server** (`ConditionHost=archlinux`). Linger está activo.
La unidad usa el launcher oficial, las herramientas de mise y un margen de parada
de 90 s. El `HERMES_HOME` es el predeterminado, `~/.hermes`.

```bash
systemctl --user status hermes-gateway --no-pager
journalctl --user -u hermes-gateway -n 30 --no-pager
~/.local/bin/hermes gateway status
~/.local/bin/hermes
```

El gateway sirve inicialmente el socket local `~/.hermes/gateway.sock` y su backend
en loopback con puerto dinámico. No se activó un nuevo Funnel/Serve, Webapp ni bot
de mensajería; el acceso remoto al asistente se hace por SSH hasta elegir ese canal.
El aviso de que no hay plataformas de mensajería habilitadas es esperado.

`~/.hermes/SOUL.md` enlaza al [SOUL compartido](SOUL.md); el original del instalador
se conserva como `SOUL.md.installer-default`. Configuración, OAuth, sesiones,
memoria privada y herramientas de Hermes viven en `~/.hermes` (directorio 700).
Git conserva instrucciones y arranque; el respaldo del estado privado es un
pendiente separado. No versionar `.env`, `auth.json` ni bases de datos vivas.

## Puente inicial a Pi

Cliente: `~/.local/bin/hermes-omarchy-agent`, stoweado en ambas máquinas.
Implementación: [agent-bridge.py](agent-bridge.py), solo biblioteca estándar de Python.

El cliente de home server usa SSH no interactivo a `luis@omarchy` y exige la clave
de host ya conocida. Envía JSON por stdin, sin interpolar el prompt en shell.
Omarchy guarda la petición y arranca un worker con `systemd-run --user`; la tarea
continúa aunque se cierre la conexión del cliente.

```bash
# Ejecutar desde home server; el archivo de prompt es local al servidor.
~/.local/bin/hermes-omarchy-agent submit \
  --cwd /home/luis/ruta-del-proyecto --prompt-file /ruta/local/prompt.txt

~/.local/bin/hermes-omarchy-agent status TASK_UUID
~/.local/bin/hermes-omarchy-agent wait TASK_UUID --timeout 120
~/.local/bin/hermes-omarchy-agent result TASK_UUID

# Segundo turno: mantener el session_id devuelto por submit.
~/.local/bin/hermes-omarchy-agent submit \
  --session-id SESSION_UUID --prompt-file /ruta/local/continuacion.txt

~/.local/bin/hermes-omarchy-agent list
```

La salida es JSON. Inspeccionar `status`: `queued`, `running`, `completed` o
`failed`. El comando `wait` puede terminar por su límite de espera aunque el
worker siga activo; no reenviar a ciegas. Cada sesión acepta un turno a la vez.
Los comandos de consulta pueden devolver una tarea fallida con salida 0, porque
la consulta funcionó: el resultado real está en `status` y `error`.

Estado privado de Omarchy: `~/.local/state/hermes-omarchy-agents/`, con permisos
700/600. Guarda metadatos, respuestas, eventos JSONL, stderr y sesiones Pi. Cada
worker tiene un máximo de 30 min para Pi y se supervisa como
`hermes-agent-TASK_UUID.service`; al detenerlo, systemd termina todo su grupo de
procesos. Un worker interrumpido se identifica como fallido al consultar el estado.

Pi usa su configuración habitual y sesiones nuevas del puente; no cambia su
proveedor, credenciales, extensiones o sesiones interactivas existentes.
El cwd debe existir bajo `/home/luis`; una continuación conserva el proyecto.
Variables opcionales del cliente: `HERMES_OMARCHY_HOST`, `HERMES_OMARCHY_SCRIPT`.
En Omarchy: `HERMES_AGENT_STATE`, `HERMES_PI_BINARY`.

## Verificación realizada

- SSH inverso home server → Omarchy autenticado y clave de host verificada.
- Primera tarea Pi: `ead5bf32-ab1c-4885-b9f8-0565dcade04b`, completada.
- Continuación: `fc4fc117-19c7-4821-89ba-702b06352e35`, completada en la sesión
  `1d153674-3ff9-45da-be5c-b77dae4d7680`.
- El segundo turno recuperó exactamente una clave aleatoria que solo apareció en
  el primero; se le pidió no usar herramientas ni leer archivos.
- Solicitudes con ID inválido, sesión inexistente o cwd `/etc` fueron rechazadas
  sin lanzar agentes. Sintaxis Python/shell y enlaces locales revisados.

Pendiente: login Codex, prueba de la cadena Hermes → puente → Pi, y comprobar la
parada/reinicio del gateway con la unidad definitiva. El reinicio completo del
host y restauración del estado no se probaron.

## Límites de esta primera integración

- Pi es el único proveedor configurado en el puente. Las skills oficiales de
  Hermes para Codex y Claude Code no equivalen a soporte remoto ya desplegado.
- Admite continuar una sesión terminada; todavía no dirige un turno en curso.
- Sin reintento/cola automática cuando Omarchy está apagada. Informar la falta de
  disponibilidad y conservar la petición antes de diseñar ese comportamiento.
- Evitar que T3 y Pi modifiquen simultáneamente el mismo checkout; para paralelismo
  preparar espacios de trabajo separados.

Plan general: [infraestructura](../../INFRASTRUCTURE-PLAN.md).
