// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://spider-c.pages.dev',
  output: 'static',
  integrations: [mdx()],
  vite: {
    build: {
      chunkSizeWarningLimit: 1600,
    },
  },
});
