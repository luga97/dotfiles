# Plan de infraestructura de Omarchy y home server

Actualizado: 2026-11-07. Estado: inventario y copias de configuración completados.
T3 en home server suspendido por aclaración de Luis. Hermes instalado con el
instalador oficial directo; servicio activo, Codex autenticado y delegación a Pi
verificada con dos turnos que conservan la misma sesión.

## Retomar después de una compactación

Leer este archivo antes de continuar. La aclaración más reciente de Luis cambia
el diseño: desarrolla y usa T3 principalmente en Omarchy; en home server quiere
clonar y ejecutar los servicios. No ha aprobado instalar T3 allí. Autorizó proceder
con Hermes y delegación a Pi, eligió Codex con su suscripción y el instalador directo.
Hermes v0.23.0 está instalado y autenticado; dirigió dos tareas reales a Pi en
Omarchy continuando la misma sesión y recuperando una clave sin repetirla en el
segundo prompt. El workspace bloquea device-code: usar OAuth normal de navegador
con túnel SSH temporal para el callback; ese túnel ya quedó cerrado.
La solicitud anterior de instalación de T3 quedó
superada por esta aclaración; no repetirla como si solo faltara un sí.
Actualizar las casillas al terminar cada fase y verificar de nuevo los estados
del diagnóstico antes de actuar.

**Prioridad:** servicios persistentes en home server; trabajo personal, de
escritorio o ligado al hardware en Omarchy. T3 permanece en Omarchy; SSH sobre
Tailscale ya permite gestionar home server sin instalar allí T3. Conservar Paseo
hasta validar el flujo móvil y Pi. Hermes en home server queda como asistente
persistente con delegación a Omarchy. Ver [estado y operación](services/hermes/README.md).

**Fuera de alcance por indicación de Luis:** Telegram Bridge y el seguimiento
de correo pertenecen al proyecto CV, que está pausado. Ignorar su inactividad;
no reactivarlos ni tratarlos como incidencias de infraestructura.

**Próximo paso:** usar el circuito instalado y el Dashboard privado de Hermes en
`http://archlinux:9119` (Tailscale conectado, login `luis`).
Luis pidió simplificar a nombre:puerto: bind directo a IP Tailscale, sin HTTPS,
Serve ni túnel SSH adicional. Credenciales conservadas; no añadir intermediarios
de nuevo sin su petición. Falta la prueba desde un teléfono real.
Webapp completa y mensajería siguen sin activar.
El instalador T3 se conserva como referencia, fuera
del trabajo activo. La reconexión de Google Drive sigue pendiente por decisión de Luis.

**Búsqueda:** herramientas nativas del modelo/harness primero; Ketch como alternativa
o para capacidades especializadas. Conservar SearXNG; se propone una instancia en
home server y clientes Ketch donde hagan falta. El servidor tiene DNS roto dentro
del contenedor (aunque su UI responde), por lo que no se retiró la instancia de
Omarchy ni se cambió Ketch, que sigue apuntando a localhost. Ver su [README](services/searxng/README.md).

## Reglas de distribución

- Home server mantiene servicios, datos persistentes, respaldos y automatizaciones
  que deben sobrevivir al apagado de Omarchy.
- Omarchy ejecuta trabajo interactivo, compilaciones pesadas y tareas que necesitan
  su GPU, monitores, micrófono o sesión gráfica. Un servicio dependiente de ese
  hardware puede permanecer allí aunque sea persistente.
- Tailscale conecta las máquinas y el teléfono. SSH permite operar el host remoto;
  no hace falta otro agente para cada comando sencillo.
- T3 es la interfaz principal de desarrollo en Omarchy. Home server recibe versiones
  de servicios para ejecutar; no es otro puesto de desarrollo interactivo. Usar un
  modelo remoto no exige una GPU local.
- Git comunica versiones de código/configuración; SSH permite despliegues y diagnóstico;
  NFS permite acceso a archivos, pero no es el mecanismo de publicación de versiones.
- GitLab Runner y MR review ya procesan código en home server. Aclarar si se conservan
  como automatizaciones persistentes o si los builds se trasladan; no moverlos aún.
