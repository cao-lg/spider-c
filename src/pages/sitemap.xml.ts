import type { APIRoute } from 'astro';
import { lessons, units, courseTests } from '../data/course';

// 静态 sitemap:站点是纯静态课程站,路由可完全由数据推导,不需要额外依赖。
export const prerender = true;

const SITE = 'https://spider-c.pages.dev';

export const GET: APIRoute = () => {
  const paths: string[] = [
    '/',
    '/tutorials/',
    '/practice/',
    '/tests/',
    '/mistakes/',
    '/report/',
    '/design/',
  ];

  for (const lesson of lessons) paths.push(`/tutorials/${lesson.slug}/`);
  for (const unit of units) paths.push(`/tests/${unit.id}/`);
  for (const test of courseTests) paths.push(`/tests/course/${test.id}/`);

  const today = new Date().toISOString().slice(0, 10);
  const urls = paths
    .map(
      (p) =>
        `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod>` +
        `<changefreq>${p === '/' ? 'weekly' : 'monthly'}</changefreq>` +
        `<priority>${p === '/' ? '1.0' : p.startsWith('/tutorials/') ? '0.8' : '0.6'}</priority></url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
