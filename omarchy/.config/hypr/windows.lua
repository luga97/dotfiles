-- Converted from windows.conf
-- Window rules: match classes and set properties.

o.window("steam", { tile = true })

-- WhatsApp Web: always open in the scratchpad workspace and do not follow
-- Focus behavior is handled by the launcher; the rule pins the window to
-- the special scratchpad workspace so it is consistently available there.
-- Match by title to catch different webapp/bundle variants (Brave/Chromium/etc).
-- Use a regex that matches either the site host or the visible app title.
o.window({ title = ".*(web\\.whatsapp\\.com|WhatsApp).*" }, { workspace = "special:scratchpad" })

-- Some webapp wrappers set a WM_CLASS like chrome-web.whatsapp.com__-Default.
-- Add a class-based rule as a fallback to ensure WhatsApp always lands in
-- the scratchpad regardless of title timing or title changes during load.
o.window({ class = "^chrome-web\\.whatsapp\\.com" }, { workspace = "special:scratchpad" })
