return {
  {
    "mason-org/mason.nvim",
    opts = { ensure_installed = { "gdtoolkit" } },
  },
  {
    "habamax/vim-godot",
    ft = { "gdscript", "gdshader", "gdresource" },
    event = "vimEnter",
    init = function()
      print("print entro")
      -- Se ejecuta al arrancar Neovim (Startup)
      local projectfile = vim.fn.getcwd() .. "/project.godot"

      -- Verificamos si estamos en la raíz de un proyecto de Godot
      if vim.fn.filereadable(projectfile) == 1 then
        -- Solo intenta iniciar si no hay un servidor ya activo
        -- Usamos pcall para evitar que un error bloquee el arranque de Neovim
        local ok, _ = pcall(vim.fn.serverstart, "./godothost")
        if ok then
          print("RPC Server started at ./godothost")
        end
      end
    end,
    keys = {
      { "<F4>", "<cmd>GodotRunLast<cr>", desc = "Godot: Run Last" },
      { "<F5>", "<cmd>GodotRun<cr>", desc = "Godot: Run Project" },
      { "<F6>", "<cmd>GodotRunCurrent<cr>", desc = "Godot: Run Current Scene" },
      { "<F7>", "<cmd>GodotStop<cr>", desc = "Godot: Stop" },
    },
  },
  {
    "nvim-treesitter/nvim-treesitter",
    opts = {
      ensure_installed = {
        "gdscript",
        "godot_resource", -- Optional, for highlighting resource files
        "gdshader",
      },
      indent = {
        enable = true,
        -- ONLY disable for gdscript to use vim-godot's logic
        disable = { "gdscript" },
      },
    },
  },
  -- LSP setting
  {
    "neovim/nvim-lspconfig",
    opts = {
      ---@type lspconfig.options
      servers = {
        gdscript = {},
      },
    },
    -- config = function()
    --   local lspconfig = require("lspconfig")
    --
    --   lspconfig.gdscript.setup({
    --     -- IMPORTANTE: vim.lsp.rpc.connect devuelve una función.
    --     -- Neovim 0.10+ lo entiende perfectamente como 'cmd'.
    --     cmd = vim.lsp.rpc.connect("127.0.0.1", 6005),
    --
    --     root_dir = lspconfig.util.root_pattern("project.godot", ".git"),
    --
    --     -- Opcional: Esto ayuda a depurar si el LSP se conecta
    --     on_attach = function(client, bufnr)
    --       print("LSP de Godot conectado correctamente!")
    --     end,
    --   })
    -- end,
  },
}
