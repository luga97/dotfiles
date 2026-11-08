# Hermes en home server y delegación a Omarchy

Estado 2026-11-07: Hermes v0.23.0 instalado mediante el instalador oficial directo.
Gateway de usuario habilitado y activo. Codex autenticado con una sesión propia.
Hermes puede llamar a la CLI de T3 en Omarchy mediante SSH. La consulta de T3
por SSH se verificó con Codex, incluyendo continuidad y un envío del propio Hermes.

## Distribución

- Home server (`archlinux`, usuario `user`): Hermes y su estado.
- Omarchy (usuario `luis`): T3, Pi, los proyectos y las conversaciones T3.
- T3 permanece en Omarchy; Hermes invoca su CLI por SSH. Los servicios del CV
  siguen pausados.

Hermes descubre las skills compartidas mediante `skills.external_dirs` con
`~/.agents/skills`, además de las propias en `~/.hermes/skills`. La herramienta de
skills leyó `dotfiles-services` correctamente. Las skills compartidas se mantienen
en dotfiles; Hermes puede actualizarlas siguiendo el flujo de sincronización y las
instrucciones de las skills aplicables.
El perfil general de Hermes está en `SOUL.md`; el procedimiento de acceso a T3
se carga cuando hace falta desde la skill compartida `omarchy-t3`.

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
`model.provider=openai-codex`, `model.default=gpt-6.1-terra` y
`agent.reasoning_effort=high`, por elección de Luis. Terra se verificó en el catálogo
de la cuenta y respondió a una consulta real. Pi conserva su configuración propia.
El login de Hermes crea su propia sesión, sin copiar los tokens de Pi.

En v0.23.0 `agent.reasoning_effort` está implementado en CLI y gateway pero falta
en el registro de claves del comando `config`. Para escribirlo con la CLI se usó
`hermes config set agent.reasoning_effort high --force`; no es una clave inventada.

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

## Telegram propio de Hermes

Luis pidió habilitar Telegram para Hermes, separado del Telegram Bridge del CV,
que permanece pausado. Se completó el flujo nativo de creación automática de bot:
[@hermes_yh6xoaeq53dcivby_bot](https://t.me/hermes_yh6xoaeq53dcivby_bot).
Gateway reiniciado; logs confirman conexión en polling. `getMe` y el envío de un
mensaje de prueba al propietario respondieron correctamente. La respuesta a una
consulta entrante real aún debe comprobarse. El enlace temporal y el archivo
privado de emparejamiento ya se retiraron; las credenciales no se versionan.

El token se guarda únicamente en `~/.hermes/.env` del servidor (modo 600).
`TELEGRAM_ALLOWED_USERS` se limita al propietario detectado en la creación;
`TELEGRAM_HOME_CHANNEL` apunta a su DM. `TELEGRAM_ALLOW_ALL_USERS=false` y no hay
permiso global para todos los usuarios. No se habilita acceso público al agente.
El adaptador usa long polling saliente: no necesita webhook, HTTPS, Serve ni
puertos nuevos. El teléfono usa Telegram sin requerir Tailscale para este canal.
Las herramientas Kanban están habilitadas para Telegram y CLI. Una conversación
Telegram iniciada antes del cambio debe renovarse con `/new` para cargar el nuevo
conjunto de herramientas. En una prueba, una tarjeta bloqueada se desbloqueó
manualmente y un worker de Hermes comprobó SSH y la completó. Aún no se configuró
la comprobación periódica ni el desbloqueo/despacho automático hacia T3.

## T3 en Omarchy por SSH

El puente Python experimental, sus workers y su registro de tareas se retiraron a
petición de Luis. Hermes llama directamente a la CLI instalada de T3 por SSH;
T3 conserva las conversaciones. Las sesiones y logs históricos del antiguo puente
permanecen en `~/.local/state/hermes-omarchy-agents` de Omarchy.

```bash
# Desde home server: consulta de conectividad y proyecto, sin crear una conversación.
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=5 \
  luis@omarchy /home/luis/.local/bin/t3 thread list --project /home/luis/dotfiles --json

# Solo si Luis solicita una conversación nueva. El prompt se envía por stdin.
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=5 \
  luis@omarchy /home/luis/.local/bin/t3 thread start /home/luis/dotfiles - --json < /ruta/local/prompt.txt

# Consultar y continuar una conversación mediante su ID guardado.
ssh luis@omarchy /home/luis/.local/bin/t3 thread show THREAD_ID --messages 50 --json
ssh luis@omarchy /home/luis/.local/bin/t3 thread send THREAD_ID - --json < /ruta/local/continuacion.txt
```

El modelo de T3 es el predeterminado del proyecto, o el indicado con `--provider`
y `--model`. Almacenar enlace e IDs en la conversación o tarjeta Kanban. Si SSH
falla al enviar, verificar el estado antes de repetir: el envío puede haber llegado.
Un turno ocupado puede encolar el siguiente mensaje; verificarlo antes de continuar.

Se comprobó desde home server la creación y continuación de una conversación T3
con Codex, que conservó el contexto. El propio Hermes consultó la conversación y
envió un turno por SSH; T3 respondió correctamente. Codex figuraba disponible;
Pi deshabilitado y Claude sin autenticar en la última caché de T3. Kanban está
vacío y la coordinación automática con T3 o con Omarchy apagada no está implementada.

Plan general: [infraestructura](../../INFRASTRUCTURE-PLAN.md).
