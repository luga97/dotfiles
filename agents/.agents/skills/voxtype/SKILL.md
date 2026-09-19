---
name: voxtype
description: >
  Operar, diagnosticar, tunear y comparar modelos del dictado de escritorio de Omarchy
  (Voxtype: F9 push-to-talk / Super+Ctrl+X toggle). Usar SIEMPRE ante: "el dictado está
  lento", "F9 se corta", "cambia o prueba otro modelo de transcripción", "whisper no
  transcribe bien", "diagnostica el dictado", caracteres caídos al dictar, o cualquier
  trabajo sobre voxtype/whisper/parakeet en el contexto del dictado del sistema. Incluye
  benchmark A/B de modelos, arquitectura de binarios/engines y quirks conocidos.
---

# Voxtype: dictado de escritorio (diagnóstico, tuning, benchmark)

## Arquitectura

- Daemon: systemd user `voxtype.service`. Config: `~/.config/voxtype/config.toml`
  (symlink al paquete `omarchy` de dotfiles — **commitear** cambios; ver gotcha de pkexec).
- **Dos familias de binarios** en `/usr/lib/voxtype/`:
  - whisper.cpp: `voxtype-vulkan` (GPU), `voxtype-avx2` (CPU) — solo engine whisper
  - ONNX: `voxtype-onnx-avx2` (CPU) — parakeet, moonshine, sensevoice, paraformer, cohere
- Estado: `voxtype status` · engines compilados: `voxtype info engines` · variantes y
  recomendador por hardware: `voxtype info variants` · GPU activa: `voxtype info accel`
- Cambios de config: casi todos "needs restart" → `systemctl --user restart voxtype`
- Cambio de binario (whisper↔ONNX, GPU↔CPU): `pkexec voxtype setup onnx --enable/--disable`
  o `voxtype setup gpu --enable/--disable` + restart (reescriben symlink `/usr/bin/voxtype`).

## Estado ganador (2026-09-19, elección de Luis)

```toml
engine = "parakeet"
[whisper]   # inactivo, queda de referencia
[parakeet]
model = "parakeet-tdt-0.6b-v3"   # full precision, NO int8
streaming = false                 # v3 no es cache-aware; solo unified-en (inglés-only)
```
- **Por qué:** 0 errores de palabra en español, 1.78 s/párrafo (~35 s), ~0.3 s frase corta,
  multilingüe auto (25 idiomas europeos) con **code-switching frase a frase** (whisper no puede:
  una lengua por ventana de 30 s).
- Números históricos (párrafo ~30 s): whisper large-v3-turbo+auto 12.6 s · +es 6.3 s ·
  small GPU+es 2.6 s · small CPU 6.8 s · parakeet v3-int8 1.36 s (3 errores de cuantización) ·
  **parakeet v3-full 1.78 s (0 errores)**.
- **Rollback:** `voxtype config set engine whisper && voxtype config set whisper.model small &&
  pkexec voxtype setup onnx --disable && systemctl --user restart voxtype` (+ `voxtype setup
  --download --model small` si se limpió).

## Diagnóstico por fases en el log

```bash
journalctl --user -u voxtype --no-pager -o short-precise | grep -E "Recording|Transcrib"
```
Fases: `Recording stopped (Ns)` → `Transcribing Ns` → [`auto-detected language`] →
`Transcription completed in Ns`. Historial completo desde jun/2026.

### Causas conocidas de "se corta"
| Síntoma | Causa real | Fix |
|---|---|---|
| Corta a mitad de discurso, log muestra stop temprano | **F9 key-up accidental** | usar toggle (Super+Ctrl+X) en textos largos |
| Corta exactamente a los N s con `WARN Recording timeout` | `audio.max_duration_secs` (hoy 180) | subir clave |
| Texto incompleto PERO log completo | tipeo (ver abajo) | type_delay_ms |
| `No audio was captured` | toque accidental de tecla | ignorar |

### Caracteres caídos
Comparar el **texto del log** contra lo que llegó tipeado: si el log está completo, es el
tipeo → subir `type_delay_ms` (3 hoy; **el CLI NO expone esta clave**, editar el archivo
directo y restart). Si el log también está mal, es el modelo.

## Quirks conocidos (caros de descubrir)

- `voxtype config set` no expone `output.type_delay_ms` — editar archivo directo.
- `whisper.language = "es,en,pt"` (lista) está **ROTO** (basura + 16-25 s) — bug upstream
  reportable; usar idioma único o `auto`.
- Whisper codifica **ventanas fijas de 30 s**: hables 3 o 29 s, mismo costo; >30 s paga por
  ventana. `language=auto` añade una pasada completa (~2 s con small; ~6 s con large).
- Modelos `.en` = solo inglés. **No existe base.es/.pt** — español siempre multilingüe.
- Parakeet streaming solo con `parakeet-unified-en-0.6b` (inglés-only) — inútil para español.
- Parakeet en GPU = `voxtype-onnx-rocm` → symlink a migraphx: requiere pila ROCm completa y
  la RX 6650 XT (gfx1032) NO está soportada oficialmente — **descartado por análisis**; CPU
  corre 21× tiempo real y el cuello de botella del flujo es el tipeo.
- **⚠️ `pkexec voxtype setup ...` rompe el symlink de dotfiles** (rename atómico como root
  reemplaza el symlink por archivo real). Síntoma: "nothing to commit" tras cambios. Fix:
  `cp` vivo→repo, `rm` vivo, `stow -R omarchy`, commit. Verificar con
  `readlink ~/.config/voxtype/config.toml` tras cualquier comando root.

## Metodología de benchmark / A-B de modelos

1. **Con voz real (la que importa):** párrafo estándar ~30 s (p.ej. el del mercado), dictado
   con **toggle**, mismo texto para ambos modelos. Medir tiempos en el log y comparar
   **el texto del log** contra el original (errores de palabra ≠ comas ≠ tipeo).
2. **Sintético sin voz:** WAVs de ruido blanco con
   `ffmpeg -f lavfi -i "anoisesrc=color=white:duration=30:sample_rate=16000:amplitude=0.3" -ac 1 /tmp/bench30.wav`
   y `voxtype transcribe /tmp/bench30.wav` — mide costo puro de encoder/ventanas.
   Ojo: whisper **alucina** con ruido ("¡Suscríbete!"); parakeet devuelve vacío.
3. **Binarios directos** (sin tocar el daemon): `/usr/lib/voxtype/voxtype-vulkan transcribe X`
   vs `voxtype-avx2` vs `voxtype-onnx-avx2`.
4. **Cambiar de modelo:** `voxtype setup --download --model X` (descarga, NO activa) →
   `voxtype config set <engine>.model X` + restart. Catálogo: `voxtype info models`.
5. Reportar tabla: tiempo párrafo / frase corta / errores de palabra / idiomas / streaming.

## Comandos rápidos

```bash
voxtype status && systemctl --user is-active voxtype     # salud
voxtype config get engine parakeet.model                  # config resuelta
voxtype config schema | grep -A4 <clave>                  # documentación de claves
voxtype setup model --set <nombre> --restart              # cambiar modelo whisper
voxtype setup --download --model <nombre>                 # solo descargar
journalctl --user -u voxtype --since today                 # actividad
```

## Relacionadas
- `dictation-dictionary`: añadir palabras al diccionario de reemplazos (`[text]`).
- `paseo`: el STT de paseo (parakeet int8 streaming, sherpa-onnx) — motor distinto, no
  comparte modelos ni config con voxtype.
