/**
 * 教师看板 / 学生云同步的 API 地址解析。
 *
 * 后端 /api/* 由 Cloudflare Pages Functions 提供，只在 Pages 域名下可用。
 * 课程同时发布到多个静态入口(Cloudflare Pages、WorkBuddy 静态站、本地预览)，
 * 后两者没有 Functions，必须把请求指向 Pages 域名 —— 此时是跨源请求，
 * 依赖 functions/_middleware.ts 的 CORS 白名单放行。
 *
 * 判据用 location.hostname：
 *   · Pages 生产域名 spider-c.pages.dev 及其预览分支 *.spider-c.pages.dev → 同源，相对路径
 *   · 其它(workbuddy.host / localhost / file:) → 指向 Pages 绝对地址
 * 若将来 Pages 绑定自定义域名，把它加入 PAGES_HOSTS 即可。
 */

/** 承载 Pages Functions 的源站(不带尾斜杠) */
export const PAGES_ORIGIN = 'https://spider-c.pages.dev';

/** 这些 host 上 /api/* 同源可用，用相对路径 */
const PAGES_HOSTS = new Set(['spider-c.pages.dev']);

export function apiBase(): string {
  if (typeof location === 'undefined') return PAGES_ORIGIN;
  const host = location.hostname;
  if (PAGES_HOSTS.has(host) || host.endsWith('.spider-c.pages.dev')) return '';
  return PAGES_ORIGIN;
}

/** 生成完整 API URL。path 需带前导斜杠，如 '/overview' */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase()}/api${p}`;
}
