# SearXNG y Ketch

Decisión de uso de Luis (2026-11-07): conservar la capacidad de búsqueda propia,
priorizando las herramientas de búsqueda y lectura nativas del modelo/harness.
Ketch se usa si no están disponibles, no bastan para la tarea, se necesita una
superficie especializada o Luis lo pide explícitamente. Esta prioridad ya está
definida en la skill compartida `web-research`.

## Responsabilidades y ubicación propuesta

- SearXNG es un metabuscador: consulta motores externos y reúne sus resultados;
  no mantiene un índice web completo propio ni sustituye la extracción de páginas.
- Ketch es un cliente CLI bajo demanda, con `search`, `scrape`, `crawl`, `code` y
  `docs`. La búsqueda general puede usar SearXNG; extracción, código y documentación
  tienen sus propios caminos y no dependen todos de SearXNG.
- Mantener una instancia principal de SearXNG en home server, accesible solo por
  la red privada. Ketch puede ejecutarse en cada host donde trabajen agentes.
  La extracción de páginas se ejecuta donde se lance Ketch; no se traslada toda
  la carga de scraping al servidor por cambiar la URL del buscador.
- La prioridad nativa es una regla del agente: seleccionar `backend=searxng` en
  Ketch no altera la elección de herramientas nativas de cada harness.

## Estado comprobado

Revisión 2026-11-07:

- Ambas máquinas tienen un contenedor y publican `127.0.0.1:8081` → 8080.
- Omarchy: Ketch `0.14.0-obscura.1`, paquete propio del fork `Algorant/ketch`;
  `backend=searxng`, `searxng_url=http://localhost:8081`. Su configuración contiene
  credenciales locales para otros proveedores; no copiar el archivo completo a Git.
- Ketch no se encontró en el PATH normal ni en una shell login de home server.
- La interfaz SearXNG da HTTP 200 en ambas máquinas, pero eso no prueba la búsqueda.
- Una búsqueda directa JSON en Omarchy devolvió 15 resultados; Mojeek/Qwant estaban
  suspendidos por acceso denegado. Una consulta con Ketch también devolvió resultados.
- La búsqueda JSON del servidor devolvió cero resultados y errores de conexión
  con los seis motores consultados. `socket.getaddrinfo` falla dentro del contenedor
  con `EAI_AGAIN`, mientras el host resuelve y obtiene HTTP 200 de Wikipedia.
- `/etc/resolv.conf` del contenedor usa `127.0.0.11` y dice
  `NO EXTERNAL NAMESERVERS DEFINED`; no hay override DNS en Docker. El contenedor
  GitLab Runner muestra la misma ausencia de upstream, sin prueba funcional de DNS
  o CI todavía. No atribuirle un fallo de job sin verificarlo.
- Consultas DNS UDP directas desde el contenedor a `100.100.100.100`, `1.1.1.1`
  y `9.9.9.9` respondieron con código 0 y dos respuestas para Wikipedia. Existe
  conectividad hacia resolvers; el fallo está en el camino DNS configurado del
  contenedor. Tailscale DNS es una opción comprobada antes de elegir un override.

## Centralización pendiente

Este pedido fue de análisis: no se cambió el endpoint de Ketch ni se detuvo la
instancia de Omarchy. Retirarla ahora rompería su fallback configurado a localhost.

1. Corregir DNS del contenedor del servidor de forma reproducible y comprobar
   búsqueda con resultados, no solo HTTP 200. Investigar la inicialización DNS de
   Docker/Tailscale y fijar una solución que sobreviva al arranque. No reiniciar
   todo Docker sin revisar los otros servicios.
2. Preparar un endpoint privado para SearXNG (por ejemplo Tailscale Serve HTTPS
   8444 hacia `127.0.0.1:8081`), manteniendo Funnel 443 de GitLab independiente.
3. Probarlo desde Omarchy y cambiar solo `searxng_url` de Ketch. Conservar sus
   credenciales/proveedores y comprobar `search`, `scrape` y rutas especializadas
   según sea necesario.
4. Comprobar los otros consumidores de localhost:8081. Tras validarlos, detener
   la instancia local de SearXNG conservando la configuración para reconstrucción.
5. Confirmar que el uso normal sigue prefiriendo la búsqueda nativa. Si home server
   no está disponible, informar que falla ese fallback; no iniciar otra instancia
   o cambiar de proveedor silenciosamente.

Compose y settings están versionados. `.env` es local y contiene el secreto;
la caché no necesita respaldo para reconstruir el servicio.

Referencias: [Ketch](https://ketch.run/),
[fork instalado](https://github.com/Algorant/ketch),
[motores de SearXNG](https://docs.searxng.org/dev/engines/engine_overview.html),
[inventario](../../INVENTORY.md).