- systemd/Docker mantienen los servicios; los respaldos no deben depender de una
  conversación con un agente. Cada automatización debe tener un responsable y
  un único mecanismo de programación activo.
- Compartir dotfiles, reglas y skills no implica compartir sesiones, credenciales
  ni bases de datos de ejecución entre aplicaciones o máquinas.

## Fase 0 — Diagnóstico completado

- [x] Revisar hardware, servicios, agentes, red y documentación existentes.
- [x] Confirmar la regla de distribución ya escrita en la memoria de dotfiles.
- [x] Guardar este plan con referencias desde la memoria y los pendientes.

Estado observado el 2026-11-07:

| Elemento | Omarchy | Home server |
|---|---|---|
| Hardware | Ryzen 5 5600GT, 6 núcleos/12 hilos, 32 GB RAM, Radeon RX 6650 XT dedicada | i7-1165G7, 4 núcleos/8 hilos, 16 GB RAM, Intel Iris Xe integrada |
| Servicios relevantes | Dictado Voxtype, ActivityWatch, Sunshine, Paseo, SearXNG | MR review, GitLab Runner, NFS, SearXNG, Paseo, Project Zomboid |
| T3 Code | App activa; Connect habilitado; LAN deshabilitada; servicio independiente no instalado | No se encontró instalación/proceso |
| Pi | Configuración disponible; T3 lo enumera como proveedor, sin prueba funcional aún | Instalado; MR review lo puede invocar; no necesita proceso permanente en reposo |

T3 no tenía entornos vinculados. Paseo responde en el servidor por la red privada
en `http://100.95.235.26:6767`. Las instancias de Paseo están fijadas a 0.8.0
según su README; no aplicar instrucciones de versiones nuevas sin revisar esa
diferencia. SearXNG y Paseo existen en ambas máquinas: evaluar cada duplicación,
sin asumir que ambas instancias sobran.

La red Tailscale responde en ambas direcciones. SSH Omarchy → home server funciona.
La prueba SSH inversa a `luis@100.110.219.43` se detuvo por falta de confianza en
la clave de host; todavía no se verificó la autenticación inversa.

## Fase 1 — Inventario y pendientes de fiabilidad

- [x] Registrar por servicio: máquina responsable, arranque, puertos, datos,
  respaldo, estado esperado y prueba de salud. Excluir los servicios pausados del CV.
- [x] Incorporar a dotfiles la configuración de Zomboid y respaldos que hoy vive
  fuera del repo, sin secretos ni datos de partidas.
- [ ] Corregir DNS de SearXNG en home server y comprobar búsquedas antes de centralizar.
  También se observó DNS sin upstream en GitLab Runner, sin probar aún un job.
- [ ] Investigar `aw-awatcher` en Omarchy: habilitado pero inactivo; no confundirlo
  con aw-server/media, que sí están activos. Hallazgo documentado, no corregido.
- [ ] Definir retención de respaldos locales: el servidor tenía 27 GB libres y
  88 % del disco ocupado. El script corregido conserva todas las copias locales.
- [ ] Completar la reconexión de Google Drive cuando Luis retome ese pendiente;
  comprobar después una subida y una restauración de prueba.
- [ ] Validar consistencia del respaldo con Zomboid en ejecución y el apagado/arranque
  limpio del servicio, incluido su socket de control.

Trabajo ya realizado sobre Zomboid:

- Servicio habilitado e iniciado; se observaron puertos UDP 16261 y 16262 abiertos.
  No se probó la conexión desde un cliente de juego.
- Copia local de unos 219 MB verificada con `unzip -tq` antes de levantar el juego:
  `/home/pzuser/backups/pz_backup_20261107_211302.zip`.
- `/home/pzuser/backup_pz.sh` ahora detiene la ejecución ante errores, comprueba el
  ZIP, conserva la copia local y devuelve error si falla la subida. Script anterior:
  `/home/pzuser/backup_pz.sh.original`.
- Temporizador diario a las 02:00, hora del servidor. Drive aún falla con
  `invalid_grant`; una ejecución fallida ya no aparece como exitosa.
- El socket falló por un FIFO antiguo. Se añadió
  `/etc/tmpfiles.d/zomboid-control.conf` para limpiarlo al arrancar; falta validar
  esa corrección tras un reinicio. La integridad del ZIP no prueba por sí sola
  la consistencia de la partida.

