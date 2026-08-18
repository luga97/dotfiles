-- User monitors configuration: force DP-1 to use highest refresh available for 2560x1440
-- This ensures the primary monitor runs at the panel's capable refresh (e.g. 180Hz)
local monitor_scale = 1

-- Explicitly set DP-1 to the high-refresh 2560x1440 mode when available.
-- If the mode is not present the compositor will ignore it gracefully.
hl.monitor({ output = "DP-1", mode = "2560x1440@180.00", position = "0x0", scale = monitor_scale })

-- Keep DP-2 configured as preferred; toggle-monitors script handles enabling/disabling.
hl.monitor({ output = "DP-2", mode = "preferred", position = "2560x0", scale = 1 })
