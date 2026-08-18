-- Converted from looknfeel.conf
-- Change the default Omarchy look'n'feel.

hl.config({
  general = {
    -- No gaps between windows or borders
    gaps_in = 0,
    gaps_out = 0,
    border_size = 4,
  },
})

-- Decoration options (uncomment or adjust as desired)
hl.config({
  decoration = {
    -- Use round window corners
    -- rounding = 8,

    -- Dim unfocused windows (0.0 = no dim, 1.0 = fully dimmed)
    -- dim_inactive = true,
    -- dim_strength = 0.15,
  },
})

-- Animations
hl.config({
  animations = {
    -- Disable all animations
    -- enabled = false,
  },
})

-- Layout tweaks
hl.config({
  layout = {
    -- Avoid overly wide single-window layouts on wide screens
    -- single_window_aspect_ratio = { 1, 1 },
  },
})

-- Scrolling layout options
hl.config({
  scrolling = {
    -- See only one column per screen instead of two
    -- column_width = 0.97,
  },
})
