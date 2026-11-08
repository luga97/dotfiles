---
name: project-zomboid
description: Use when gestionar Zomboid. Diagnostica con seguridad.
---

# Project Zomboid en home server

Usa esta skill para diagnosticar o planificar operaciones del servidor de juego, partidas, mods, respaldo y recuperación. Complementa `dotfiles-services`. Antes de cualquier conclusión consulta `~/dotfiles/services/services/project-zomboid/README.md`, `~/dotfiles/services/INFRASTRUCTURE-PLAN.md`, `~/dotfiles/services/INVENTORY.md`, el tablero y el estado real; sus observaciones pueden ser históricas.

## Límites y responsabilidades

Diagnóstico en solo lectura por defecto. Solicita autorización específica antes de parar o reiniciar, escribir al FIFO, cambiar configuración o mods, crear o restaurar partidas, borrar o mover datos, reautorizar Drive, abrir puertos o iniciar una subida. Identifica instancia, jugadores afectados, destino, respaldo recuperable y vuelta atrás. No accedas a secretos ni los expongas. Un perfil de agente no es aislamiento de permisos del sistema.

Infra es responsable de salud, disco y alertas generales; evita cron o tareas duplicadas. El timer existente es el programador del respaldo salvo decisión explícita en contrario. El juego y sus scripts/unidades son los ejecutores, no el agente.

## Inspección

El README describe unidades de sistema `zomboid.service`, `zomboid.socket`, `pz-backup.service` y `pz-backup.timer`, juego como `pzuser`, binarios en `/opt/pzserver`, datos en `/home/pzuser/Zomboid` y copias en `/home/pzuser/backups`. Son referencias, no garantías: confirma rutas, propietario, unidades, puertos y configuración activos antes de actuar. Las copias de `host-files` son referencias históricas y no deben aplicarse como configuración.

Revisa estado y journal de servicio, socket y timer, próxima ejecución, espacio libre y escucha; distingue proceso activo de conexión real de jugador. Solicita permisos necesarios para ver copias sin mostrar credenciales. Reporta hora y límites de visibilidad. El FIFO tuvo un problema histórico y la corrección no había sido validada tras reinicio; no supongas que funciona ni provoques un reinicio para probarlo sin autorización.

## Respaldos y restauración

Distingue ZIP local validado, consistencia de la partida mientras el servidor escribe, subida remota confirmada y restauración aislada probada. Son evidencias diferentes. `invalid_grant` no prueba cuándo fue la última copia remota válida. Nunca presupongas que el juego queda coherente por pasar `unzip -tq`. Antes de cambios planifica y acuerda copia consistente y recuperación; no borres copias ni establezcas retención sin autorización. El acceso OAuth debe hacerse de forma privada y con la cuenta y permisos verificados por Luis.

Para reconectar rclone en un servidor sin navegador, tras autorización específica utiliza una terminal privada del usuario y un túnel SSH temporal a `127.0.0.1:53682`; ejecuta `rclone config reconnect drive:` como el usuario real del servicio y deja que Luis complete Google en su navegador. No solicites ni compartas tokens, códigos ni URL de sesión. Si el diálogo se interrumpe después del callback, comprueba primero el acceso al destino como ese usuario: la credencial podría ya haberse guardado.

Para comprobar escritura, pide autorización separada y acuerda alcance y reversión; sube un ZIP local existente al destino previsto sin sobrescribir otros objetos. Lee de vuelta exactamente el objeto creado y compara tamaño y checksum con el local; una coincidencia verifica la transferencia, no una restauración. Conserva el objeto de prueba salvo autorización específica para borrarlo. Una subida manual no cambia el resultado previo de systemd ni demuestra que la siguiente ejecución programada funcione.

Para probar recuperación, acuerda primero destino aislado, espacio y limpieza: descarga el objeto remoto a un directorio privado nuevo, compara su checksum con el ZIP local y valida que ninguna entrada sea absoluta, atraviese directorios o sea un enlace simbólico antes de extraerla. Verifica extracción y estructura sin leer ni divulgar contenido sensible; informar de extracción correcta, no de partida funcional, hasta probarla en una instancia separada. Advierte si el directorio temporal está sujeto a limpieza automática; elimina los artefactos solo con autorización.

Para implementar retención, inventaría por separado copias locales y remotas, incluidos nombres manuales; acuerda cuáles cuentan, el orden y qué borrar. Simula y muestra los candidatos antes de modificar scripts o eliminar archivos, conserva el programador existente y explica que revertir la configuración no recupera copias borradas. Tras una subida, verifica tamaño y checksum del respaldo nuevo en el destino antes de borrar; detén la limpieza si hay nombres remotos duplicados, falta la copia nueva o falla la verificación. Prueba con datos sintéticos el orden, el límite y la protección de la copia nueva; verifica después el inventario real de ambos destinos. Conserva una copia del script anterior y distingue la aplicación manual de la primera ejecución automática, que debe comprobarse por separado. No consideres aplicada una política únicamente porque Luis haya expresado un límite.

## Partidas y mods

Acordar si la nueva partida debe coexistir simultáneamente o alternarse, nombres inequívocos, identidad y rutas de la actual, jugadores y cuentas, versión, mapa, sandbox, lista de mods, recursos y accesibilidad. Verifica separación efectiva de guardados, configuración, bases de jugadores y puertos antes de escribir o iniciar otra instancia. Propón copia recuperable, ventana de interrupción, prueba y vuelta atrás; no asumas que compartir o separar configuración es seguro sin inspección. Compara requisitos y compatibilidad reales de mods antes de cambiarlos; no descargues ni apliques modificaciones sin autorización.

## Informe

Resume estado comprobado y su fecha, riesgos, acciones realizadas y pendientes, distinguiendo hipótesis de pruebas. Para cada intervención propone alcance exacto y pide aprobación antes de ejecutarla.
