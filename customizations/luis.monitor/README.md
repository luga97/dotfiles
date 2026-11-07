# Display video-input controls

Cloned using `omarchy plugin clone omarchy.monitor` from Omarchy 4.5.0-3.
The original module/IPC id stays `omarchy.monitor`, as the clone mechanism
requires. `manifest.json` identifies the copy as `luis.monitor`.

Local additions are the video-input section, keyboard cursor support,
translations, and `input-control.py`. Brightness, text size, scale, display
toggles, and theme styling remain from the original panel. The panel can grow
to 760 logical pixels, constrained to the available screen by the native kit.

DDC reads run on open and after changes, never continuously. Changes use fixed
model/serial pairs and the same input values as the former shortcuts. Both
displays are attempted concurrently; failures and unconfirmed inputs remain
visible. No source change occurs just by opening the panel.

## Updating the live copy

Edit this source directory, then deploy normal files (not Stow symlinks):

```bash
cp -a ~/dotfiles/customizations/luis.monitor/. ~/.config/omarchy/plugins/luis.monitor/
omarchy plugin validate ~/.config/omarchy/plugins/luis.monitor
```

QML hot-reloads. `qmllint -I /usr/share/omarchy/shell Panel.qml` checks the QML.
Run backend tests with `python3 ~/dotfiles/customizations/tests/test_monitor_inputs.py`.

## Omarchy upgrades

Clones do not automatically inherit changes from the packaged widget. Compare
the packaged Panel.qml/Model.js hashes with `upstream.sha256` after upgrades.
Review and merge upstream changes, keeping the small local input additions.
Never overwrite packaged files in `/usr/share/omarchy/`.

To restore the original panel, use `omarchy plugin disable luis.monitor`.
The native clone restoration mechanism restores `omarchy.monitor`, and the
keyboard shortcut keeps working. Reconcile the active `shell.json` with
dotfiles afterwards if a shell command replaced its symlink.
