# mr-review — Agente de review de MRs (barbershop-saas)

Receiver de webhooks de GitLab que corre reviews automáticos de MRs con
**pi** (agéntico, z.ai coding plan) y **PR-Agent** (docker, A/B de la Fase 1),
y postea los veredictos en los MRs como el bot `mr-review-bot`.

**Corre en home-server únicamente** (el funnel de Tailscale apunta acá).

## Arquitectura

```
GitLab (MR abierto / push nuevo)
  → webhook HTTPS → Tailscale Funnel (https://archlinux.tail27d0f2.ts.net)
  → 127.0.0.1:8080 (este receiver, systemd user)
      → valida X-Gitlab-Token → filtra (solo commits nuevos en MRs abiertos)
      → cola serial (último SHA por MR gana)
      → pi -p sin herramientas (prompt con AGENTS.md + diff; fallback z.ai → Codex → OpenRouter ante cuota agotada)
      → JSON {verdict, summary, findings}
      → comentario "🤖 Pi Review — revisando…" se EDITA con el veredicto
      → PR-Agent docker (A/B) + comentario de estado propio (✅ solo si el
        comentario "PR Reviewer Guide 🔍" aparece en el MR tras el run;
        "Failed to review PR" o guía ausente se marcan como ❌)
```

El gate de merge lo dan los **threads resolvibles** de GitLab
(`only_allow_merge_if_all_discussions_are_resolved`) — desactivado durante la
Fase 1 (A/B sin bloquear); en Fase 2 se activa con `MR_REVIEW_THREADS=1`.
Sin approvals nativos. Spec completa: `spec-agent-review.md` en el repo del
proyecto.

## Secretos

`~/.config/mr-review/secrets.env` (gitignored, fuera del repo):

```
GITLAB_TOKEN=<project access token mr-review-bot, scope api, expira 2027-10-10>
WEBHOOK_SECRET=<secreto compartido del webhook GitLab id 91294472>
```

## Instalación (hecha en home-server)

```bash
cd ~/dotfiles && stow -R services
systemctl --user daemon-reload
systemctl --user enable --now mr-review
```

Webhook en GitLab (Settings → Webhooks, id 91294472):
URL `https://archlinux.tail27d0f2.ts.net/webhook`, secreto =
`WEBHOOK_SECRET`, trigger: **merge requests events** únicamente.

## Verificación

Prueba el parser de eventos/salidas de Pi sin levantar el receiver:

```bash
node --test ~/dotfiles/services/services/mr-review/pi-output.test.mjs
```

```bash
systemctl --user status mr-review
journalctl --user -u mr-review -f          # logs en vivo
curl -s http://127.0.0.1:8080/health       # {"ok":true,...}
```

## Notas

- El clone del repo vive en `~/repos/mr-review/barbershop-saas` (URL con
  token oauth2 en `.git/config` — mismo nivel de secreto que secrets.env).
- Estado: `~/.local/state/mr-review/state.json` (último SHA revisado por MR,
  evita re-reviews del mismo commit).
- El modelo (glm-4.6 via z.ai coding plan) comparte cuota con pi de escritorio.
- gitlab.com tardó ~10 min en resolver el dominio del funnel cuando se creó
  (caché negativa) — si un webhook "no llega", revisar Settings → Webhooks →
  Recent events (y el botón de re-enable del hook).
- Contingencia si ts.net volviera a fallar desde gitlab.com: Cloudflare Tunnel
  con hooks.lugadev.com (el dominio está aparcado en Hostinger).
