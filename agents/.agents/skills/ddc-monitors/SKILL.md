---
name: ddc-monitors
description: Control DDC/CI de monitores externos en el desktop de Luis (brillo, contraste, encender/apagar, entrada de video). Usar SIEMPRE ante cualquier pedido de ajustar brillo o contraste de un monitor, "baja/sube el brillo", monitores DP-1/DP-2/HDMI, ddcutil, apagar pantalla externa, cambiar entrada de video, o diagnosticar qué monitor soporta control por software. Evita re-detectar el setup o descubrir comandos cada vez.
---

# Control DDC/CI de monitores — desktop omarchy

Este setup ya fue analizado con `ddcutil` (2026-09-17). Usar la tabla y los comandos de abajo SIN re-detectar nada, salvo que algo falle o el hardware haya cambiado (ver "Re-verificar" al final).

## Mapa de monitores

| Hyprland | Monitor | Bus i2c | DDC/CI | Brillo (VCP 0x10) | Notas |
|----------|---------|---------|--------|-------------------|-------|
| `DP-1` | TCL 27G64 (2560x1440@180, scale 1.25) | i2c-6 | ✅ VCP 2.1 | rango 0–100 | `ddcutil capabilities` FALLA en este monitor (max retries); probar features directo con `getvcp` |
| `DP-2` | Dell P2722H (1920x1080, scale 1.25) | i2c-7 | ✅ VCP 2.1 | rango 1–100 (el monitor clampea 0 → 1) | capabilities OK; soporta también contraste (0x12), power mode (0xD6), display mode (0xDC), idioma OSD (0xCC) |
| `HDMI-A-1` | Samsung 2009 (mirror de DP-1) | i2c-5 | ❌ NO soporta | — | Dirección 0x37 no responde. Su brillo SOLO se cambia con el OSD físico del monitor. No intentar con ddcutil |

- Permisos: el usuario está en el grupo `i2c` → ddcutil funciona **sin sudo**.
- Los nombres de Hyprland llevan guion: `DP-1`, `DP-2` (no "DP1"/"DP2"). Si el usuario dice "DP2", interpretar `DP-2`.
- `hyprctl monitors all` muestra el estado actual (conectados, escala, mirrors). Si el usuario pide el monitor "actual", es el `focused`.

## Cómo ajustar (en orden de preferencia)

1. **Wrapper de Omarchy** (prefiere este; cachea el bus y maneja detección):
   ```bash
   omarchy brightness display ddc <monitor>          # consultar valor actual
   omarchy brightness display ddc DP-2 50%           # setear valor absoluto
   omarchy brightness display ddc DP-2 10%-          # ajuste relativo
   ```
2. **ddcutil directo** (para features que el wrapper no cubre: contraste, power mode, input source):
   ```bash
   ddcutil --bus 7 getvcp 10        # leer brillo (0x10) del Dell
   ddcutil --bus 7 setvcp 10 40     # setear brillo 40
   ddcutil --bus 7 setvcp 12 60     # contraste (0x12)
   ddcutil --bus 6 setvcp D6 04     # apagar TCL por DDC (0x04 = off; 0x01 = on)
   ```
   Mapeo de buses: bus 6 = DP-1 (TCL), bus 7 = DP-2 (Dell). Si ddcutil va lento, agregar `--skip-ddc-checks`.
3. Para el **brillo del monitor enfocado** (cualquiera que soporte DDC): `omarchy brightness display +10%`.

## Quirks de este hardware

- **Dell P2722H**: mínimo real de brillo es **1**, no 0 (pidió 0% y queda en 1). Aviso al usuario en vez de reintentar.
- **TCL 27G64**: acepta brillo 0. Si `capabilities` falla con "Maximum DDC retries exceeded" es normal — no insistir ni asumir que el monitor no funciona; usar `getvcp`/`setvcp` directo.
- **HDMI-A-1**: nunca usar ddcutil; es mirror del DP-1, normalmente no requiere acción.
- `omarchy brightness display ddc` cachea "unavailable" por 60 s y el bus por 10 s; si se acaba de conectar un monitor, puede haber hasta 60 s de caché negativa.

## Re-verificar (solo si algo falla o cambió el hardware)

Si un comando falla, el usuario menciona un monitor nuevo, o se usa en otra máquina:
1. `ddcutil detect` — re-mapear bus ↔ conector y soporte DDC/CI.
2. `hyprctl monitors all` — nombres actuales de Hyprland.
3. Actualizar la tabla de arriba con la nueva info y commitear (la skill vive en el repo de dotfiles).
