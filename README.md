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

### Agent usage collectors

Omarchy 4.5 includes Z.ai and OpenRouter collectors. Use the packaged versions;
local copies and the old manual symlink instructions are no longer needed.

`omarchy/.local/bin/omarchy-agent-usage-codex-rialto` remains a custom collector.
Its existing discovery link under `$OMARCHY_PATH/bin` is kept on this machine.
It uses `CODEX_HOME=~/.codex-rialto`, scans only the `~/.pi/agent-rialto` profile
and that Codex home, and excludes the shared OpenCode database so its statistics
remain separate from personal Codex usage. Review migration to native multiple
accounts separately before removing it.

```bash
omarchy agent usage-update zai openrouter codex-rialto
omarchy shell omarchy.agents refresh
```

### Omarchy 4.5 desktop settings

Use the native workspace widget and per-monitor workspace ownership. On the PC,
`Super+Ctrl+M` opens the native monitor video-input selector: both screens to
PC/laptop, or TCL/Dell individually. Escape cancels. The old `Super+F1–F4`
shortcuts are removed to avoid accidental switching near the workspace keys.
The `pc` package supplies `monitor-input-menu`; DDC identifies each display by
its EDID model and serial, retaining PC input `0x0f` and laptop input `0x11`.
Both-screen actions run concurrently and report partial failures. This switches
video inputs only, not keyboard/mouse connections or workspace layouts.
Google Translate is on
`Super+Shift+Alt+T`; `Super+Shift+T` retains the native Activity shortcut.

Notifications use the native service. Voxtype keeps Parakeet, its dictionary,
typing delay, and meeting capture settings. F9 and `Super+Ctrl+X` remain enabled
alongside `Alt+Space`. Right Alt push-to-talk is disabled because both Alt keys
switch keyboard layouts.

`shell.json` and Voxtype's `config.toml` are tracked and linked from this package.
Omarchy shell tools save `shell.json` with an atomic rename, which can replace
its Stow symlink with a regular file. After changing the bar or its settings
through the UI/CLI, compare the live file with the repo copy, preserve the live
settings in the repo, and restore the link before syncing. Voxtype setup commands
can similarly replace its config link; do not overwrite the active meeting
settings by blindly restoring an older repo copy.

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
| dotfiles-sync | native (systemd user timer) | — | bidirectional sync of this repo across machines (pull --rebase --autostash → secret-scan → commit → push with retries); scans `agents/.pi/agent/memory/` for secrets before committing (repo is public) |

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
