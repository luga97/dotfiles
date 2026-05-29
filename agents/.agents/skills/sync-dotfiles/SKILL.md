---
name: sync-dotfiles
description: Guide on using GNU Stow to manage dotfiles and sync configurations across machines. Make sure to use this skill whenever the user mentions dotfiles, stow, syncing configs, adding program configurations, or managing hardware-specific settings. This skill explains how this specific dotfiles repo works and recommends the correct sync order and workflow. Use whenever the user asks "how do I sync my config", "should I stow this", "how do I add a new config", or any question about managing dotfiles across machines.
---
# sync-dotfiles

This skill guides you through using GNU Stow to manage this dotfiles repository. It explains how the repo is structured and when to recommend syncing configurations.

## How Stow Works

GNU Stow creates symlinks from package directories in this repo to your home directory. Each subdirectory is an independent **package**.

**Core concepts:**
- **package** — a directory under `dotfiles/` (e.g., `omarchy`, `pc`, `nvim`)
- **stow dir** — the root of this repo (where the packages live)
- **target dir** — usually `$HOME` (where symlinks point to)

**Key flags:**
- `stow -S pkg` — stow a package (create symlinks)
- `stow -D pkg` — unstow a package (remove symlinks)
- `stow -R pkg` — restow (unstow + stow, useful after edits)
- `stow -t DIR pkg` — specify target directory (defaults to parent of stow dir)
- `stow -n` / `--simulate` — preview what would happen without making changes
- `stow --override='.*'` — force overwrite existing symlinks (use with caution)
- `stow --ignore=REGEX` — skip files matching a pattern

## This Repository's Structure

```
dotfiles/
├── omarchy/      # omarchy defaults (sources user customization files)
├── bash/          # (future) all user bash customizations
├── nvim/          # Neovim configuration
├── tmux/          # tmux configuration
├── pc/            # hardware-specific settings (monitor-name-specific-hardware.conf, etc.)
└── notebook/       # hardware-specific settings
```

**Package roles:**
- `omarchy/` — minimal default configurations that source user customization files. Don't edit omarchy directly for personal settings.
- `bash/` — (future) all user bash customizations: aliases, functions, paths, etc. omarchy's `.bashrc` sources files from here.
- `nvim/`, `tmux/` — program-specific configurations
- `pc/`, `notebook/` — hardware-specific only (input, monitors, etc.)
- `agents/` — opencode config and skills (see Agent configs section below)

## The Hardware-Specific Pattern

Hardware packages (`pc/`, `notebook/`) only contain `*-specific-hardware.conf` files. This avoids duplicates with program packages.

**Pattern:**
```
omarchy/.config/hypr/monitors.conf
# ... shared monitor settings ...
source = monitors-specific-hardware.conf  # at the end

pc/.config/hypr/monitors-specific-hardware.conf
notebook/.config/hypr/monitors-specific-hardware.conf
```

When stowing:
1. Hardware is stowed first → creates `~/.config/hypr/monitors-specific-hardware.conf`
2. Program (omarchy) is stowed → `~/.config/hypr/monitors.conf` sources the file that now exists

This keeps hardware-specific overrides separate from shared config, with no file conflicts.

## The omarchy → User Customization Pattern

omarchy packages are **foundational** — they set up defaults and source user customization files. This means:

1. omarchy can be updated without overwriting user settings
2. User customizations live in their own packages (bash/, etc.)
3. omarchy configs don't need editing for personal preferences

**Example:** omarchy's `.bashrc` sources `bash-customizations.conf` from the `bash/` package.

## Stow Order

When syncing, hardware packages should be stowed **before** program packages:

```bash
# On PC
stow pc && stow omarchy

# On notebook
stow notebook && stow omarchy
```

This ensures hardware-specific files exist when program configs source them.

## Scenario Recommendations

When the user asks about syncing, adding, or modifying configs, recommend the appropriate scenario:

### "I want to add a new program config"
→ Add the config file to the appropriate program package (omarchy, nvim, tmux)
→ Stow the package: `stow omarchy` (or `stow nvim`, etc.)

### "I want to add a bash customization"
→ Edit files in `bash/` (the bash customizations package)
→ omarchy's `.bashrc` will automatically source them

### "I'm adding a hardware-specific setting (monitor, input, etc.)"
→ Create `*-specific-hardware.conf` in `pc/` or `notebook/` with only the hardware-specific lines
→ Source it from the main program config: `source = filename-specific-hardware.conf`
→ Stow: `stow pc && stow omarchy` (hardware first, then program)

### "I'm on a different machine / new install"
→ Stow hardware profile first, then program packages:
```bash
stow pc              # or: stow notebook
stow omarchy
stow nvim
stow tmux
stow agents         # opencode + skills
```

### "omarchy package was updated"
→ Restow: `stow -R omarchy`
→ Your hardware-specific files in `pc/` or `notebook/` are untouched

### "I want to remove a config"
→ Unstow: `stow -D package`
→ Files remain in the repo if you want to re-stow later

### "I want to see what would happen before making changes"
→ Simulate: `stow -n -v omarchy`
→ Review the output, then run without `-n`

## Adding Configs — Step by Step

### Adding a shared config (same on all machines)

1. Identify the program package (omarchy for Hyprland, nvim for Neovim, tmux for tmux)
2. Add or edit the config file in that package
3. Run `stow program-package`

### Adding a hardware-specific override

1. Create `config-name-specific-hardware.conf` in `pc/` or `notebook/` with only the hardware-specific lines
2. In the program's main config, add `source = config-name-specific-hardware.conf` at the end
3. Stow in order: `stow hardware-package && stow program-package`

### Adding a new package

1. Create a new directory under `dotfiles/` with the config files inside (matching the target directory structure)
2. Run `stow package-name`
3. The symlinks will be created pointing into the repo

## Example Commands

```bash
# See all available packages
ls dotfiles/

# Preview stow results without making changes
stow -n -v

# Stow specific packages
stow omarchy nvim tmux

# Unstow (remove symlinks but keep repo files)
stow -D package

# Restow after editing a package
stow -R package

# Stow with custom target
stow -t $HOME package
```

## Key Principles

1. **Hardware packages are minimal** — only `*-specific-hardware.conf` files, no shared configs
2. **Program packages source hw files** — omarchy configs source hardware-specific files at the end
3. **Stow order matters** — hardware first, programs last (so hw files exist when programs source them)
4. **omarchy is foundational** — minimal defaults that source user customization packages
5. **User customizations live separately** — in `bash/` and similar packages, not in omarchy

## Agent Configs (agents/)

The `agents/` package manages opencode and skills via stow:

```
agents/
├── .config/opencode/    # -> ~/.config/opencode/
│   └── opencode.json
├── .agents/             # -> ~/.agents/
│   └── skills/
│       ├── sync-dotfiles/
│       ├── find-skills/
│       └── ...
```

**Note:** The `omarchy` skill is NOT synced — it's installed by omarchy at `~/.local/share/omarchy/`.

### Adding a new skill

1. Copy the skill folder to `agents/.agents/skills/`
2. Run `stow -R agents`
3. Verify: `ls -la ~/.agents/skills/` should show symlinks

### Verifying the setup

After stowing, verify everything works:

```bash
# Check skills symlinks
ls -la ~/.agents/skills/

# Check opencode symlink
ls -la ~/.config/opencode/
readlink ~/.config/opencode/opencode.json

# Test reading a config
cat ~/.config/opencode/opencode.json
```

If a symlink conflicts with an existing file, remove the file first:
```bash
rm ~/.config/opencode/opencode.json
stow -R agents
```