## Fase 2 — Desarrollo en Omarchy y despliegue en home server

- [x] Preparar instalador de CLI oficial v0.1.7 con checksum y revisar alternativas
  pacman/AUR. Trabajo histórico: instalación suspendida, no es el siguiente paso.
  Ver [referencia](services/t3code/README.md).
- [ ] Definir por servicio el repositorio, versión/commit desplegado, datos y secretos
  locales, comando de publicación, prueba de salud y forma de volver a la versión previa.
- [ ] Probar un flujo completo: editar/probar en Omarchy, publicar en Git, recibir una
  versión identificada en home server, ejecutar con systemd/Compose y verificar salud.
- [ ] Aclarar dónde se ejecutan los builds de servicios y el CI actual, manteniendo
  separado el desarrollo interactivo de las automatizaciones persistentes.
- [ ] Probar Pi desde T3 en Omarchy con sus extensiones. Su aparición
  en el catálogo no demuestra todavía que este flujo funcione.

T3 puede operar el servidor mediante SSH desde Omarchy; no requiere otro T3 allí.
El enlace nativo entre entornos se conserva como alternativa futura si aparece
una necesidad real de sesiones de agente gestionadas por T3 en el servidor.

## Fase 3 — Acceso privado y trabajo entre máquinas

- [ ] Habilitar y probar acceso directo por Tailscale al T3 de Omarchy desde el teléfono
  y mantener el acceso a los servicios privados de home server.
- [ ] Separar el acceso privado a T3/Paseo del endpoint público del webhook de GitLab.
  Evitar sobrescribir el puerto/ruta del Funnel existente al configurar Serve.
- [ ] Retirar el Funnel obsoleto de Omarchy tras verificar sus consumidores.
- [x] Comprobar autenticación y confianza SSH inversas: `luis@omarchy` funciona desde
  home server con StrictHostKeyChecking=yes; no hizo falta copiar claves privadas.
- [ ] Si se incorpora Hermes y delegación a Omarchy, definir cómo queda pendiente un
  trabajo cuando esté apagada y cómo se recoge su resultado sin ejecutarlo dos veces.
  El acceso al T3 de Omarchy requiere que esa máquina y su backend estén encendidos.

Endpoints observados: `archlinux.tail27d0f2.ts.net` publica MR review mediante
Funnel hacia `127.0.0.1:8080`; `/health` devolvió 200. El Funnel de
`omarchy.tail27d0f2.ts.net` apunta también a 8080, sin servicio allí, y devolvió 502.
Tailscale Serve es privado a la tailnet; Funnel da acceso desde Internet.

## Fase 4 — Validar el teléfono y decidir sobre Paseo

- [ ] Probar en T3: envío de tareas, dictado, permisos, revisión de cambios,
  reconexión y reanudación desde el teléfono.
- [ ] Identificar qué funciones de Paseo siguen siendo necesarias y en qué host.
- [ ] Revisar sesiones/tareas pendientes antes de retirar cualquier instancia.
- [ ] Retirar Paseo solo donde haya quedado reemplazado y actualizar el inventario.

T3 y Paseo gestionan sus propias sesiones; compartir el ejecutable Pi no convierte
las conversaciones de ambas aplicaciones en una única sesión.

## Fase 5 — Hermes en home server y delegación a Omarchy

- [ ] Evaluar como primer caso un informe de salud/diagnóstico de servicios y respaldos,
  disponible aunque Omarchy esté apagada. No necesita coordinar desarrollo para aportar valor.
- [x] Instalar Hermes Agent de Nous Research en home server con el instalador directo
  oficial fijado a v0.23.0; iniciar servicio de usuario persistente y documentar arranque.
- [x] Preparar puente SSH a Pi en Omarchy con workers systemd, estado y sesiones propios.
- [x] Probar dos turnos del puente en la misma sesión Pi con contexto conservado.
- [x] Completar login independiente Codex para Hermes (elección de Luis) y probar que
  el propio Hermes envía una tarea al puente, recibe el resultado y continúa la sesión.
