# Hermes en home server y delegación a Omarchy

Estado 2026-11-07: Hermes v0.23.0 instalado mediante el instalador oficial directo.
Gateway de usuario habilitado y activo. Codex autenticado con una sesión propia.
Cadena Hermes → SSH → Pi probada con dos turnos de la misma conversación;
se verificó la continuidad en los resultados y en el transcript persistido de Pi.

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

El workspace bloqueó la autenticación por device-code con un mensaje de permiso
administrativo. Se completó correctamente el flujo OAuth normal de navegador con
PKCE, devolviendo el callback al servidor mediante un túnel SSH temporal.
`auth.codex_login_flow=browser` queda configurado para futuras autenticaciones.

Para volver a autenticar, abrir primero el túnel desde Omarchy y mantenerlo activo:

```bash
ssh -N -L 127.0.0.1:1455:127.0.0.1:1455 home-server
```

En otra terminal:

```bash
ssh -t home-server '~/.local/bin/hermes auth add openai-codex --browser --no-browser --timeout 600'
```

Abrir la URL oficial que imprime el comando **en el navegador de Omarchy**, para
que `localhost:1455` llegue al túnel. Una vez autorizado, cerrarlo. El túnel
transitorio `hermes-auth-forward.service` usado en esta intervención quedó detenido.
No guardar URLs/códigos temporales, tokens ni `auth.json` en Git. La verificación
`hermes auth status openai-codex` respondió `logged in`; archivo OAuth con modo 600.

Unidad: `~/.config/systemd/user/hermes-gateway.service`, gestionada por el propio
Hermes y habilitada **solo en home server**. Hermes la regenera al iniciar clientes;
por eso su archivo principal es local al host, no un symlink al repo. Se conserva
una [copia de referencia](host-files/hermes-gateway.service) con las rutas del servidor.
Para reconstruirla, usar `hermes gateway install` después de instalar el producto.
Los ajustes propios se stowean desde
`.config/systemd/user/hermes-gateway.service.d/10-home-server.conf`: condición de
host `archlinux`, PATH con herramientas de mise y parada de 90 s. Esta separación
permite que Hermes actualice su ciclo de parada/reinicio sin ensuciar dotfiles.
Linger está activo. El `HERMES_HOME` es `~/.hermes`.

El directorio `hermes-gateway.service.d` debe ser real: systemd no cargó los
drop-ins cuando Stow lo había plegado como symlink de directorio. Sus archivos
sí se enlazan al repo. Antes de stow en una reconstrucción, crear el directorio
real y un marcador local `.keep-real-directory` (fuera del repo) para que Stow
no vuelva a plegarlo. Esta disposición se verificó tras `stow -R services`:
`DropInPaths` incluye el ajuste y `NeedDaemonReload=no`.

```bash
systemctl --user status hermes-gateway --no-pager
journalctl --user -u hermes-gateway -n 30 --no-pager
~/.local/bin/hermes gateway status
~/.local/bin/hermes
```

El gateway sirve el socket local `~/.hermes/gateway.sock` y su backend en loopback
con puerto dinámico. El dashboard tiene su ruta privada Tailscale Serve, descrita
abajo. No se activó Webapp ni bot de mensajería.
El aviso de que no hay plataformas de mensajería habilitadas es esperado.

## Dashboard de gestión

Activo como servicio separado `hermes-dashboard.service`, usando el frontend
ya compilado de Hermes. Escucha directamente en `100.95.235.26:9119`, la IP de
Tailscale de home server; no escucha en todas las interfaces. El dashboard permite gestionar configuración
y sesiones; la Webapp de chat completa es otra superficie y sigue sin activar.

Acceso actual desde PC y teléfono con Tailscale conectado:

**http://archlinux:9119** — usuario **luis**, contraseña elegida
mediante formulario privado. Es un login propio del dashboard, separado del OAuth
Codex que usa el modelo. No guardar la contraseña ni la configuración privada en Git.

