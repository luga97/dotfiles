# NFS server (nativo, unidad de sistema)

Comparte `/home/user` por NFS para acceder a los archivos de esta máquina
desde otras en la LAN o por Tailscale.

Este servicio NO usa docker-compose ni unidad user: `nfs-server` es una
unidad de **sistema** (la exporta el kernel, necesita root), instalada con
`sudo pacman -S nfs-utils`.

## Configuración

La configuración vive en `/etc/exports` (archivo del sistema, fuera del
repo). Contenido activo:

```
# Home de esta maquina, solo LAN y tailnet de confianza (squash de root por defecto)
/home/user  192.168.18.0/24(rw,sync,no_subtree_check) 100.64.0.0/10(rw,sync,no_subtree_check)
```

- Solo exportado a la LAN local y a la tailnet (100.64.0.0/10, CGNAT de Tailscale).
- `root_squash` está por defecto: el root remoto no actúa como root local.

## Instalación en una máquina nueva

```bash
sudo pacman -S nfs-utils
sudo tee -a /etc/exports >/dev/null <<'EOF'

# Home de esta maquina, solo LAN y tailnet de confianza (squash de root por defecto)
/home/user  192.168.18.0/24(rw,sync,no_subtree_check) 100.64.0.0/10(rw,sync,no_subtree_check)
EOF
sudo exportfs -ra
sudo systemctl enable --now nfs-server
```

## Operación

```bash
sudo exportfs -v            # ver exports activos
sudo exportfs -ra           # recargar tras editar /etc/exports
systemctl status nfs-server # estado
```

## Montarlo desde otra máquina (cliente)

El cliente también necesita `nfs-utils` (en omarchy, Arch: `sudo pacman -S nfs-utils`).

```bash
# puntual
sudo mount -t nfs4 <ip-de-esta-maquina>:/home/user /mnt/servidor

# permanente (crear antes /mnt/servidor)
echo '<ip-de-esta-maquina>:/home/user /mnt/servidor nfs4 defaults,_netdev 0 0' | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount -a
```

IPs de esta máquina: LAN `192.168.18.174` (WiFi, dinámica), Tailscale `100.95.235.26` (estable; preferir esta para fstab).
