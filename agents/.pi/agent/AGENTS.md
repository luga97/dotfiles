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

## Memoria de pi

- La memoria del agente (`~/.pi/agent/memory/`) se sincroniza vía git a un repo **público**. Nunca guardes ahí credenciales, tokens, claves, ni datos personales identificables (nombres reales, teléfonos, direcciones, mails). Si el usuario te pide guardar algo de ese tipo, advírtelo y ofrece una alternativa (variable de entorno, archivo local gitignored).

## Terminal
- Prefiere soluciones que no dependan de herramientas externas innecesarias.
- Cuando ejecutes comandos, muestra el comando y luego el resultado.
- Si un comando es destructivo (rm, drop, etc.), confirma antes de ejecutar.

## Documentación
- Actualiza docs junto con el código, nunca por separado.
- Los READMEs deben tener ejemplos de uso concretos, no solo descripciones abstractas.
