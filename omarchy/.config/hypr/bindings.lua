-- AUTOMATIC: original bindings file (commented)

-- -- Converted from bindings.conf
-- -- This file contains personal keybindings. Use o.bind("MOD + KEY", "Name", "command")
-- 
-- -- Application bindings
-- -- CUSTOM: override default Terminal bind
-- hl.unbind("SUPER + RETURN")
-- o.bind("SUPER + RETURN", "Terminal", 'uwsm-app -- xdg-terminal-exec --dir="$(omarchy-cmd-terminal-cwd)"')
-- o.bind("SUPER + ALT + RETURN", "Tmux", 'uwsm-app -- xdg-terminal-exec --dir="$(omarchy-cmd-terminal-cwd)" bash -c "tmux attach || tmux new -s Work"')
-- -- CUSTOM: override default Browser bind
-- hl.unbind("SUPER + SHIFT + RETURN")
-- o.bind("SUPER + SHIFT + RETURN", "Browser", "omarchy-launch-browser")
-- o.bind("SUPER + SHIFT + F", "File manager", "uwsm-app -- nautilus --new-window")
-- -- CUSTOM: override default File manager (cwd)
-- hl.unbind("SUPER + ALT + SHIFT + F")
-- o.bind("SUPER + ALT + SHIFT + F", "File manager (cwd)", 'uwsm-app -- nautilus --new-window "$(omarchy-cmd-terminal-cwd)"')
-- -- CUSTOM: override default Browser (secondary)
-- hl.unbind("SUPER + SHIFT + B")
-- o.bind("SUPER + SHIFT + B", "Browser", "omarchy-launch-browser")
-- o.bind("SUPER + SHIFT + ALT + B", "Browser (private)", "omarchy-launch-browser --private")
-- -- CUSTOM: override default Music TUI
-- hl.unbind("SUPER + SHIFT + ALT + M")
-- o.bind("SUPER + SHIFT + ALT + M", "Music TUI", "omarchy-launch-or-focus-tui cliamp")
--     -- CUSTOM: override default Editor
--     hl.unbind("SUPER + SHIFT + N")
--     o.bind("SUPER + SHIFT + N", "Editor", "omarchy-launch-editor")
-- -- CUSTOM: override default Docker
-- hl.unbind("SUPER + SHIFT + D")
-- o.bind("SUPER + SHIFT + D", "Docker", "omarchy-launch-tui lazydocker")
-- -- CUSTOM: override default Obsidian
-- hl.unbind("SUPER + SHIFT + O")
-- o.bind("SUPER + SHIFT + O", "Obsidian", 'omarchy-launch-or-focus ^obsidian$ "uwsm-app -- obsidian"')
-- -- CUSTOM: override default Typora
-- hl.unbind("SUPER + SHIFT + W")
-- o.bind("SUPER + SHIFT + W", "Typora", "uwsm-app -- typora --enable-wayland-ime")
-- -- CUSTOM: override default Passwords
-- hl.unbind("SUPER + SHIFT + SLASH")
-- o.bind("SUPER + SHIFT + SLASH", "Passwords", "uwsm-app -- bitwarden-desktop")
-- 
-- -- Web apps / AI
-- -- CUSTOM: override default Chat/webapp bindings where desired
-- hl.unbind("SUPER + SHIFT + A")
-- o.bind("SUPER + SHIFT + A", "Gemini", 'omarchy-launch-or-focus-webapp Gemini "https://gemini.google.com"')
-- hl.unbind("SUPER + SHIFT + ALT + A")
-- o.bind("SUPER + SHIFT + ALT + A", "ChatGPT", 'omarchy-launch-or-focus-webapp ChatGPT "https://chatgpt.com"')
-- hl.unbind("SUPER + SHIFT + CTRL + A")
-- o.bind("SUPER + SHIFT + CTRL + A", "Grok", 'omarchy-launch-or-focus-webapp Grok "https://grok.com"')
-- 
-- -- Utils
-- -- CUSTOM: override default webapp utils where desired
-- hl.unbind("SUPER + SHIFT + C")
-- o.bind("SUPER + SHIFT + C", "Calendar", 'omarchy-launch-webapp "https://calendar.google.com"')
-- hl.unbind("SUPER + SHIFT + E")
-- o.bind("SUPER + SHIFT + E", "Email", 'omarchy-launch-webapp "https://gmail.com"')
-- hl.unbind("SUPER + SHIFT + Y")
-- o.bind("SUPER + SHIFT + Y", "YouTube", 'omarchy-launch-webapp "https://youtube.com/"')
-- hl.unbind("SUPER + SHIFT + P")
-- o.bind("SUPER + SHIFT + P", "Google Photos", 'omarchy-launch-or-focus-webapp "Google Photos" "https://photos.google.com/"')
-- hl.unbind("SUPER + SHIFT + X")
-- o.bind("SUPER + SHIFT + X", "X", 'omarchy-launch-or-focus-webapp X "https://x.com/"')
-- hl.unbind("SUPER + SHIFT + M")
-- o.bind("SUPER + SHIFT + M", "Youtube Music", 'omarchy-launch-or-focus-webapp "Youtube Music" "https://music.youtube.com/"')
-- 
-- -- Messages
-- -- Use a wrapper that ensures WhatsApp windows land in the scratchpad
-- o.bind("SUPER + SHIFT + G", "WhatsApp", '"/home/luis/.local/bin/launch-whatsapp"')
-- o.bind("SUPER + SHIFT + CTRL + G", "Telegram", 'omarchy-launch-or-focus-webapp Telegram "https://web.telegram.org/"')
-- o.bind("SUPER + SHIFT + ALT + G", "Google Messages", 'omarchy-launch-or-focus-webapp "Google Messages" "https://messages.google.com/web/conversations"')
-- 
-- -- Monitor controls and brightness
-- o.bind("SUPER + F1", nil, "ddcutil setvcp 60 0x0f")
-- o.bind("SUPER + F2", nil, "ddcutil setvcp 60 0x12")
-- o.bind("SUPER + F3", nil, "ddcutil --display 2 setvcp 60 0x0f")
-- o.bind("SUPER + F4", nil, "ddcutil --display 2 setvcp 60 0x11")
-- o.bind("SUPER + F5", nil, "ddcutil --display 1 setvcp 10 0; ddcutil --display 2 setvcp 10 0")
-- o.bind("SUPER + F6", nil, "ddcutil --display 1 setvcp 10 30; ddcutil --display 2 setvcp 10 30")
-- o.bind("SUPER + F7", nil, "ddcutil --display 1 setvcp 10 70; ddcutil --display 2 setvcp 10 70")
-- o.bind("SUPER + F8", nil, "ddcutil --display 1 setvcp 10 100; ddcutil --display 2 setvcp 10 100")
-- o.bind("SUPER + F9", "Toggle monitor layout", "toggle-monitors")
-- 
-- -- Overwrite existing bindings example (unbind then bind):
-- -- hl.unbind("SUPER + SPACE")
-- -- o.bind("SUPER + SPACE", "Omarchy menu", "omarchy-menu")

-- ACTIVE CUSTOM BINDS (only keys not present in Omarchy defaults)

-- This file contains personal keybindings. Use o.bind("MOD + KEY", "Name", "command")
o.bind("SUPER + F1", nil, "ddcutil setvcp 60 0x0f")
o.bind("SUPER + F2", nil, "ddcutil setvcp 60 0x12")
o.bind("SUPER + F3", nil, "ddcutil --display 2 setvcp 60 0x0f")
o.bind("SUPER + F4", nil, "ddcutil --display 2 setvcp 60 0x11")
o.bind("SUPER + F5", nil, "ddcutil --display 1 setvcp 10 0; ddcutil --display 2 setvcp 10 0")
o.bind("SUPER + F6", nil, "ddcutil --display 1 setvcp 10 30; ddcutil --display 2 setvcp 10 30")
o.bind("SUPER + F7", nil, "ddcutil --display 1 setvcp 10 70; ddcutil --display 2 setvcp 10 70")
o.bind("SUPER + F8", nil, "ddcutil --display 1 setvcp 10 100; ddcutil --display 2 setvcp 10 100")
o.bind("SUPER + F9", "Toggle monitor layout", "toggle-monitors")
