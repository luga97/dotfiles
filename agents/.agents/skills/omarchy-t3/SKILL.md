---
name: omarchy-t3
description: Consultar o delegar mediante T3 en Omarchy desde home server cuando la petición se refiere a proyectos, validaciones, estado o trabajo que vive en Omarchy. Usar al necesitar interactuar con T3 o sus conversaciones desde otra máquina; elegir primero las capacidades nativas adecuadas al trabajo.
---

# T3 en Omarchy desde home server

Omarchy es la máquina personal de Luis, con proyectos y T3; home server aloja
servicios persistentes. Usa esta vía para proyectos que viven en Omarchy, para
consultar su estado o realizar validaciones allí. Para trabajo en home server o
subtareas que Hermes pueda resolver con sus propias herramientas y subagentes,
elige la herramienta más apropiada sin pasar por T3 por defecto. Estamos explorando
este flujo: adapta las decisiones a lo que funcione y evita añadir puentes propios
si las herramientas existentes bastan.

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

Si Omarchy no está disponible, informa y registra el pendiente si procede. Hermes
cuenta con Kanban nativo, pero la detección de disponibilidad y el desbloqueo o
reintento automático aún no están integrados. No los presentes como funcionando.
