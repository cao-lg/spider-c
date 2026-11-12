/**
 * 全站登录条 + 微信网站登录回调分发。
 *
 * 关键约束(来自云认证文档):
 * 1. redirectTo 必须是站点根路径 —— 静态托管没有 history fallback,子路径回调会 404 丢 code。
 * 2. 回根路径时保留业务参数(尤其是分享链接的 sharecode),否则登录后裸域名访问会被拒。
 * 3. 无论回调成功、失败还是抛异常,都必须清掉 code/state/provider —— code 是一次性的,
 *    留在地址栏会在刷新时重放;清理时只删回调参数,不能整段清空 query(sharecode 必须保留)。
 * 4. 按 provider 精确分发到对应 handler,不要无条件调用两个回调。
 * 5. render() 会重写状态文案,错误提示必须在 render() 之后设置,否则会被「未登录」覆盖。
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

const CALLBACK_KEYS = ['code', 'state', 'provider', 'error', 'error_code', 'error_description'];

/** 只删回调参数,保留 sharecode 等业务参数;无论回调成功与否都要执行。 */
function stripCallbackParams(): void {
  const url = new URL(location.href);
  let changed = false;
  for (const key of CALLBACK_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

/** render() 会重写状态文案,错误提示必须在 render() 之后设置。 */
function renderWithError(session: CloudSessionData, message: string): void {
  render(session);
  status(message, 'error');
}

async function restoreAuth(): Promise<void> {
  const url = new URL(location.href);
  const hasCallback = CALLBACK_KEYS.some((key) => url.searchParams.has(key));

  if (!hasCallback) {
    render(await currentSession());
    return;
  }

  const provider = url.searchParams.get('provider');
  const callbackError = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  // 关键:handler 需要读 location.search 里的 code/state,所以清理只能放在 finally,
  // 但必须保证成功 / 失败 / 抛异常三条路径都执行,否则刷新会重放一次性 code。
  try {
    if (callbackError) {
      renderWithError(await currentSession(), `登录未完成:${callbackError}。请重新点击「微信登录」。`);
      return;
    }
    if (provider !== 'wechat' && provider !== 'workbuddy') {
      renderWithError(await currentSession(), '授权回调缺少有效的登录方式,请重新登录。');
      return;
    }

    const handler =
      provider === 'wechat'
        ? cloud.auth.handleWechatWebCallback
        : cloud.auth.handleWorkBuddyCallback;

    if (typeof handler !== 'function') {
      renderWithError(await currentSession(), '当前 SDK 不支持此登录方式,请联系管理员。');
      return;
    }

    const result = await handler.call(cloud.auth);
    if (result.error) {
      renderWithError(await currentSession(), `登录失败:${errorMessage(result.error, '请重新登录')}`);
      return;
    }
    render(result.data ?? (await currentSession()));
  } finally {
    stripCallbackParams();
  }
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
    for (const key of CALLBACK_KEYS) back.searchParams.delete(key);

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
