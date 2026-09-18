---
name: paseo
description: Referencia del setup de Paseo de Luis (daemon de agentes remoto sobre pi) y de cómo las extensiones de pi conviven con él. Usar SIEMPRE que se trabaje con paseo o sus agentes: diagnóstico de comportamiento en paseo ("X no funciona en paseo", notificaciones duplicadas, /reload, comandos slash), escribir o editar extensiones de pi que deban funcionar también en paseo (tools vs comandos, custom() vs select()), recargar extensiones, reiniciar el daemon, gestionar agentes (paseo ls/send/stop/logs), leer logs del daemon, o configurar el dictado por voz de paseo (STT parakeet). Incluye arquitectura RPC, tabla de compatibilidad de APIs y patrones de aislamiento por modo.
---

# Paseo: arquitectura, extensiones de pi y operación

## Arquitectura

- **Paseo = daemon + interfaz** para controlar agentes de pi en remoto (app/web/CLI). Corre como `systemd --user` (unidad `paseo.service`); **un daemon POR máquina** (omarchy y home-server tienen el suyo).
- **Cada agente de paseo es un proceso `pi --mode rpc`** hijo del daemon, corriendo con el usuario normal en su home. Consecuencias:
  - Auto-cargan TODAS las extensiones globales de `~/.pi/agent/extensions/` (symlink al repo dotfiles) — una sola fuente de verdad para terminal y paseo.
  - Paseo agrega además su integración propia (`--extension /tmp/paseo-pi-extension-*/paseo-integration.mjs`).
  - Env de los procesos pi: `PASEO_AGENT_ID`, `PASEO_AGENT_CWD` (más `PASEO_PASSWORD`, etc.).
- **El micrófono está en el cliente, el STT corre en el CPU del daemon** dueño de la sesión (streaming de audio al daemon).
- El dictado de paseo NO es voxtype: son motores separados (ver sección Dictado).

## Compatibilidad de APIs de extensión (TUI ↔ RPC ↔ print)

| API | Terminal (TUI) | Paseo (RPC) | Subagentes (print) |
|---|---|---|---|
| `ctx.ui.select/confirm/input/editor` | ✅ | ✅ viajan al cliente (Extension UI Protocol: `extension_ui_request`/`response` con id; paseo los muestra nativos) | ❌ auto-cancelan (`isInteractive=false`) |
| `ctx.ui.custom()` | ✅ | ❌ devuelve `undefined` — necesita fallback | ❌ |
| `ctx.ui.notify/setStatus/setWidget` | ✅ | fire-and-forget: viajan, el cliente los muestra o ignora | no-ops |
| `ctx.ui.setTheme()` | ✅ | devuelve `{success:false}` silencioso | — |
| `registerTool` | ✅ | ✅ el agente las invoca | ✅ |
| hooks (`pi.on`) | ✅ | ✅ | ✅ |
| **Comandos de extensión** (`registerCommand`, p.ej. `/usage`) | ✅ | ✅ **SÍ funcionan** — paseo los lista en autocomplete y se ejecutan en el agente (rpc.md: "extension commands execute immediately") | ❌ no existen |
| **Comandos nativos del TUI** (`/reload`, `/help`) | ✅ | ❌ NO existen por RPC → viajan como texto al modelo | ❌ |

Regla práctica: **para que algo sea alcanzable en todos los modos, regístralo como tool**; los comandos quedan como comodidad del TUI (con fallback no-TUI si vale la pena).

### Patrones de aislamiento

```ts
if (ctx.mode !== "tui") return;          // solo terminal interactiva
if (process.env.PASEO_AGENT_ID) return;  // suprimir cuando corre bajo paseo
ctx.ui.notify("X requires interactive mode", "error"); return; // guard en comandos (patrón handoff/todo)
```

Para UIs de extensiones: usar `custom()` en TUI y `select()/input()` en el resto (patrón de `question.ts`).

## Recarga de extensiones

- `/reload` (hot-reload de extensiones auto-descubiertas) **solo funciona en el TUI**.
- `paseo send <id> "/reload"` **NO recarga**: manda el texto al LLM como prompt (gasta un turno).
- Los procesos pi vivos no recargan extensiones jamás en caliente: solo al reciclarse (proceso nuevo).
- `paseo daemon restart` recicla todo: los idle retoman desde disco (JSONL intacto), solo se arriesga el turno en curso (y mata la sesión del agente que lo ejecuta — si un agente debe reiniciar el daemon que lo contiene, usar `systemd-run --user --on-active=6s systemctl --user restart paseo` para desacoplar el timer).

## Operación y diagnóstico

```bash
paseo ls                        # agentes (idle/running/closed)
paseo send <id> "prompt"        # --no-wait para no bloquear
paseo stop <id>                 # interrumpe turno (idle = no-op)
paseo inspect <id> / paseo logs <id>
paseo daemon restart            # systemctl --user restart paseo
journalctl --user -u paseo      # logs del daemon (los agentes "closed" retoman al abrirlos)
```

- **Ruido de logs**: `ErrorCallbackCount":0` en payloads de audio y fetch ECONNREFUSED locales son normales; los errores reales de agentes/extensiones aparecen con contexto claro. Cero errores de carga de extensiones = esperado.
- Bug clásico de "doble notificación": una extensión global (p.ej. `notify.ts` en `agent_settled`) suena ADEMÁS de la notificación propia de paseo → guard `PASEO_AGENT_ID` (commit 2ae3a3b).

## Dictado por voz (STT)

- Config en el daemon: `features.dictation = { enabled: true, stt: { provider: "local", model: "parakeet-tdt-0.6b-v3-int8", language: "es" } }` (v3 = 25 idiomas con autodetección es/en/pt; modelos en `~/.paseo/models/local-speech`, se descargan al primer uso, ~600MB).
- **`paseo reload` NO aplica cambios de dictado** (valida pero exige `paseo daemon restart`).
- Streaming real (texto incremental mientras hablas; eventos `final:false→true`). En CPU Ryzen 5 5600GT: ~69ms/s de audio con 2 hilos (lo que usa el worker), lineal con la duración. Frases cortas ~7× más rápido que voxtype GPU; ruido blanco → vacío (sin alucinaciones, a diferencia de whisper).
- Paseo NO tiene diccionario custom de reemplazos (FR upstream pendiente). Para corregir garabatos de dictado de escritorio usar voxtype → skill `dictation-dictionary`.
- `voiceMode` (TTS kokoro) queda off: inglés-only.
