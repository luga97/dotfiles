# Instrucciones Globales — Luis

## Idioma
Responde siempre en **español neutro** (sin regionalismos de España, Argentina u otros países: usa *tú*, no *vos* ni *vosotros*; evita *vale*, *che*, *ordenador*, etc.), salvo que el usuario explícitamente te pida otro idioma. Si citas términos técnicos en inglés, tradúcelos o acláralos la primera vez.

## Estilo de Trabajo
- Sé conciso pero completo. Evita respuestas excesivamente largas sin necesidad.
- Cuando edites código, explica **qué cambiaste y por qué**, no solo el diff.
- Prefiere soluciones simples sobre complejas. Solo introduce abstracciones cuando el código lo demande.
- Antes de proponer cambios arquitectónicos mayores, pregunta al usuario.

## Código
- Escribe código limpio, legible y bien comentado donde sea necesario.
- Respeta las convenciones del proyecto existente (indentación, naming, estructura).
- Nunca dejes código comentado como "respaldo"; usa el control de versiones para eso.
- Si una función crece demasiado, sugiérela dividir, pero espera confirmación antes de refactorizar.

## Terminal
- Prefiere soluciones que no dependan de herramientas externas innecesarias.
- Cuando ejecutes comandos, muestra el comando y luego el resultado.
- Si un comando es destructivo (rm, drop, etc.), confirma antes de ejecutar.

## Documentación
- Actualiza docs junto con el código, nunca por separado.
- Los READMEs deben tener ejemplos de uso concretos, no solo descripciones abstractas.

## Servicios y daemons (dotfiles, carpeta services/)
- `~/dotfiles/services/` respalda TODO servicio o daemon que corre constantemente en el setup de Luis — Docker (docker-compose) y nativos (unidades systemd user). Paquete stow `services`, enlazado a `~/services/`.
- Docker: `services/services/<nombre>/` con `docker-compose.yml`, datos en subdirectorios propios, `.env` con secretos (gitignored) y `.env.example` trackeado. `restart: unless-stopped`, puertos en `127.0.0.1` salvo acceso externo.
- Nativos (solo si el servicio necesita acceso al host: CLIs de agentes, git/SSH, etc.): unidad en `services/.config/systemd/user/<nombre>.service` (stow la enlaza a `~/.config/systemd/user/`), notas de setup en `services/services/<nombre>/README.md`, secretos en un env local del host referenciado con `EnvironmentFile=` (nunca en el repo).
- Al agregar un servicio: crear los archivos, `stow -R services` desde `~/dotfiles`, levantar (`docker compose up -d` o `systemctl --user enable --now`), y actualizar la tabla de servicios del README.

## Paseo (daemon nativo, ejemplo del patrón)
- Paseo (https://paseo.sh, controla agentes de código desde móvil/web) corre NATIVO: el daemon debe ver pi, ~/.pi y git del host.
- Instalado con `npm install -g @getpaseo/cli --allow-scripts=esbuild,node-pty`; unidad systemd user en `~/dotfiles/services/.config/systemd/user/paseo.service` (stoweada), con `paseo start --foreground --web-ui`.
- Contraseña en `~/.config/paseo/paseo.env` (fuera del repo); estado en `~/.paseo`. Notas en `~/dotfiles/services/services/paseo/README.md`. Web UI: http://localhost:6767.
