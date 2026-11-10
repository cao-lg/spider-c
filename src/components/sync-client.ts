// 学生端「云同步」(阶段 1)交互
//
// 刻意保持"默认关闭":不开通也能完整上课,离线导出/导入始终是主轴。
// 口令只在本次输入中存在,绝不写 localStorage;服务端也只存加盐哈希。
// 令牌(token)存本机以便免重复登录,退出同步即清除。

import { store } from '../lib/store';

const TOKEN_KEY = 'crawler-course:sync-token';
const META_KEY = 'crawler-course:sync-meta';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少元素 #${id}`);
  return node as T;
}

interface SyncMeta {
  studentId: string;
  classId: string;
}

function readMeta(): SyncMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as SyncMeta;
    return m.studentId ? m : null;
  } catch {
    return null;
  }
}

function token(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function msg(text: string) {
  el('sync-msg').textContent = text;
}

function setStatus() {
  const meta = readMeta();
  const active = Boolean(token() && meta);
  for (const id of ['btn-sync-push', 'btn-sync-pull', 'btn-sync-disable', 'btn-sync-delete']) {
    (el(id) as HTMLButtonElement).disabled = !active;
  }
  el<HTMLButtonElement>('btn-sync-enable').textContent = active ? '重新登录 / 换设备' : '启用 / 登录';
}

async function call(path: string, init: RequestInit = {}, authToken = token()): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let resp: Response;
  try {
    resp = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new Error('网络不可达。');
  }
  const text = await resp.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      '站点还没有部署云同步服务(Pages Functions)。离线导出备份仍可正常使用,不影响课程。',
    );
  }
  if (!resp.ok) throw new Error(String(body.error ?? `HTTP ${resp.status}`));
  return body;
}

function credentials(): { studentId: string; classId: string; code: string } {
  return {
    studentId: el<HTMLInputElement>('sync-student').value.trim(),
    classId: el<HTMLInputElement>('sync-class').value.trim(),
    code: el<HTMLInputElement>('sync-code').value,
  };
}

async function push(silent = false): Promise<void> {
  const data = JSON.parse(store.exportJSON()) as unknown;
  const res = await call('/sync', { method: 'POST', body: JSON.stringify({ data }) });
  if (!silent) {
    msg(`已上传:${res.attempts} 条作答已同步到云端(服务端自动与已有记录合并,不会覆盖)。`);
  }
}

async function enable() {
  const { studentId, classId, code } = credentials();
  if (!studentId || !classId || !code) {
    msg('请填齐匿名学号、班级与同步口令。学号请勿使用真实姓名。');
    return;
  }
  msg('正在启用云同步…');
  try {
    const res = await call('/enroll', {
      method: 'POST',
      body: JSON.stringify({ studentId, classId, code }),
    }, '');
    localStorage.setItem(TOKEN_KEY, String(res.token));
    localStorage.setItem(META_KEY, JSON.stringify({ studentId, classId }));
    // 让此后导出的离线备份自带身份,教师做离线汇总时不必再手填
    store.setRoster(studentId, classId);
    el<HTMLInputElement>('sync-code').value = '';
    setStatus();
    await push(true);
    msg(`已启用:${studentId}(${classId})的学习记录已上传。换设备时用同一学号与口令登录即可取回。`);
  } catch (e) {
    msg(`启用失败:${e instanceof Error ? e.message : String(e)}`);
  }
}

async function pull() {
  msg('正在从云端取回…');
  try {
    const res = await call('/sync');
    if (!res.data) {
      msg('云端还没有你的记录。可以先点「上传到云端」。');
      return;
    }
    const r = store.importJSON(JSON.stringify(res.data), 'merge');
    if (!r.ok) {
      msg(`取回失败:${r.error ?? '数据格式不兼容'}`);
      return;
    }
    msg('已取回并合并到本机(同一时间戳的作答自动去重,本机原有记录保留)。');
  } catch (e) {
    msg(`取回失败:${e instanceof Error ? e.message : String(e)}`);
  }
}

function disable() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(META_KEY);
  el<HTMLInputElement>('sync-code').value = '';
  setStatus();
  msg('本机已退出同步,学习数据仍完整保留在本浏览器。云端记录未删除。');
}

async function deleteCloud() {
  const meta = readMeta();
  if (!meta) return;
  if (!window.confirm(`确定删除 ${meta.studentId} 在云端的全部学习记录吗?此操作不可撤销,本机数据不受影响。`)) {
    return;
  }
  try {
    await call('/sync', { method: 'DELETE' });
    disable();
    msg('云端数据已删除,本机也已退出同步。本机学习数据仍然保留。');
  } catch (e) {
    msg(`删除失败:${e instanceof Error ? e.message : String(e)}`);
  }
}

function init() {
  const meta = readMeta();
  if (meta) {
    el<HTMLInputElement>('sync-student').value = meta.studentId;
    el<HTMLInputElement>('sync-class').value = meta.classId;
  }
  setStatus();
  if (meta && token()) {
    msg(`已为 ${meta.studentId}(${meta.classId}) 启用云同步。口令无需重复输入;如需换设备,重新登录即可。`);
  }

  el('btn-sync-enable').addEventListener('click', () => void enable());
  el('btn-sync-push').addEventListener('click', () => {
    msg('正在上传…');
    void push().catch((e) => msg(`上传失败:${e instanceof Error ? e.message : String(e)}`));
  });
  el('btn-sync-pull').addEventListener('click', () => void pull());
  el('btn-sync-disable').addEventListener('click', disable);
  el('btn-sync-delete').addEventListener('click', () => void deleteCloud());
}

init();
