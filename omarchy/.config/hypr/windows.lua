-- Converted from windows.conf
-- Window rules: match classes and set properties.

o.window("steam", { tile = "on" })

-- WhatsApp Web: always open in the scratchpad workspace and do not follow
-- Focus behavior is handled by the launcher; the rule pins the window to
-- the special scratchpad workspace so it is consistently available there.
o.window({ title = ".*web.whatsapp.com.*", class = "chrome-web.whatsapp.com__-Default" }, { workspace = "special:scratchpad", follow = false })
-- WhatsApp Web: always open in the scratchpad workspace and do not follow
-- Focus behavior is handled by the launcher; the rule pins the window to
-- the special scratchpad workspace so it is consistently available there.
o.window({ title = ".*web.whatsapp.com.*", class = "chrome-web.whatsapp.com__-Default" }, { workspace = "special:scratchpad", follow = false })
