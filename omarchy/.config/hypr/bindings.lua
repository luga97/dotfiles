-- Keep only your personal keybinding overrides here. Add new bindings or
-- unbind defaults before replacing them.

-- See current bindings and descriptions:
--   omarchy menu keybindings --print

-- To disable every Omarchy default binding, set this in
-- ~/.config/hypr/hyprland.lua before require("default.hypr.omarchy"), then add
-- only the bindings you want below:
--   omarchy_default_bindings = false

-- To disable all preinstalled app/webapp bindings, set:
--   omarchy_preinstalled_bindings = false

-- Add a new binding.
-- o.bind("SUPER + SHIFT + R", "SSH", "alacritty -e ssh your-server")

-- Change an existing binding by unbinding it first, then binding the key again.
-- This example changes SUPER+SPACE from the launcher to the Omarchy root menu.
-- hl.unbind("SUPER + SPACE")
-- o.bind("SUPER + SPACE", "Omarchy menu", "omarchy-menu toggle root")

-- Disable a default binding without replacing it.
-- hl.unbind("SUPER + SHIFT + B")

-- Logitech MX Keys examples:
-- o.bind("SUPER + SHIFT + S", nil, "omarchy-capture-screenshot")
-- o.bind("SUPER + H", nil, "voxtype record toggle")
-- o.bind("SUPER + PERIOD", nil, "omarchy-shell shell toggle omarchy.emojis")

-- The agent (opencode) appears to capture SUPER+SHIFT+G. Use a different
-- combination less likely to be grabbed by the agent. We keep the same
-- behavior (launch/focus the webapp).
hl.unbind("SUPER + SHIFT + G")
o.bind("SUPER + SHIFT + G", "WhatsApp", { webapp = "https://web.whatsapp.com/", focus = true })

-- Bind SUPER+SHIFT+ALT+G to the installed Telegram webapp.
hl.unbind("SUPER + SHIFT + ALT + G")
o.bind("SUPER + SHIFT + ALT + G", "Telegram", { webapp = "https://web.telegram.org/", focus = true })

--disable cliamp, is removed
hl.unbind("SUPER + SHIFT + ALT + M")
--set youtube music
hl.unbind("SUPER + SHIFT + M")
o.bind("SUPER + SHIFT + M", "Youtube Music", { webapp = "https://music.youtube.com", focus = true })

--set google translator
o.bind("SUPER + SHIFT + T", "Translator", { webapp = "https://translate.google.com/", focus = true })

--remap email client

hl.unbind("SUPER + SHIFT + E")
o.bind("SUPER + SHIFT + E", "Gmail", { webapp = "https://mail.google.com", focus = true })

hl.unbind("SUPER + SHIFT + C")
o.bind("SUPER + SHIFT + C", "Calendar", { webapp = "https://calendar.google.com", focus = true })
