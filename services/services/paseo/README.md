# Paseo (nativo, no Docker)

Daemon de https://paseo.sh que controla agentes de código (pi, etc.) del host
desde móvil/escritorio/web. Instalado vía `npm install -g @getpaseo/cli`.

Este servicio NO usa docker-compose: el daemon corre nativo como servicio de
systemd user para que tenga acceso a pi, `~/.pi` y git del host.

## Archivos

| Archivo | Destino (stow) | Qué es |
|---------|----------------|--------|
| `.config/systemd/user/paseo.service` | `~/.config/systemd/user/paseo.service` | unidad systemd user |
| `services/paseo/README.md` | `~/services/paseo/README.md` | este README |

## Instalación en una máquina nueva

```bash
npm install -g @getpaseo/cli --allow-scripts=esbuild,node-pty
cd ~/dotfiles && stow services
mkdir -p ~/.config/paseo
# contraseña local (fuera del repo):
openssl rand -base64 18 | tr -d '/+=' | head -c 16 > /tmp/pass
printf 'PASEO_PASSWORD=%s\n' "$(cat /tmp/pass)" > ~/.config/paseo/paseo.env
chmod 600 ~/.config/paseo/paseo.env
sudo ufw allow 6767   # acceso LAN + Tailscale; el host header de IPs/DNS no lo filtra el daemon (--hostnames true)
systemctl --user daemon-reload
systemctl --user enable --now paseo
```

## Uso

- Web UI: http://localhost:6767 (contraseña del `paseo.env`)
- Logs: `journalctl --user -u paseo -f`
- Estado/credenciales: `~/.paseo/` (PASEO_HOME, no va al repo)
- Emparejar móvil: en la UI, Settings → tu host → Pair Device
