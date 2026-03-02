// @ts-check
import { defineConfig } from 'astro/config';

import embeds from 'astro-embed/integration';
import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
    integrations: [embeds(), mdx()],
    site: "https://lore.ghst.tools",
    trailingSlash: "always",
    image: {
        domains: ["ghst.tools"],
    }
});