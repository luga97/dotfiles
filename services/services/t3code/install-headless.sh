#!/usr/bin/env bash
set -euo pipefail

# Instalador revisable del CLI oficial. No inicia servicios ni configura acceso remoto.
version=0.1.7
checksum=c089892bf7922e2e73c6f44a5d1ea125c99f70e378c18361cbbed2fba1920e6c
bundle="t3-${version}-linux-x64"
destination="$HOME/.local/share/t3code-cli/$version"
launcher="$HOME/.local/bin/t3"

if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'Este paquete requiere Linux x86_64.' >&2
  exit 1
fi
if [[ "$(cat /etc/hostname)" != archlinux ]]; then
  echo 'Este procedimiento está destinado a home-server (archlinux).' >&2
  exit 1
fi
if [[ -e "$destination" || -e "$launcher" || -L "$launcher" ]]; then
  echo 'Ya existe una instalación o launcher de T3; revisar antes de reemplazarlo.' >&2
  exit 1
fi

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
curl --fail --location --proto '=https' --tlsv1.2 \
  "https://github.com/pingdotgg/t3code/releases/download/v${version}/${bundle}.tar.gz" \
  --output "$work_dir/$bundle.tar.gz"
printf '%s  %s\n' "$checksum" "$work_dir/$bundle.tar.gz" | sha256sum --check -
tar --extract --gzip --no-same-owner --file "$work_dir/$bundle.tar.gz" --directory "$work_dir"
test -x "$work_dir/$bundle/t3"
install -d "$HOME/.local/share/t3code-cli" "$HOME/.local/bin"
mv "$work_dir/$bundle" "$destination"
ln -s "$destination/t3" "$launcher"
"$launcher" --version
