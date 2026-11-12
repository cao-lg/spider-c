/**
 * 我的档案:实名绑定 + 学习快照上云。
 *
 * 所有查询都受 RLS 约束,前端不发送 owner_id(数据库用 DEFAULT auth.uid() 填),
 * 也不缓存"我是教师"之类的权限结论。
 */
import { cloud, currentSession, onAuthChange, errorMessage } from '../lib/cloud';
import type { CloudSessionData } from '../lib/cloud';
import { store } from '../lib/store';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少元素 #${id}`);
  return node as T;
}

function msg(id: string, text: string, kind: 'info' | 'error' = 'info'): void {
  const node = el(id);
  node.textContent = text;
  node.dataset.kind = kind;
}

function errorText(error: unknown): string {
  const extra = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  return `${extra} ${errorMessage(error)}`;
}

let session: CloudSessionData = null;

async function loadProfile(): Promise<void> {
  if (!session) return;
  const { data, error } = await cloud.database
    .from('student_profiles')
    .select('id, class_id, student_no, real_name')
    .eq('owner_id', session.user.id)
    .maybeSingle();
  if (error) {
    msg('profile-msg', `读取档案失败:${errorMessage(error)}`, 'error');
    return;
  }
  if (!data) {
    msg('profile-msg', '还没有档案,请填写后保存。');
    return;
  }
  el<HTMLSelectElement>('profile-class').value = data.class_id;
  el<HTMLInputElement>('profile-no').value = data.student_no;
  el<HTMLInputElement>('profile-name').value = data.real_name;
  msg('profile-msg', '已加载云端档案。');
}

async function saveProfile(): Promise<void> {
  if (!session) {
    msg('profile-msg', '请先登录。', 'error');
    return;
  }
  const classId = el<HTMLSelectElement>('profile-class').value.trim();
  const studentNo = el<HTMLInputElement>('profile-no').value.trim();
  const realName = el<HTMLInputElement>('profile-name').value.trim();
  if (!/^[12]班$/.test(classId) || !studentNo || !realName) {
    msg('profile-msg', '班级、学号、姓名都要填写。', 'error');
    return;
  }

  const button = el<HTMLButtonElement>('profile-save');
  button.disabled = true;
  msg('profile-msg', '正在保存…');

  const { data: existing } = await cloud.database
    .from('student_profiles')
    .select('id')
    .eq('owner_id', session.user.id)
    .maybeSingle();

  const values = { class_id: classId, student_no: studentNo, real_name: realName, updated_at: new Date().toISOString() };
  const result = existing
    ? await cloud.database.from('student_profiles').update(values).eq('id', existing.id).select('id')
    : await cloud.database.from('student_profiles').insert(values).select('id');

  button.disabled = false;
  if (result.error) {
    const text = errorText(result.error);
    msg(
      'profile-msg',
      text.includes('23505') || text.toLowerCase().includes('duplicate')
        ? '这个班级 + 学号已被其他账号绑定,请核对或联系教师。'
        : `保存失败:${errorMessage(result.error)}`,
      'error',
    );
    return;
  }
  if (!Array.isArray(result.data) || result.data.length === 0) {
    msg('profile-msg', '保存未生效,请确认已登录后再试。', 'error');
    return;
  }
  // 离线导出备份也带上身份,教师做离线汇总时不必再手填。
  store.setRoster(studentNo, classId);
  msg('profile-msg', '档案已保存到云端。');
}

async function pushSnapshot(): Promise<void> {
  if (!session) return;
  const payload = store.getData();
  const { error } = await cloud.database
    .from('learning_snapshots')
    .upsert({ payload, revision: 1, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
    .select('id');
  msg('snap-msg', error ? `上传失败:${errorMessage(error)}` : '学习记录已上传到云端。', error ? 'error' : 'info');
}

async function pullSnapshot(): Promise<void> {
  if (!session) return;
  const { data, error } = await cloud.database
    .from('learning_snapshots')
    .select('payload, updated_at')
    .eq('owner_id', session.user.id)
    .maybeSingle();
  if (error) {
    msg('snap-msg', `读取失败:${errorMessage(error)}`, 'error');
    return;
  }
  if (!data?.payload) {
    msg('snap-msg', '云端还没有记录,可以先点「上传到云端」。');
    return;
  }
  const res = store.importJSON(JSON.stringify(data.payload), 'merge');
  msg(
    'snap-msg',
    res.ok ? `已从云端恢复并与本机记录合并(云端更新于 ${new Date(data.updated_at).toLocaleString('zh-CN')})。` : `恢复失败:${res.error}`,
    res.ok ? 'info' : 'error',
  );
}

async function deleteCloud(): Promise<void> {
  if (!session) return;
  if (!window.confirm('将删除云端的档案与学习记录(本机数据不受影响)。已提交的考试答卷会作为教学存档保留。确定继续吗?')) return;
  const a = await cloud.database.from('learning_snapshots').delete().eq('owner_id', session.user.id).select('id');
  const b = await cloud.database.from('student_profiles').delete().eq('owner_id', session.user.id).select('id');
  msg('snap-msg', a.error || b.error ? `删除未完全成功:${errorMessage(a.error ?? b.error)}` : '云端档案与学习记录已删除。', a.error || b.error ? 'error' : 'info');
}

function render(next: CloudSessionData): void {
  session = next;
  el('account-locked').hidden = Boolean(next);
  el('account-panel').hidden = !next;
  if (!next) return;
  el('account-uid').textContent = next.user.id ?? '';
  void loadProfile();
  msg('snap-msg', '登录后可执行上传 / 恢复 / 删除。');
}

el<HTMLButtonElement>('account-copy').addEventListener('click', async () => {
  const uid = el('account-uid').textContent?.trim() ?? '';
  try {
    await navigator.clipboard.writeText(uid);
    const button = el<HTMLButtonElement>('account-copy');
    button.textContent = '已复制 ✓';
    window.setTimeout(() => (button.textContent = '复制 uid'), 1800);
  } catch {
    msg('profile-msg', '浏览器拒绝了剪贴板访问,请手动选中 uid 复制。', 'error');
  }
});

el<HTMLButtonElement>('profile-save').addEventListener('click', () => void saveProfile());
el<HTMLButtonElement>('snap-push').addEventListener('click', () => void pushSnapshot());
el<HTMLButtonElement>('snap-pull').addEventListener('click', () => void pullSnapshot());
el<HTMLButtonElement>('snap-delete').addEventListener('click', () => void deleteCloud());

onAuthChange(render);
void currentSession().then(render);
