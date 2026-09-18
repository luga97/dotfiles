---
name: dictation-dictionary
description: >
  Gestionar el diccionario personalizado del dictado de Voxtype (reemplazos de palabras mal
  transcritas, p.ej. "omarchy"). Usar SIEMPRE que el usuario pida añadir o corregir una
  palabra del diccionario de dictado, aunque no diga "diccionario": "agrégale omarchy al
  dictado", "whisper/voxtype no entiende X", "el dictado me escribe mal esta palabra",
  "añade este término al vocabulario", o quiera ver los reemplazos existentes. El flujo
  incluye buscar en el historial de transcripciones las variantes garabateadas reales que
  produjo el modelo y registrarlas todas.
---

# Diccionario de dictado (Voxtype)

El dictado de Omarchy es **Voxtype** (`~/.config/voxtype/config.toml`, symlink al paquete
`omarchy` de los dotfiles — **todo cambio toca el repo**: commitear al final).

## Mecanismo

Sección `[text]` → `replacements`: mapa `"garabato" = "palabra correcta"`. Match
**case-insensitive de palabra completa**, aplicado **después** de transcribir (no mejora
el reconocimiento acústico, corrige la salida). Formato tabla inline TOML:

```toml
[text]
replacements = { "boxtype" = "voxtype", "omarchi" = "omarchy" }
```

## Flujo para añadir una palabra

1. **Confirmar la palabra correcta** — si el pedido es ambiguo, preguntar antes de editar.
2. **Buscar garabatos reales en el historial** (el modelo ya intentó transcribirla antes):
   ```bash
   journalctl --user -u voxtype --no-pager | grep "Transcribed:" \
     | grep -ioE "omarch[a-z]*|marchi[a-z]*|omache[a-z]*" | sort | uniq -c | sort -rn
   ```
   Estrategia: probar 2–4 fragmentos fonéticos de la palabra (inicio, medio, sin
   caracteresproblemáticos). Sustituir el patrón por el de la palabra pedida.
3. **Añadir cada variante encontrada** como clave → palabra correcta. También aceptar la
   variante que el usuario reporte aunque no esté en el log.
4. Editar `~/.config/voxtype/config.toml`: la sección `[text]` viene comentada por defecto —
   crearla/descomentarla y fusionar con los reemplazos existentes (no pisarlos).
5. `systemctl --user restart voxtype` (la sección `[text]` requiere restart) y verificar
   `voxtype status` → idle.
6. **Commit de dotfiles**: `cd ~/dotfiles && git add -A && git commit -m "feat(voxtype): ..." && git push`
   (el archivo es symlink al paquete omarchy).

## Reglas

- Solo palabras completas ("marchi" sí, "march" como sufijo no confiable — evitar claves
  que sean palabras reales del idioma, p.ej. no mapear "marcha" → "omarchy").
- Mantener el mapa ordenado alfabéticamente por legibilidad.
- Sugerir al usuario probar la palabra dictándola tras el cambio (el agente no puede
  dictar por él).
- **Paseo no tiene diccionario custom** (verificado 2026-09-18, no hay
  replacements/hotwords en su STT). Esta skill es solo para Voxtype; si paseo agrega
  soporte, extenderla.

## Ejemplo real (2026-09-18)

"Hoy quiero que entienda *omarchy* y *voxtype*" → el log tenía "un Marchi", "omarchee" →
`replacements = { "marchi" = "omarchy", "omarchee" = "omarchy", "boxtype" = "voxtype", "boxdade" = "voxtype" }`
