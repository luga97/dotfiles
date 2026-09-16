#!/usr/bin/env bash
# Sincronización bidireccional de ~/dotfiles entre máquinas.
# pull --rebase --autostash -> escaneo de secretos en memoria -> commit -> push con reintentos.
# Diseñado para correr desde el timer de systemd user (dotfiles-sync.timer).
set -euo pipefail

DOTFILES="${DOTFILES:-$HOME/dotfiles}"
cd "$DOTFILES"

# Una sola instancia por vez (el timer de la otra máquina puede solaparse con una ejecución manual)
exec 9>"$DOTFILES/.git/sync.lock"
flock -n 9 || { echo "sync ya en curso, saliendo"; exit 0; }

# 1) Bajar cambios remotos preservando cambios locales sin commitear (autostash).
#    Si hay conflicto de rebase (misma línea editada en dos máquinas): abortar y fallar ruidoso.
if ! git pull --rebase --autostash --quiet 2>&1; then
	git rebase --abort 2>/dev/null || true
	echo "ERROR: conflicto al hacer pull --rebase. Resolver a mano: cd ~/dotfiles && git pull --rebase" >&2
	exit 1
fi

# 2) Red de seguridad: la memoria del agente vive en este repo PÚBLICO.
#    Bloquear el commit si algún archivo de memoria contiene un posible secreto.
if [ -d agents/.pi/agent/memory ]; then
	if grep -rInE \
		'(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|password[[:space:]]*[:=][[:space:]]*[^[:space:]]{6,}|api[_-]?key[[:space:]]*[:=][[:space:]]*[^[:space:]]{10,}|token[[:space:]]*[:=][[:space:]]*[^[:space:]]{15,})' \
		agents/.pi/agent/memory --exclude=.gitkeep; then
		echo "ERROR: posible secreto en agents/.pi/agent/memory — commit bloqueado. Revisar y limpiar el archivo." >&2
		exit 1
	fi
fi

# 3) Commitear solo si hay cambios (commit vacío = no-op silencioso)
if [ -n "$(git status --porcelain)" ]; then
	git add -A
	git commit -q -m "sync(auto): $(hostname) $(date '+%F %T')"
	echo "commiteados cambios locales"
fi

# 4) Push con reintento: si la otra máquina pusheó primero, rebasear y volver a intentar
for _ in 1 2 3; do
	if git push --quiet 2>/dev/null; then
		echo "sync OK ($(date '+%F %T'))"
		exit 0
	fi
	if ! git pull --rebase --autostash --quiet 2>&1; then
		git rebase --abort 2>/dev/null || true
		echo "ERROR: conflicto al rebasar antes del reintento de push" >&2
		exit 1
	fi
done

echo "ERROR: no se pudo pushear tras 3 intentos" >&2
exit 1
