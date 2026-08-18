-- Converted from monitors.conf
-- See https://wiki.hypr.land/Configuring/Basics/Monitors/

-- Set environment variables for GUI scaling.
hl.env("GDK_SCALE", "1")

-- Default monitor: prefer the preferred mode and auto position, with scale 1.
hl.monitor({ output = "", mode = "preferred", position = "auto", scale = 1 })

-- Hardware-specific overrides are still loaded from monitors-specific-hardware.conf
-- (leave monitors-specific-hardware.conf in place under the same directory).
