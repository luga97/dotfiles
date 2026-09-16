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

The `services/` package backs up **any service or daemon that runs constantly in the setup** — both docker-compose services and native daemons (systemd user units). Each service lives in its own directory and gets symlinked to `~/services/<name>/`.

### Docker services

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
1. Create `services/services/<name>/` with its `docker-compose.yml` (Docker) or a README with setup notes (native), and an `.env.example` if it needs secrets
2. Add the service's `.env` pattern to `.gitignore` if it has secrets (`services/services/<name>/.env` is already covered by `services/services/*/.env`)
3. Restow: `stow -R services`
4. Update this README with the new service and its setup steps

**Rules:**
- No secrets in tracked files — use environment variables injected from a gitignored `.env`
- Auto-start after reboot: `restart: unless-stopped` (Docker) or systemd user unit with `WantedBy=default.target` (native)
- Bind ports to `127.0.0.1` unless the service must be reachable from outside
- Native daemons only make sense when the service must access host resources (agent CLIs, host git/SSH, etc.) — otherwise prefer Docker for isolation

### Native daemons

Services that need host access live as **systemd user units** inside the same package: the unit is stowed from `.config/systemd/user/` (stow merges the tree) and setup notes live in `services/<name>/`.

```
services/
├── .config/systemd/user/
│   └── paseo.service      # -> ~/.config/systemd/user/paseo.service
└── services/
    └── paseo/
        └── README.md      # setup notes for a new machine
```

Secrets for native daemons live in a host-local env file (e.g. `~/.config/paseo/paseo.env`, referenced by `EnvironmentFile=` in the unit) — never in the repo.

**Current services:**

| Service | Kind | Port | Purpose |
|---------|------|------|---------|
| searxng | docker | 127.0.0.1:8081 | local metasearch engine, JSON API backend for `ketch search` |
| paseo | native (systemd user) | 127.0.0.1:6767 | daemon to drive coding agents (pi, etc.) from mobile/web clients — needs host access to pi, `~/.pi` and git (https://paseo.sh) |

## Agent configs (agents/)

The `agents/` package manages **all coding-agent configurations** (one `stow agents` on any machine):

```
agents/
├── .config/opencode/    # -> ~/.config/opencode/
│   └── opencode.json
├── .agents/             # -> ~/.agents/
│   └── skills/          # shared skills (pi and opencode both read this)
│       ├── sync-dotfiles/
│       ├── find-skills/
│       ├── frontend-design/
│       ├── ketch/
│       └── skill-creator/
└── .pi/                 # -> ~/.pi/
    └── agent/
        ├── AGENTS.md    # global agent instructions
        ├── settings.json
        ├── extensions/
        ├── prompts/
        └── themes/
```

**Sync:** `stow agents`

**Notes:**
- The `omarchy` and `diagnose-crash` skills are not synced — they're installed by omarchy at `/usr/share/omarchy/default/agents/skills/` (desktop-only).
- Local-only pi files (never in the repo): `auth.json`, `models-store.json`, `presets.json`, `trust.json`, sessions, and `~/.pi/agent/skills/` for machine-specific skills.
- On headless machines (no omarchy), stow with: `stow agents --ignore='omarchy-system-theme'`.
