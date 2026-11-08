# T3 Code en home server

Estado 2026-11-07: instalación suspendida; todavía no instalado ni iniciado.
Luis quiere desarrollar con T3 en Omarchy y clonar/ejecutar servicios en home
server. Se evalúa Hermes para operaciones allí; no hace falta otro T3 para usar SSH.
Este procedimiento se conserva como referencia, fuera del trabajo activo.
Omarchy conserva su instalación actual y sus sesiones. Paseo no se modifica.

## Paquete elegido y revisión

CLI oficial Linux x64 v0.1.7, la misma versión que la app actual de Omarchy:

- Fuente: `pingdotgg/t3code`, release `v0.1.7`, archivo
  `t3-0.1.7-linux-x64.tar.gz`.
- SHA256: `c089892bf7922e2e73c6f44a5d1ea125c99f70e378c18361cbbed2fba1920e6c`.
  Una descarga de revisión coincidió con el digest publicado por la API de GitHub.
- Bundle con ejecutable ELF, bibliotecas, cliente y dependencias. Se instala
  completo bajo `~/.local/share/t3code-cli/0.1.7` y se enlaza desde `~/.local/bin/t3`.
- No se encontró paquete oficial de pacman con los nombres consultados. AUR ofrece
  `t3code-bin` (GUI Electron, sin instalar la CLI headless con ese nombre) y un
  contenedor antiguo `t3-code-docker` 0.0.31. Para este servicio nativo que necesita
  las herramientas del host se propone el bundle CLI oficial, sin instalar la GUI.
- `install-headless.sh` descarga solo ese archivo, comprueba checksum y se niega
  a sobrescribir una instalación existente. No ejecuta un instalador de Internet,
  usa sudo ni inicia servicios. Su sintaxis se verifica con `bash -n`.

## Procedimiento histórico de instalación

No ejecutar durante esta evaluación. La solicitud anterior no se aprobó; si en
el futuro se decide instalarlo, volver a revisar versión y necesidad antes de
seguir la skill `arch-install`. Comando preparado como referencia:

```bash
ssh home-server 'bash ~/services/t3code/install-headless.sh'
```

Después de instalar, consultar la ayuda de `~/.local/bin/t3 service install` y
configurar un servicio de usuario que use las herramientas de mise de ese host.
Revisar unidad, PATH, directorio de datos y arranque sin sesión gráfica; copiar la
configuración efectiva a este paquete y verificarla antes de habilitar acceso remoto.

## Comprobaciones si se retoma la instalación

- Arranque inicial en loopback, puerto 3773, sin publicar un nuevo Funnel.
- Revisar proveedores (Pi 0.85.1 y Node 26.8.2 ya disponibles mediante mise).
- Definir acceso privado Tailscale Serve en un puerto propio; no sobrescribir
  Funnel 443 de MR review. Por ejemplo reservar 8443 para T3 y 8444 para SearXNG.
- Emparejar y vincular entornos; probar tarea real, permisos y resultado por host.
- El estado, credenciales y sesiones de T3 son locales a cada máquina; no se copian
  al repo ni se reemplaza la base viva de Omarchy.

Plan general: [infraestructura](../../INFRASTRUCTURE-PLAN.md).
