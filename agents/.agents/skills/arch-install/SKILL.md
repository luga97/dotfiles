---
name: arch-install
description: Flujo de instalación de software en el sistema Arch Linux de Luis. Usar SIEMPRE que se pida instalar, agregar o poner un paquete, herramienta, CLI o dependencia (ejemplos "instala X", "ponme Y", "necesito Z", "add X"), incluso si no se menciona pacman explícitamente. Define el orden de preferencia pacman → paru (AUR) → otras vías, y el protocolo de revisión de seguridad obligatorio antes de compilar nada desde AUR.
---

# Instalación de paquetes en Arch Linux

Contexto: el sistema es Arch Linux con pacman y `paru` como ayudante de AUR (**no está `yay` instalado**, ni usarlo). El objetivo es instalar por la vía más limpia y mantenible, y nunca ejecutar código no revisado.

## Orden de preferencia

Probar en este orden, deteniéndose en el primero que tenga el paquete:

1. **Pacman (repos oficiales)** — verificar con `pacman -Si <paquete>`. Si existe, proponer `pacman -S <paquete>` (requiere sudo del operador).
2. **paru (AUR)** — si no está en pacman, buscar con `paru -Ssa <paquete>`. Si existe, aplicar el **protocolo de seguridad** de abajo antes de compilar, y solo entonces proponer `paru -S <paquete>`.
3. **Otras vías** — solo si no existe ni en pacman ni en AUR. Preferir, en este orden: release binaria oficial de GitHub (verificando checksum), `go install`, `mise`, `npm -g` (con `--allow-scripts` explícito si aplica), binario/instalador oficial. Proponer la vía y el comando exacto y esperar confirmación antes de ejecutar.

Regla general: proponer el comando exacto y esperar confirmación antes de cualquier instalación. Nunca instalar a ciegas.

## Protocolo de seguridad para AUR (obligatorio)

Los paquetes de AUR son PKGBUILDs de terceros: compilar uno es ejecutar código arbitrario con los permisos del usuario. Antes de construir cualquier paquete de AUR:

1. **Descargar y leer el `PKGBUILD` completo** (`paru -G <paquete>` o revisando el directorio de build), más cualquier archivo `.install` o parche que aplique.
2. Revisar en `build()` y `package()`: qué comandos corren, de dónde vienen las fuentes, a qué URLs se conecta, si toca archivos fuera de `$pkgdir`/`$srcdir`.
3. **Validar señales de alarma**:
   - `curl ... | bash` o descarga de binarios/scripts sin checksum verificado
   - conexiones a dominios raros o no relacionados con el proyecto
   - escalada de privilegios (sudo, setuid) no justificada
   - ofuscación (base64, eval, hex) innecesaria
   - cambios recientes abruptos en el PKGBUILD sin versión nueva del upstream
4. **Si hay algo sospechoso, ambiguo o no verificable: PARAR** y reportar al usuario qué se encontró y por qué es dudoso. No continuar hasta que él decida.

Ejemplo de revisión correcta: verificar que la fuente apunte al repositorio upstream real, que el checksum (`sha256sums`) exista y coincida, y que `package()` solo copie archivos a `$pkgdir`.

## Notas del sistema

- `paru` pide confirmación interactiva: preferir mostrar el comando y dejar que Luis lo ejecute, o usar `--noconfirm` solo si él lo pide.
- Si el paquete no existe con el nombre esperado, buscar variantes antes de concluir (`paru -Ssa <raíz-del-nombre>`), pero nunca instalar un paquete de nombre parecido sin confirmar que es el correcto (typosquatting).
