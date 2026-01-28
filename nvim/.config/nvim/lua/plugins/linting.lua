return {
  {
    "mfussenegger/nvim-lint",
    opts = {
      linters_by_ft = {
        -- This overrides LazyVim's default and tells it
        -- NOT to look for any linters for markdown.
        markdown = {},
      },
    },
  },
}
