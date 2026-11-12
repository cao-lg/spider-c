/**
 * 全站登录条 + 微信网站登录回调分发。
 *
 * 关键约束(来自云认证文档):
 * 1. redirectTo 必须是站点根路径 —— 静态托管没有 history fallback,子路径回调会 404 丢 code。
 * 2. 回根路径时保留业务参数(尤其是分享链接的 sharecode),否则登录后裸域名访问会被拒。
 * 3. 回调成功必须清掉 code/state/provider,只删这三个,不能整段清空 query。
 * 4. 按 provider 精确分发到对应 handler,不要无条件调用两个回调。
 */
import { cloud, currentSession, emitAuth, errorMessage } from '../lib/cloud';
import type { CloudSessionData } from '../lib/cloud';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少元素 #${id}`);
  return node as T;
}

function status(text: string, kind: 'info' | 'error' = 'info'): void {
  const node = el('auth-status');
  node.textContent = text;
  node.dataset.kind = kind;
}

function render(session: CloudSessionData): void {
  const loginBtn = el<HTMLButtonElement>('auth-login');
  const userBox = el('auth-user');
  const uidBox = el('auth-uid');

  if (!session) {
    status('未登录 · 课程可照常浏览');
    loginBtn.hidden = false;
    userBox.hidden = true;
    el('auth-uid-box').hidden = true;
    emitAuth(null);
    return;
  }

  const uid = session.user.id ?? '';
  status(`已登录 · ${uid.slice(0, 6)}…`);
  loginBtn.hidden = true;
  userBox.hidden = false;
  uidBox.textContent = uid;
  el('auth-uid-box').hidden = false;
  emitAuth(session);
}

async function restoreAuth(): Promise<void> {
  const url = new URL(location.href);
  const hasCallback = url.searchParams.has('code') || url.searchParams.has('error');

  if (hasCallback) {
    const provider = url.searchParams.get('provider');
    if (provider !== 'wechat' && provider !== 'workbuddy') {
      status('授权回调缺少有效的登录方式,请重新登录。', 'error');
      render(await currentSession());
      return;
    }

    const handler =
      provider === 'wechat'
        ? cloud.auth.handleWechatWebCallback
        : cloud.auth.handleWorkBuddyCallback;

    if (typeof handler !== 'function') {
      status('当前 SDK 不支持此登录方式,请联系管理员。', 'error');
      render(await currentSession());
      return;
    }

    const result = await handler.call(cloud.auth);
    if (result.error) {
      status(`登录失败:${errorMessage(result.error, '请重新登录')}`, 'error');
      render(await currentSession());
      return;
    }
    if (result.data) {
      // 只删回调参数,保留 sharecode 等业务参数;code 是一次性的,留在地址栏会在刷新时重放。
      for (const key of ['code', 'state', 'provider']) url.searchParams.delete(key);
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      render(result.data);
      return;
    }
  }

  render(await currentSession());
}

async function copyUid(): Promise<void> {
  const uid = el('auth-uid').textContent?.trim() ?? '';
  if (!uid) return;
  const button = el<HTMLButtonElement>('auth-copy');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(uid);
    } else {
      const area = document.createElement('textarea');
      area.value = uid;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    button.textContent = '已复制 ✓';
    window.setTimeout(() => (button.textContent = '复制 uid'), 1800);
  } catch {
    status('浏览器拒绝了剪贴板访问,请手动选中下面的 uid 复制。', 'error');
    el('auth-uid-box').hidden = false;
  }
}

function bind(): void {
  el<HTMLButtonElement>('auth-login').addEventListener('click', async () => {
    const button = el<HTMLButtonElement>('auth-login');
    button.disabled = true;
    status('正在跳转微信登录…');

    const back = new URL(location.href);
    back.pathname = '/';
    back.hash = '';
    for (const key of ['code', 'state', 'provider']) back.searchParams.delete(key);

    try {
      const { data, error } = await cloud.auth.signInWithOAuth({
        provider: 'wechat',
        redirectTo: back.toString(),
      });
      if (error) {
        status(`无法发起登录:${errorMessage(error, '请稍后重试')}`, 'error');
        button.disabled = false;
        return;
      }
      // 必须同标签页跳转;PKCE 证明存在当前标签页的 sessionStorage 里。
      location.assign(data.url);
    } catch (error) {
      status(`无法发起登录:${errorMessage(error)}`, 'error');
      button.disabled = false;
    }
  });

  el<HTMLButtonElement>('auth-copy').addEventListener('click', () => void copyUid());

  el<HTMLButtonElement>('auth-logout').addEventListener('click', async () => {
    const { error } = await cloud.auth.signOut();
    if (error) {
      status(`退出失败:${errorMessage(error)}`, 'error');
      return;
    }
    render(null);
  });
}

bind();
void restoreAuth().catch((error) => {
  status(`登录状态检查失败:${errorMessage(error, '请检查网络')}`, 'error');
  render(null);
});
