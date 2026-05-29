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
