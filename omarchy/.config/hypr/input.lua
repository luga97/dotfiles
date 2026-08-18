-- Converted from input.conf
-- Keep only personal input overrides here. See Hyprland docs for details.

hl.config({
  input = {
    -- Change speed of keyboard repeat
    repeat_rate = 40,
    repeat_delay = 250,

    -- Start with numlock on by default
    numlock_by_default = true,

    touchpad = {
      -- Two-finger clicks for right-click
      clickfinger_behavior = true,

      -- Control the speed of your scrolling
      scroll_factor = 0.4,
    },
  },
})

-- App-specific touchpad scroll speeds (translated from windowrule)
o.window("(Alacritty|kitty|foot)", { scroll_touchpad = 1.5 })
o.window("com.mitchellh.ghostty", { scroll_touchpad = 0.2 })

-- Hardware-specific input overrides are still loaded from input-specific-hardware.conf