- [x] Cambiar el modelo predeterminado de Hermes a `gpt-6.1-terra`, razonamiento
  `high`, verificar catálogo y respuesta real. Pi mantiene su configuración propia.
- [x] Configurar Telegram propio de Hermes: creación automática completada,
  restringido al propietario, conectado por polling y mensaje saliente verificado.
- [ ] Comprobar respuesta a una consulta entrante real por Telegram.
- [x] Elegir acceso al dashboard por Tailscale desde PC y teléfono, con login propio;
  configurar contraseña recibida por formulario privado y verificar el login.
- [x] Activar Dashboard de gestión en loopback 9119, servicio de usuario en home server,
  y dar acceso desde Omarchy por túnel SSH temporal (una hora). HTTP 200 verificado;
  ese acceso inicial quedó reemplazado por HTTP directo `archlinux:9119` en la IP
  de Tailscale con login `luis`. Serve 9119/8443 retirado y túnel SSH detenido;
  Funnel 443 del webhook conservado.
- [ ] Probar el dashboard desde el teléfono con Tailscale conectado. La Webapp
  completa es una superficie separada y no se activó.
- [ ] Mantener scripts, systemd y Compose como mecanismos de ejecución; Hermes puede
  consultar estado, explicar errores y lanzar operaciones explícitas de esos runbooks.
- [x] Implementar Hermes → SSH → T3 en Omarchy: backend explícito, continuidad e
  identidad de thread/run/link. Nueve pruebas de protocolo y consulta SSH real correctas.
- [ ] Probar inferencia completa en una conversación T3 nueva solicitada por Luis.
  Codex listo; Pi figura deshabilitado y Claude sin autenticar en la caché de T3.
- [ ] Si se habilita delegación, probar una tarea completa: recepción, elección de host, espera si Omarchy
  está apagada, ejecución y entrega del resultado.

Hermes está instalado; el puente Pi está probado con continuidad de contexto y el
backend T3 está desplegado, pendiente de inferencia completa. Intervención durante
un turno y coordinación de tareas cuando Omarchy está apagada siguen pendientes.

### Capacidades nativas revisadas antes de ampliar la cola

La documentación oficial y la instalación v0.23.0 incluyen Kanban persistente en
SQLite (tareas, dependencias, asignación, bloqueos, reintentos y límites de concurrencia).
Usarlo como registro duradero de trabajo; no construir una segunda cola offline
en el puente. El estado del puente conserva únicamente identidades/resultados de
ejecución. Falta integrar la disponibilidad de Omarchy y el desbloqueo/despacho
seguro: Kanban por sí solo no detecta que un PC remoto volvió a estar disponible.

Otras superficies distintas: `/queue` guarda el siguiente mensaje de la conversación;
cron programa tareas autónomas con entrega por Telegram (también scripts sin LLM);
`/goal` mantiene un objetivo dentro de una sesión; `/heartbeat` y `/loop` sirven para
seguimiento dentro de esa conversación. Memoria para hechos/preferencias, skills
para procedimientos y perfiles para separar configuración/memoria/herramientas.

Consulta de estado: sin jobs cron, tablero Kanban sin tarjetas y solo perfil
`default`. Recomendación por evaluar, sin activar automatizaciones todavía:
1. Informe/alertas de salud con scripts y cron nativo, respetando timers de respaldo.
2. Tablero Kanban y perfiles de operaciones/desarrollo con concurrencia acotada.
3. Comprobación de disponibilidad sin LLM, despacho T3 único, enlace y resultado
   registrados en la tarjeta, notificación Telegram y tratamiento explícito de envíos inciertos.

Fuentes: [Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban),
[cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron),
[comandos](https://hermes-agent.nousresearch.com/docs/reference/slash-commands),
[perfiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles).

## Referencias

- [Inventario de servicios](README.md) y README de cada servicio.
- [Memoria compartida](../agents/.pi/agent/memory/MEMORY.md).
- [Conectividad de Paseo](https://paseo.sh/docs/connectivity.md).
- [Voz en Paseo](https://paseo.sh/docs/voice.md).
- [Herramientas y ejecución SSH de Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools).
- [Mensajería de Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/messaging).
- [Tailscale Serve](https://tailscale.com/kb/1242/tailscale-serve).
