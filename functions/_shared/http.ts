// Pages Functions 的 HTTP 薄层:只做解析与包装,业务逻辑全在 backend.ts。
// 下划线开头的目录不会被 Cloudflare Pages 生成路由。

import type { ApiResult, Env } from './backend.ts';
import { MAX_PAYLOAD } from './backend.ts';

export interface PagesContext {
  request: Request;
  env: Env;
  params?: Record<string, string>;
}

export function toResponse(result: ApiResult): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function auth(request: Request): string | null {
  return request.headers.get('Authorization');
}

export async function readBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const text = await request.text();
  if (text.length > MAX_PAYLOAD) {
    return { ok: false, response: toResponse({ status: 413, body: { ok: false, error: '请求体过大。' } }) };
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: toResponse({ status: 400, body: { ok: false, error: '请求体必须是 JSON 对象。' } }) };
  }
}

export function query(request: Request, name: string): string {
  return new URL(request.url).searchParams.get(name) ?? '';
}
