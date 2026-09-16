# Dotfiles

This repo manages configuration files using GNU Stow.

## How it works

GNU Stow creates symlinks from this repository to your home directory. Each subdirectory is a **package** that stow manages independently.

## Packages

| Package | Description |
|---------|-------------|
| `omarchy/` | omarchy defaults + .bashrc + sources user customization files |
| `bash/` | (future) additional bash customizations if needed |
| `nvim/` | Neovim configuration |
| `tmux/` | tmux configuration |
| `pc/` | hardware-specific settings for desktop (monitors, input, etc.) |
| `notebook/` | hardware-specific settings for laptop |
| `agents/` | opencode config and skills (see Agent configs section) |
| `services/` | self-hosted docker-compose services (see Services section) |

## Hardware-specific pattern

Hardware packages only contain `*-specific-hardware.conf` files that override shared settings.

```
omarchy/.config/hypr/monitors.conf  # shared settings, then sources hw-specific file
pc/.config/hypr/monitors-specific-hardware.conf  # hardware-specific only
```

In `omarchy/.config/hypr/monitors.conf`, at the end:
```conf
# ... shared monitor settings ...
source = monitors-specific-hardware.conf
```

This way:
- Shared settings live in program packages (omarchy, nvim, tmux)
- Hardware-specific overrides live in pc/notebook packages
- No duplicate files, no conflicts

## omarchy as a foundation

`omarchy/` contains the minimal defaults that source user customization packages. This means omarchy can be updated without overwriting your personal settings.

## Stow order

When stowing, hardware packages should be stowed **before** program packages so that hardware-specific files exist when program configs source them:

```bash
# On PC
stow pc
stow omarchy
stow nvim
stow tmux

# On notebook
stow notebook
stow omarchy
stow nvim
stow tmux
```

Order doesn't matter for programs that don't source each other (nvim, tmux).

## Common commands

```bash
# Stow all packages
stow omarchy nvim tmux

# Stow with specific target
stow -t $HOME omarchy

# Unstow a package
stow -D package

# Restow (unstow + stow)
stow -R package

# Simulate (see what would happen without making changes)
stow -n -v

# Force overwrite existing symlinks
stow --override='.*' package
```

## Adding new configs

### Adding a shared program config
1. Add the config file to the appropriate program package (omarchy, nvim, tmux)
2. Stow the package: `stow package`

### Adding a hardware-specific setting
1. Create `*-specific-hardware.conf` in `pc/` or `notebook/` with only the hardware-specific lines
2. Source it from the main program config: `source = filename-specific-hardware.conf`
3. Stow in correct order: `stow pc && stow omarchy`

### Adding bash customizations
1. Edit `dotfiles/omarchy/.bash_customizations` (sourced by omarchy's `.bashrc`)
2. Your customizations are symlinked to `~/.bash_customizations`
3. Restow omarchy: `stow -R omarchy`

## Services (services/)

The `services/` package manages self-hosted docker-compose services. Each service lives in its own directory and gets symlinked to `~/services/<name>/`.

```
services/
└── services/          # -> ~/services/
    └── searxng/
        ├── docker-compose.yml
        ├── searxng-data/
        │   └── settings.yml
        ├── .env          # local secrets — GITIGNORED, never commit
        └── .env.example  # template, tracked
```

**Sync:** `stow services`

**Setup on a new machine (per service):**
```bash
cd ~/services/searxng
cp .env.example .env
# generate a real secret and paste it in .env
python3 -c "import secrets; print(secrets.token_hex(32))"
docker compose up -d
```

**Adding a new service:**
1. Create `services/services/<name>/` with its `docker-compose.yml` and an `.env.example` if it needs secrets
2. Add the service's `.env` pattern to `.gitignore` if it has secrets (`services/services/<name>/.env` is already covered by `services/services/*/.env`)
3. Restow: `stow -R services`
4. Update this README with the new service and its setup steps

**Rules:**
- No secrets in tracked files — use environment variables injected from a gitignored `.env`
- `restart: unless-stopped` on every service so Docker auto-starts them after reboot
- Bind ports to `127.0.0.1` unless the service must be reachable from outside

**Current services:**

| Service | Port | Purpose |
|---------|------|---------|
| searxng | 127.0.0.1:8081 | local metasearch engine, JSON API backend for `ketch search` |

## Agent configs (agents/)

The `agents/` package manages opencode and skills configurations:

```
agents/
├── .config/opencode/    # -> ~/.config/opencode/
│   └── opencode.json
├── .agents/             # -> ~/.agents/
│   └── skills/
│       ├── sync-dotfiles/
│       ├── find-skills/
│       ├── frontend-design/
│       └── skill-creator/
```

**Sync:** `stow agents`

**Note:** The `omarchy` skill is not synced — it's installed by omarchy at `~/.local/share/omarchy/`.
