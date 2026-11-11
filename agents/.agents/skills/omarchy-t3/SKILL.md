---
name: omarchy-t3
description: Consultar o delegar mediante T3 en Omarchy desde home server cuando la petición se refiere a proyectos, validaciones, estado o trabajo que vive en Omarchy. Usar al necesitar interactuar con T3 o sus conversaciones desde otra máquina; elegir primero las capacidades nativas adecuadas al trabajo.
---

# T3 en Omarchy desde home server

Omarchy es la máquina personal de Luis, con proyectos y T3; home server aloja
servicios persistentes. Luis prefiere que todo trabajo que deba realizarse en
Omarchy se delegue a Omar. Usa el peer nativo de Omar para encargarle el alcance,
las restricciones y las pruebas, y conserva el ID de ejecución; consulta su resultado
antes de darlo por terminado. Una ejecución iniciada no demuestra que se haya
completado. Consulta `hermes peer list` y la ayuda de `hermes peer run` y `status`;
usa una clave de idempotencia estable y no reenvíes a ciegas si el resultado es
incierto. Si Omar no está disponible, informa del bloqueo y no lo sustituyas
silenciosamente por ejecución directa o T3. Para trabajo en home server elige la
herramienta o subagente apropiado sin pasar por Omarchy.

Los comandos de T3 siguientes son una referencia para cuando Luis solicite o
acuerde expresamente esa vía; no sustituyen la delegación ordinaria a Omar.

Desde home server, SSH usa `luis@omarchy`; T3 está en `/home/luis/.local/bin/t3`.
Consulta `t3 thread --help` o la ayuda del subcomando si necesitas opciones actuales.
Para tareas de proyecto usa una ruta absoluta de un proyecto registrado en T3.

```bash
# Consulta de disponibilidad y proyecto (no crea conversación).
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=5 \
  luis@omarchy /home/luis/.local/bin/t3 thread list --project /home/luis/dotfiles --json

# Nueva conversación, con prompt desde archivo local y no interpolado en shell.
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=5 \
  luis@omarchy /home/luis/.local/bin/t3 thread start /home/luis/dotfiles - --json < /ruta/local/prompt.txt

# Consulta y continuación: sustituye el ID por el devuelto por T3.
ssh luis@omarchy /home/luis/.local/bin/t3 thread show THREAD_ID --messages 50 --json
ssh luis@omarchy /home/luis/.local/bin/t3 thread send THREAD_ID - --json < /ruta/local/continuacion.txt
```

Para texto y rutas variables utiliza argumentos separados o entrada estándar;
no interpolar contenido del usuario en una cadena de shell. T3 utiliza los defaults
del proyecto; `--provider ID --model SLUG` selecciona ambos explícitamente. No
asumas que un proveedor está habilitado o autenticado: compruébalo ante errores.

Conserva `threadId`, `runId` y el enlace completo en la conversación o tarjeta
Kanban, y consulta T3 antes de declarar que una tarea acabó. Si espera permisos o
respuesta, informa; si la conexión falla durante el envío, consulta antes de volver
a enviar: podría haber llegado. No reintentes una operación de estado incierto a
ciegas. Un hilo ocupado puede encolar un turno: consulta su estado al continuarlo.

Si Omarchy o T3 no responden **antes de intentar el envío**, informa a Luis y
registra la tarea para ejecutarla cuando vuelvan. Usa Kanban en el tablero default:
crea la tarjeta con `hermes kanban create`, `--assignee default`,
`--tenant omarchy-pre-envio`, `--initial-status blocked` y `--max-retries 1`.
Usa `--body-file` para el encargo; incluye contexto, el proyecto en Omarchy,
criterio de resultado, que compruebe T3 antes de enviar, que nunca reenvíe un
envío incierto y que registre enlace, IDs y resultado. Reutiliza una misma
`--idempotency-key` si debes repetir la creación de la tarjeta.

El cron nativo `omarchy-kanban-recovery` comprueba cada cinco minutos SSH y T3,
sin llamar al modelo. Solo desbloquea tarjetas de ese tenant, asignadas al perfil
default, con un intento máximo, creadas inicialmente bloqueadas y sin ninguna
ejecución ni evento posterior, y con una suscripción de notificación al Telegram
del propietario. El dispatcher de Kanban hará el resto. Si la máquina
vuelve a caerse tras desbloquear, o el envío llega a ser incierto, el worker debe
bloquear para revisión: el cron no reactivará tarjetas con historial de ejecución.
No prometas reintentos ilimitados ni recuperación automática de envíos inciertos.

Suscribe la tarjeta al DM personal de Telegram antes de que el cron pueda liberarla.
La CLI `hermes kanban notify-subscribe` admite `--platform telegram`, `--chat-id`
y `--chat-type dm`; para el DM personal, el usuario propietario está en el archivo
privado `~/.hermes/telegram-bot-info.json` (`owner_user_id`). No publiques tokens.
La suscripción es necesaria porque las tarjetas creadas mediante CLI JSON no se
suscriben automáticamente. Usa `--delivery-mode notify`. El cron avisa cuando
desbloquea una tarjeta y la suscripción entrega su estado terminal.
