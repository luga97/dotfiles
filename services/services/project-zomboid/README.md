# Project Zomboid en home server

Servidor de juego nativo de sistema, ejecutado como `pzuser`. Este directorio
guarda copias de referencia obtenidas del host el 2026-11-07; no instala unidades
ni cambia el servicio mediante Stow. Las unidades de sistema continúan en `/etc`.

## Archivos respaldados

Las copias en `host-files/` conservan el contenido del host, incluidos los problemas
todavía pendientes de validar. No aplicarlas como si fueran una configuración nueva
ya corregida.

| Ruta instalada | Copia versionada |
|---|---|
| `/etc/systemd/system/zomboid.service` | `host-files/etc/systemd/system/zomboid.service` |
| `/etc/systemd/system/zomboid.socket` | `host-files/etc/systemd/system/zomboid.socket` |
| `/etc/systemd/system/pz-backup.service` | `host-files/etc/systemd/system/pz-backup.service` |
| `/etc/systemd/system/pz-backup.timer` | `host-files/etc/systemd/system/pz-backup.timer` |
| `/etc/tmpfiles.d/zomboid-control.conf` | `host-files/etc/tmpfiles.d/zomboid-control.conf` |
| `/home/pzuser/backup_pz.sh` | `host-files/home/pzuser/backup_pz.sh` |

No se incluyen partidas, bases de jugadores, contraseñas del servidor, claves ni
tokens de rclone. El usuario/grupo `pzuser`, los binarios y los datos deben existir
en el host para que estas unidades funcionen.

## Arranque y estado verificado

- Unidad del juego habilitada: `zomboid.service`; binarios en `/opt/pzserver`.
- Proceso activo y UDP 16261/16262 escuchando; no se probó conexión de un jugador.
- Control mediante FIFO `/opt/pzserver/zomboid.control` y `zomboid.socket`.
  El socket seguía fallido por un FIFO antiguo cuando se hizo esta copia.
- Datos en `/home/pzuser/Zomboid`: `Saves`, `Server` y `db`.

## Respaldos y límites actuales

`pz-backup.timer` está habilitado, es persistente y ejecuta todos los días a las
02:00 (hora local del servidor) `pz-backup.service` como `pzuser`.

El script crea una copia en `/home/pzuser/backups`, valida la estructura del ZIP
con `unzip -tq` y luego intenta subirla con rclone al remoto `drive:ZomboidBackups`.
Conserva la copia local y devuelve error si la subida falla. El 2026-11-08 Luis
reconectó Drive; se verificó una subida manual comparando tamaño y MD5 remoto/local.
La siguiente ejecución programada aún debe comprobarse. Tras una subida, el script
invoca `/home/pzuser/pz-retention.py --apply` para conservar hasta 10 archivos
`pz_backup*.zip` más recientes tanto locales como remotos. Incluye nombres manuales,
ordena por fecha de modificación y no toca otros archivos. Antes de borrar comprueba
que la copia actual existe en Drive y coincide en tamaño y MD5; ante error devuelve
fallo. El script previo queda en `/home/pzuser/backup_pz.sh.pre-retention`; volver a
él revierte la política, pero no recupera objetos eliminados. No cambia el timer.

La copia local creada antes de iniciar el juego el 2026-11-07 sigue presente:
`pz_backup_20261107_211302.zip`, 229337302 bytes. Se verificó el ZIP en la
intervención inicial, pero no se hizo una restauración de prueba.

Pendientes:

- Comprobar la ejecución programada y la retención instaladas el 2026-11-08;
  en la aplicación inicial quedaron 2 ZIP locales y 10 remotos.
- Asegurar consistencia al copiar una partida mientras el juego está activo.
  La comprobación del ZIP solo detecta integridad del archivo, no coherencia de
  la partida. El script no coordina `save` ni pausa/cierre del juego.
- Validar apagado y arranque limpio, incluidos FIFO y socket. Se añadió una regla
  tmpfiles para borrar el FIFO al arrancar, pero no se probó tras reiniciar.
- Reconectar Drive y verificar subida, listado y restauración cuando se retome.

## Comprobaciones de solo lectura

```bash
systemctl status zomboid.service zomboid.socket pz-backup.timer pz-backup.service
systemctl list-timers pz-backup.timer --all
journalctl -u zomboid.service -n 30 --no-pager
journalctl -u pz-backup.service -n 20 --no-pager
ss -lun | grep -E ':16261|:16262'
sudo -u pzuser ls -lh /home/pzuser/backups
```

Un servicio de respaldo `failed` es actualmente el resultado esperado del fallo
de Drive; no confundirlo con que no exista una copia local.
