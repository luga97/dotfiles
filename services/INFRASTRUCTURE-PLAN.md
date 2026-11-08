# Plan de infraestructura de Omarchy y home server

Actualizado: 2026-11-07. Estado: diagnóstico guardado; migración no iniciada.

## Retomar después de una compactación

Leer este archivo antes de continuar. El pedido más reciente fue guardar el
plan por fases, no ejecutar la migración. Actualizar las casillas al terminar
cada fase y verificar de nuevo los estados del diagnóstico antes de actuar.

**Prioridad:** servicios persistentes en home server; trabajo personal, de
escritorio o ligado al hardware en Omarchy. Preparar T3 Code para las dos
máquinas antes de añadir otro coordinador. Conservar Paseo hasta validar el
flujo móvil y Pi. Hermes es una propuesta opcional, todavía no está instalado.

**Fuera de alcance por indicación de Luis:** Telegram Bridge y el seguimiento
de correo pertenecen al proyecto CV, que está pausado. Ignorar su inactividad;
no reactivarlos ni tratarlos como incidencias de infraestructura.

**Próximo paso de implementación:** completar la fase 1 y preparar T3 persistente
en home server. La reconexión de Google Drive quedó pendiente por decisión de Luis.

## Reglas de distribución

- Home server mantiene servicios, datos persistentes, respaldos y automatizaciones
  que deben sobrevivir al apagado de Omarchy.
- Omarchy ejecuta trabajo interactivo, compilaciones pesadas y tareas que necesitan
  su GPU, monitores, micrófono o sesión gráfica. Un servicio dependiente de ese
  hardware puede permanecer allí aunque sea persistente.
- Tailscale conecta las máquinas y el teléfono. SSH permite operar el host remoto;
  no hace falta otro agente para cada comando sencillo.
- T3 es la interfaz principal propuesta. Pi, Codex y otros proveedores ejecutan
  tareas en el host elegido. Usar un modelo remoto no exige una GPU local.
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

- [ ] Registrar por servicio: máquina responsable, arranque, puertos, datos,
  respaldo, estado esperado y prueba de salud. Excluir los servicios pausados del CV.
- [ ] Incorporar a dotfiles la configuración de Zomboid y respaldos que hoy vive
  fuera del repo, sin secretos ni datos de partidas.
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

## Fase 2 — T3 persistente en home server

- [ ] Preparar T3 como servicio supervisado y documentado en dotfiles, con acceso
  a proyectos y proveedores del servidor; comprobar que funciona sin sesión gráfica.
- [ ] Conservar T3 en Omarchy para trabajo personal y ejecución ligada a su hardware.
- [ ] Vincular los entornos de ambas máquinas y probar una tarea sencilla por host,
  con resultado, registros y permisos identificables.
- [ ] Probar Pi desde T3 con la configuración y extensiones existentes. Su aparición
  en el catálogo no demuestra todavía que este flujo funcione.

La CLI instalada contempla `t3 serve`, `t3 up`, `t3 service`,
`t3 environment link/list`, `--lan`, `--tailscale-serve` y
`--tailscale-serve-port`. Consultar su ayuda vigente al implementar. Los cambios
de servicio pueden reiniciar T3: tener en cuenta la conversación activa.

## Fase 3 — Acceso privado y trabajo entre máquinas

- [ ] Habilitar y probar acceso directo por Tailscale desde el teléfono y entre hosts.
- [ ] Separar el acceso privado a T3/Paseo del endpoint público del webhook de GitLab.
  Evitar sobrescribir el puerto/ruta del Funnel existente al configurar Serve.
- [ ] Retirar el Funnel obsoleto de Omarchy tras verificar sus consumidores.
- [ ] Completar la confianza y autenticación SSH inversas si el diseño las necesita.
- [ ] Definir cómo queda pendiente un trabajo dirigido a Omarchy cuando esté apagada,
  y cómo se identifica, reintenta y recoge su resultado sin ejecutarlo dos veces.

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

## Fase 5 — Hermes opcional en home server

- [ ] Definir un primer caso concreto de asistente persistente que aporte valor
  adicional al flujo ya validado con T3.
- [ ] Si procede, configurar Hermes Agent de Nous Research en home server, con
  memoria, mensajería y tareas propias claramente delimitadas.
- [ ] Elegir una vía de ejecución remota: SSH para comandos; Pi o integración con
  T3 para tareas de agente. Validar esa integración antes de depender de ella.
- [ ] Probar una tarea completa: recepción, elección de host, espera si Omarchy
  está apagada, ejecución y entrega del resultado.

Hermes todavía no está instalado ni existe una integración Hermes → T3/Pi. No
asumir que la documentación de sus capacidades equivale a una integración lista.

## Referencias

- [Inventario de servicios](README.md) y README de cada servicio.
- [Memoria compartida](../agents/.pi/agent/memory/MEMORY.md).
- [Conectividad de Paseo](https://paseo.sh/docs/connectivity.md).
- [Voz en Paseo](https://paseo.sh/docs/voice.md).
- [Herramientas y ejecución SSH de Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools).
- [Mensajería de Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/messaging).
- [Tailscale Serve](https://tailscale.com/kb/1242/tailscale-serve).
