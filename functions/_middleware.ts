// 全局 CORS 中间件：让静态站(如 WorkBuddy Pages)也能跨域调用 /api/*。
//
// 背景：教师看板与学生云同步走同源相对路径 /api/*。当站点托管在没有 Pages
// Functions 的静态平台时，前端会把请求指向 Cloudflare Pages 域名，此时是跨源
// 请求且带 Authorization 头，必须先过 CORS 预检。Cloudflare Pages 的
// functions/_middleware.ts 会在所有 functions 路由前执行，正适合统一注入 CORS。
//
// 安全：只允许白名单来源，绝不回显任意 Origin 或通配 `*`。
//  · Spider-C 自身 Pages 域名（同源，一般无需 CORS，带上无害）
//  · WorkBuddy 静态站（本课程的第二个发布入口）
//  · 本地开发 localhost / 127.0.0.1
// 如需新增域名，在此处 ALLOWED_ORIGINS 增加精确匹配项即可。

const ALLOWED_ORIGINS: string[] = [
  'https://spider-c.pages.dev',
  'https://crawler-course.app.workbuddy.host',
];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // 本地开发(含 Vite/Astro 任意端口)
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function withCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = async (context: {
  request: Request;
  env: Record<string, unknown>;
  next: () => Promise<Response>;
}): Promise<Response> => {
  const origin = context.request.headers.get('Origin') ?? '';

  // 预检：短路返回，不进入业务函数(业务函数没有 onRequestOptions)
  if (context.request.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      return new Response(null, { status: 403 });
    }
    return withCors(new Response(null, { status: 204 }), origin);
  }

  const response = await context.next();
  if (!isAllowedOrigin(origin)) return response;
  return withCors(response, origin);
};
