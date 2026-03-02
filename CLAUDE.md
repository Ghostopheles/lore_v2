# lore_v2

Ghost's Lore — An Astro 5 static site deployed to [lore.ghst.tools](https://lore.ghst.tools).

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
  config/
    author.ts     AUTHOR constant (name, title, avatar, socials)
  components/
    Head.astro    <head> meta, OG tags, analytics, favicon — used in layouts
    Nav.astro     Sticky nav — wordmark (Home) left, nav links right
    MainLayout.astro  Main page shell using Head.astro
    AuthorCard.astro  Author avatar + name + social icon links
    PostCard.astro    Post preview card (used on home page)
  content/
    posts/        Markdown blog posts (content collections)
    config.ts     Zod schema for posts collection
  layouts/
    Layout.astro  Original starter layout (avoid for new work)
    PostLayout.astro  Blog post layout — sticky sidebar + prose grid
  pages/
    index.astro   Home page
    posts/
      [slug].astro  Dynamic route for all blog posts
    links.astro   Links page (socials, projects & tools)
    tags/
      [tag].astro   Tag index pages
  styles/
    global.css    Design tokens, reset, global utilities
public/
  favicon.ico
  favicon.svg
```

## Config

- **`astro.config.mjs`** — site URL `https://lore.ghst.tools`, `trailingSlash: "always"`
- **`tsconfig.json`** — extends `astro/tsconfigs/strict`

## MCP Servers

- **Astro docs** — use `mcp__astro__search_astro_docs` to search the official Astro documentation without leaving the session

## Layout Conventions

- All page containers use `max-width: 1400px` — nav-inner, PostLayout main, and `.container` (via `--content-width`) all match; don't introduce narrower widths or they'll appear misaligned
- `Nav.astro` pattern: wordmark link on the left, nav links flex-row on the right; add new nav items to `.nav-links`

## Conventions

- Pages live in `src/pages/` and are auto-routed by filename
- Blog posts go in `src/content/posts/` (content collections, Zod-validated frontmatter)
- Post URL uses `post.slug` (not `post.id` which includes the `.md` extension)
- Shared `<head>` elements belong in `src/components/Head.astro`
- `MainLayout.astro` is the preferred layout wrapper for new pages (uses `Head.astro`)
- `Layout.astro` is the original starter layout — prefer `MainLayout.astro` for new work