Por petición de Luis se simplificó a nombre:puerto: HTTP directo, sin HTTPS,
sin proxy Tailscale Serve y sin túnel SSH adicional para Hermes. La VPN cifra
el transporte entre dispositivos. El login de Hermes se conserva y la API sin
sesión rechaza el acceso. Se verificaron la página y `/api/status` en el nombre
corto con HTTP 200; no quedan listeners Serve 9119 ni 8443. No se usó Funnel para
el panel ni se abrió un puerto del router.
El Funnel 443 de MR review sigue intacto y `/health` respondió 200/`ok:true`.

Configuración no secreta guardada en el host: `dashboard.public_url` apunta al URL
anterior. `dashboard.basic_auth` contiene el usuario, hash scrypt y clave aleatoria
de firma persistente; `~/.hermes/config.yaml` tiene modo 600. Esto permite que las
sesiones sobrevivan a reinicios. Para cambiar la contraseña desde Omarchy, recibirla
en un archivo privado y ejecutar:

```bash
python ~/services/hermes/configure-dashboard-access.py --password-file /ruta/privada
```

El helper envía solo el hash y configuración por stdin de SSH; no imprime valores
de credenciales. Regenera la clave de firma al configurar, cerrando las sesiones
anteriores, y verifica el login HTTP sin mostrar cookies ni contraseña.

La unidad fija la IP de Tailscale de este host y reinicia ante fallo si al boot
esa interfaz aún no está disponible. Si cambia la identidad/IP del nodo, actualizar
el bind. `dashboard.public_url=http://archlinux:9119` permite el Host/Origin corto;
el nombre completo anterior ya no es el URL canónico. `home-server` es un alias
de SSH, no un nombre MagicDNS: el nodo se llama `archlinux`.

Mantener HTTP directo para este dashboard; no añadir HTTPS, Serve ni túneles
adicionales sin que Luis lo pida. Los túneles SSH transitorios quedaron detenidos.
No se ha probado un teléfono real: debe tener Tailscale conectado y acceso a esta máquina.

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
- Cadena completa dirigida por Hermes (Codex `gpt-6-luna`): tareas Pi
  `315a76d1-e6a3-4b87-8dbe-7f6def442715` y
  `c85ef4f6-2c91-4beb-af85-5652b8cba07a`, ambas `completed`, en la sesión
  `e5b2b3b0-3ced-4d79-b2bc-ebc203562833`.
- Hermes creó la tarea mediante su herramienta terminal, esperó su resultado y
  reanudó el mismo contexto en el segundo turno. Pi devolvió la clave correcta;
  el segundo prompt no contenía esa clave. El transcript Pi guardado contiene
  dos mensajes de usuario y dos respuestas del asistente en el mismo archivo.
- El gateway reinició correctamente con la unidad definitiva: activo y sin
  reinicios por fallo. `hermes gateway status` confirma el servicio y linger.
- Registros privados de la prueba dirigida por Hermes:
  `~/.hermes/cache/delegation-proof/{first,second}.jsonl` en home server.
  Los resúmenes automáticos de Pi se generan con sus extensiones habituales.

El reinicio completo del host y la restauración del estado no se probaron.
La CLI gestionada por el gateway rechaza `--run-budget`; para un límite de
tiempo hay que usar `agent.run_budget_seconds` en la configuración. No se cambió
ese límite global durante estas pruebas.

## Límites de esta primera integración

- Pi es el único proveedor configurado en el puente. Las skills oficiales de
  Hermes para Codex y Claude Code no equivalen a soporte remoto ya desplegado.
- Admite continuar una sesión terminada; todavía no dirige un turno en curso.
- Sin reintento/cola automática cuando Omarchy está apagada. Informar la falta de
  disponibilidad y conservar la petición antes de diseñar ese comportamiento.
- Evitar que T3 y Pi modifiquen simultáneamente el mismo checkout; para paralelismo
  preparar espacios de trabajo separados.

Plan general: [infraestructura](../../INFRASTRUCTURE-PLAN.md).
