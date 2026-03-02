# lore_v2

An Astro 5 static site deployed to [lore.ghst.tools](https://lore.ghst.tools).

## Key Commands

```sh
npm run dev       # Start dev server at localhost:4321
npm run build     # Build production site to ./dist/
npm run preview   # Preview production build locally
npm run astro     # Run Astro CLI (e.g. astro add, astro check)
```

## Stack

- **Astro 5** — static site generator, file-based routing
- **TypeScript** — strict mode (`astro/tsconfigs/strict`)
- **GoatCounter** — web analytics (configured in `Head.astro`)
- No UI framework (plain `.astro` components)

## Project Structure

```
src/
  assets/         Static assets imported by components (SVGs, etc.)
  components/
    Head.astro    <head> meta, OG tags, analytics, favicon — used in layouts
    MainLayout.astro  Main page shell using Head.astro
    Welcome.astro Default starter welcome component
  layouts/
    Layout.astro  Base HTML shell with <slot /> for page content
  pages/
    index.astro   Home page
    posts/        Blog/lore posts as Markdown files
public/
  favicon.ico
  favicon.svg
```

## Config

- **`astro.config.mjs`** — site URL `https://lore.ghst.tools`, `trailingSlash: "always"`
- **`tsconfig.json`** — extends `astro/tsconfigs/strict`

## MCP Servers

- **Astro docs** — use `mcp__astro__search_astro_docs` to search the official Astro documentation without leaving the session

## Conventions

- Pages live in `src/pages/` and are auto-routed by filename
- Markdown posts go in `src/pages/posts/` (file-based routing, no content collections yet)
- Shared `<head>` elements belong in `src/components/Head.astro`
- `MainLayout.astro` is the preferred layout wrapper for new pages (uses `Head.astro`)
- `Layout.astro` is the original starter layout — prefer `MainLayout.astro` for new work
