-- Fijar workspaces a monitores.
-- Lista de monitores con: hyprctl monitors all
local monitors = {
  left = "DP-1",  -- 1-4
  right = "DP-2", -- 5-8
}

for i = 1, 4 do
  hl.workspace_rule({ workspace = tostring(i), monitor = monitors.left })
end
for i = 5, 8 do
  hl.workspace_rule({ workspace = tostring(i), monitor = monitors.right })
end
