// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://crawler-course.app.workbuddy.host',
  output: 'static',
  integrations: [mdx()],
  vite: {
    build: {
      chunkSizeWarningLimit: 1600,
    },
  },
});
