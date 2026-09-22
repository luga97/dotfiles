# cv-mail-watch

Chequeo automático de respuestas a postulaciones laborales (proyecto CV):
cada 30 min revisa el Inbox de Gmail vía himalaya, detecta respuestas
(In-Reply-To a correos enviados o remitentes ATS) y notifica vía
`telegram-bridge`. Todo el estado/dedup vive en SQLite del proyecto CV.

## Componentes

| Pieza | Ubicación |
|---|---|
| Script + esquema SQLite | `~/Projetos/CV/tools/mail-watch.py`, `schema.sql` (repo CV) |
| Estado (DB, dead-letter) | `~/Projetos/CV/tools/data/cvmail.db`, `~/.local/state/cv-mail-watch/` (gitignored) |
| Env opcional | `~/Projetos/CV/tools/.env` (gitignored; plantilla en `.env.example`) |
| Credenciales | `~/.config/himalaya/` (config + `gmail-app-pass`, chmod 600) |
| Unidades | `.config/systemd/user/cv-mail-watch.{service,timer}` (este paquete) |

## Setup

```bash
cd ~/dotfiles && stow -R services
systemctl --user daemon-reload
systemctl --user enable --now cv-mail-watch.timer
systemctl --user list-timers cv-mail-watch.timer   # verificar NEXT
```

Chequeo manual puntual: `systemctl --user start cv-mail-watch.service`

Logs: `journalctl --user -u cv-mail-watch.service -f`

## Notas

- `Persistent=true`: si el equipo estaba apagado, corre al arrancar (2 min tras boot).
- Dependencia opcional: `telegram-bridge` en `127.0.0.1:8787`. Si está caído,
  el script reintenta 3× y deja el aviso en dead-letter; se puede activar un
  correo de respaldo con `CVMAIL_FALLBACK_EMAIL`.
- El timer no envía nada si no hay respuestas nuevas: es silencioso e idempotente.
- **Ruido explícito** (`CVMAIL_NOISE_SENDERS`): alertas automatizadas de LinkedIn
  (security/notifications/invitations/jobs) se registran sin notificar al bot y
  sin tocar el buzón — quedan visibles en el Inbox de Gmail. Va antes de la
  clasificación para que `%linkedin.com` (reclutadores) no las capture.
