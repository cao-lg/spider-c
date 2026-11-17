// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  // 课程前端(含 /practice/ 靶站)托管于 Cloudflare Pages 静态托管,实测可用。
  // crawler-course.app.workbuddy.host 仅为云后端/BaaS 网关(身份/数据库/文件/LLM),
  // 不服务 /practice/ 静态靶站,故不作为 site。见 cloud-config.ts 的 endpoint。
  site: 'https://spider-c.pages.dev',
  output: 'static',
  integrations: [mdx()],
  vite: {
    build: {
      chunkSizeWarningLimit: 1600,
    },
  },
});
