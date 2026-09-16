# dotfiles-sync (nativo, no Docker)

Sincronización **bidireccional** de `~/dotfiles` entre máquinas (servidor, PC,
notebook): cambios pueden nacer en cualquiera y deben llegar a todas.

## Cómo funciona

`scripts/dotfiles-sync.sh` (versionado en el propio repo, así todas las
máquinas corren la misma versión):

1. `git pull --rebase --autostash` — preserva cambios locales sin commitear y
   rebasa sobre lo remoto. Si hay conflicto real (misma línea editada en dos
   máquinas): aborta el rebase y falla ruidoso (nada se pisa).
2. Escaneo de secretos en `agents/.pi/agent/memory/` (el repo es público):
   bloquea el commit si detecta patrones de credenciales.
3. Commit automático de los cambios si los hay.
4. `git push` con hasta 3 reintentos (carrera entre máquinas: push rechazado →
   rebase → reintento).

Timer: cada 15 min + 3 min tras boot, con `RandomizedDelaySec` para
desfasar las máquinas. Un `flock` evita instancias solapadas.

## Archivos

| Archivo | Destino (stow) | Qué es |
|---------|----------------|--------|
| `scripts/dotfiles-sync.sh` (en la raíz del repo) | — (no se stoweaa) | script de sync, heredado vía git |
| `.config/systemd/user/dotfiles-sync.service` | `~/.config/systemd/user/dotfiles-sync.service` | unidad oneshot |
| `.config/systemd/user/dotfiles-sync.timer` | `~/.config/systemd/user/dotfiles-sync.timer` | temporizador |
| `services/dotfiles-sync/README.md` | `~/services/dotfiles-sync/README.md` | este README |

## Instalación en una máquina nueva

```bash
cd ~/dotfiles && stow services
systemctl --user daemon-reload
systemctl --user enable --now dotfiles-sync.timer
```

La primera vez conviene correr el script a mano para ver que todo esté sano:

```bash
~/dotfiles/scripts/dotfiles-sync.sh
```

## Notas

- Conflictos de rebase NO se resuelven solos: el script aborta y el `systemctl
  --user status dotfiles-sync.service` muestra el error. Resolver con
  `git pull --rebase` a mano.
- Si el escaneo de secretos bloquea el commit, limpiar el archivo ofensor en la
  memoria (el agente puede hacerlo: "limpiá el secreto de tu memoria") y el
  próximo ciclo commitea el resto.
- Chequeo manual del estado: `systemctl --user list-timers dotfiles-sync.timer`
