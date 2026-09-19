---
name: voxtype-meetings
description: >
  Gestionar el modo reunión de Voxtype (transcripción continua de reuniones y llamadas
  con atribución de hablantes). Usar SIEMPRE que el usuario pida: "grábame/transcríbeme
  esta reunión o llamada", "arranca/para la reunión", "exporta la transcripción", "resume
  la reunión con IA", "etiqueta al hablante", "muéstrame las reuniones anteriores", o
  mencione grabar una entrevista/1:1/cita online con el dictado del sistema. Incluye
  flujo completo, exportación, etiquetado, resumen IA y advertencias de consentimiento.
---

# Voxtype Meetings: transcripción continua de reuniones

Modo reunión de Voxtype (dictado de Omarchy). Grabación continua con transcripción por
chunks en vivo, captura de micrófono **+ audio del sistema** (participantes remotos) y
diarización de hablantes. Estado: `meeting.enabled = true` (activo desde 2026-09-19),
daemon `voxtype.service`, datos en `~/.local/share/voxtype/meetings/` (index.db — datos
locales, NO van a dotfiles).

## Flujo de una reunión

```bash
voxtype meeting start -t "Título de la reunión"   # arrancar
voxtype meeting status                             # verificar que está grabando
voxtype meeting pause   # voxtype meeting resume   # pausas (descansos)
voxtype meeting stop                               # terminar y cerrar transcripción
```

- Arranca por defecto con el engine activo del daemon (hoy Parakeet v3, es/en/pt auto).
- **Diarización** en el start: `--diarization simple` (Tú vs Remoto por fuente de audio,
  ideal 1:1) o `--diarization ml` (embeddings ECAPA-TDNN, varias personas en la misma
  sala — requiere feature `ml-diarization` y modelo extra). Default: config.
- Captura: micrófono + loopback del sistema (monitor de PipeWire, detecta solo) con
  cancelación de eco GTCRN y dedup de transcripciones entre pistas.

## Después de la reunión

```bash
voxtype meeting list                               # reuniones grabadas
voxtype meeting show latest                        # detalle + transcript
voxtype meeting export latest -f markdown -o ~/reunion.md --timestamps
voxtype meeting label latest Remote "Shawn"        # renombrar hablante
voxtype meeting delete <id>                        # borrar
```
Formatos de exportación: `markdown` (default), `text`, `json`. `latest` = la más reciente
o usar el ID de `list`.

## Resumen con IA

```bash
voxtype meeting summarize latest -f markdown
```
Genera puntos clave, action items y decisiones. **Requiere Ollama corriendo local o una
API remota configurada** — Ollama NO está instalado (verificado 2026-09-19); si Luis
quiere resúmenes: instalar Ollama (ver skill `arch-install`) + modelo, o configurar API.

## Advertencias

- **Consentimiento:** grabar llamadas/entrevistas sin avisar a la otra parte tiene
  implicaciones legales (varía por jurisdicción) y estratégicas (p.ej. entrevistas de
  trabajo). Recordarle a Luis que lo considere antes de grabar terceros.
- El loopback captura TODO el audio del sistema — si suena música/notificaciones durante
  la reunión, entra a la transcripción.
- Las reuniones consumen disco en `~/.local/share/voxtype/meetings/` — revisar de vez en
  cuando (`voxtype meeting list`, borrar antiguas).

## Related skills
- `voxtype` — arquitectura, diagnóstico y tuning del dictado (engines, modelos, benchmark).
- `dictation-dictionary` — palabras personalizadas para el dictado (aplica a todo voxtype).
