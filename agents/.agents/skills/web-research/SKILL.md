---
name: web-research
description: "Investigar preguntas que requieren información externa y actual: noticias, opiniones, comparaciones, documentación vigente, fuentes primarias o ejemplos públicos. Úsala siempre que la respuesta dependa de buscar o verificar información en la web. Prioriza las herramientas de búsqueda e investigación integradas del modelo; recurre a ketch solo si no están disponibles, no bastan para la tarea o el usuario pide ketch explícitamente. No usar para buscar en el repositorio local ni en páginas privadas/autenticadas."
---

# Investigación web

Resuelve preguntas que necesitan fuentes externas actuales. **Orden de preferencia: herramientas de búsqueda/investigación integradas en la sesión primero; ketch como alternativa.** La presencia de ketch instalado o de sus herramientas MCP no cambia esta prioridad.

## Flujo

1. **Decide si hace falta investigar en la web.** Si la respuesta depende de información reciente, de fuentes externas, de opiniones de terceros, de documentación que puede haber cambiado o de corroboración factual, investiga. Para conocimiento estable que puedas responder con confianza, no busques por rutina.
2. **Revisa las herramientas disponibles en esta sesión.** Si hay búsqueda web integrada, úsala primero. Aprovecha también las herramientas nativas de abrir/leer páginas cuando existan. No invoques ketch en paralelo para repetir una búsqueda nativa que ya funciona.
3. **Busca con alcance proporcional.** Una pregunta concreta suele necesitar una búsqueda y algunas fuentes; amplía a varias consultas si es compleja, disputada o de varias partes. Prioriza fuentes primarias, recientes y directamente pertinentes. Corrobora afirmaciones importantes cuando la primera fuente sea secundaria o haya versiones en conflicto.
4. **Usa ketch solo si hace falta.** Recurre a él si no hay búsqueda nativa, si la búsqueda nativa falla o no puede acceder al contenido, o si la tarea necesita una capacidad especializada que no está disponible nativamente (por ejemplo, búsqueda de código público, documentación de bibliotecas con Context7 o rastreo acotado de un sitio). Si el usuario pide ketch explícitamente, úsalo.
5. **Entrega una síntesis con fuentes.** Cita las fuentes junto a las afirmaciones que respaldan. Separa hechos comprobados, opiniones atribuidas e incertidumbres; señala desacuerdos relevantes. No presentes un fragmento de resultados como si hubieras leído la página completa.

## Qué cuenta como herramienta nativa

Son herramientas de búsqueda o navegación que el modelo actual expone directamente en la sesión (por ejemplo, búsqueda web, navegador o recuperación web integrada). Usa sus propios esquemas y patrones de citación; no supongas nombres de herramientas ni intentes instalarlas. Si solo hay herramientas locales o de código y ninguna permite buscar en la web, considera que no hay búsqueda nativa.

## Alternativa: ketch

Antes de usarlo, comprueba si está disponible en la sesión:

- Si existe el binario, usa el CLI: `command -v ketch`; el CLI es el transporte preferido para ketch.
- Si no existe el CLI, comprueba si están expuestas herramientas MCP de ketch (`search`, `code`, `docs`, `scrape`, `crawl`).
- Si no hay ninguno, informa que no hay una vía de búsqueda disponible; no instales herramientas ni cambies la configuración sin autorización.

Cuando uses el CLI, usa salida JSON (`--json`) y consulta `ketch --help` o `ketch <comando> --help` si dudas de la sintaxis. `ketch config` es una consulta de solo lectura útil para ver proveedores disponibles. No cambies configuración, instales componentes ni inicies rastreos persistentes sin confirmación del usuario.

### Elige la superficie adecuada

| Necesidad | Superficie de ketch | Pauta |
| --- | --- | --- |
| Encontrar páginas web, noticias, opiniones o comparaciones | `search` | Limita resultados; cambia de proveedor si uno falla. |
| Leer URLs conocidas | `scrape` | Limita cada página con `--max-chars` y `--trim`; no vuelvas a buscar una URL que ya tienes. |
| Encontrar usos en código fuente público | `code` | Filtra por lenguaje cuando sea útil; no sirve para repositorios privados. |
| Consultar documentación de una biblioteca | `docs` | Primero resuelve el nombre y verifica que la biblioteca encontrada sea la correcta; luego consulta por su ID. |
| Leer varias páginas de un mismo sitio | `crawl` | Mantén el alcance acotado con profundidad y filtros; úsalo solo cuando varias páginas sean necesarias. |

Ejemplos de CLI (confirma las opciones con `--help` si la versión difiere):

```bash
ketch search "consulta concreta" --limit 5 --json
ketch scrape https://example.com/guia --max-chars 6000 --trim --json
ketch code "nombreDeFuncion" --lang go --limit 3 --json
ketch docs "nombre de biblioteca" --resolve --json
ketch docs "tema a consultar" --library "/id/verificado" --tokens 4000 --json
```

En una búsqueda de nombre de dominio sin ruta, ketch puede devolver automáticamente `/llms.txt` en vez de la portada; usa una URL concreta o `--no-llms-txt` cuando necesites el contenido de la portada. En raspados por lotes, revisa cada resultado: un error por URL puede venir dentro de una respuesta general exitosa.

### Límites y errores con ketch

- Limita los resultados de búsqueda y código. En raspados de páginas desconocidas, usa `--max-chars 4000–8000` junto con `--trim`; no solicites contenido ilimitado salvo que haya una razón concreta.
- En `docs`, usa un presupuesto de tokens razonable y valida el nombre/ID de la biblioteca antes de consultar.
- Si falla un proveedor, no repitas sin cambios indefinidamente: revisa el error, prueba otro proveedor disponible o reduce el alcance. No alteres la configuración para resolver un fallo sin autorización.
- Las herramientas MCP de ketch pueden usarse si se eligieron como transporte; respeta sus esquemas y revisa errores por página. No uses CLI y MCP para hacer en paralelo la misma búsqueda.
- No uses `crawl --background` para una consulta normal: los rastreos persistentes y otras acciones de operación requieren una necesidad explícita y autorización.

## Fuera de alcance

No uses esta skill para buscar código en el repositorio local (usa herramientas del repositorio), para acceder a páginas autenticadas/privadas o de pago, ni para instalar/configurar software. La investigación debe respetar las restricciones de acceso y atribuir las fuentes; no intentes evadir controles de acceso.
