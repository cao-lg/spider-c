/**
 * 我的档案:实名绑定 + 学习快照上云。
 *
 * 所有查询都受 RLS 约束,前端不发送 owner_id(数据库用 DEFAULT auth.uid() 填),
 * 也不缓存"我是教师"之类的权限结论。
 */
import { cloud, currentSession, onAuthChange, errorMessage, realUid } from '../lib/cloud';
import type { CloudSessionData } from '../lib/cloud';
import { invalidateProfile, loadProfile as loadCloudProfile } from '../lib/profile';
import type { StudentProfile } from '../lib/profile';
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

function fillProfileForm(profile: StudentProfile | null): void {
  if (!profile) return;
  el<HTMLSelectElement>('profile-class').value = profile.class_id;
  el<HTMLInputElement>('profile-no').value = profile.student_no;
  el<HTMLInputElement>('profile-name').value = profile.real_name;
}

async function loadProfile(): Promise<void> {
  const state = await loadCloudProfile(session);
  if (!state.known) {
    msg('profile-msg', '读取档案失败,请检查网络后刷新本页。', 'error');
    return;
  }
  if (!state.profile) {
    msg('profile-msg', '还没有档案,请填写后保存。');
    return;
  }
  fillProfileForm(state.profile);
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
  const uid = realUid(session);
  const savedId = (result.data?.[0] as { id?: number | string } | undefined)?.id ?? '';
  if (uid) {
    invalidateProfile(uid, {
      id: savedId,
      class_id: classId,
      student_no: studentNo,
      real_name: realName,
    });
  }
  msg('profile-msg', '档案已保存到云端。在线考试成绩现在可以记到你名下了。');
}

/**
 * 上传前先做双向合并。
 * 直接把本机 payload 整份 upsert 会覆盖另一台设备刚上传的较新记录
 * (典型场景:机房电脑登录后,家里电脑的记录就"消失"了)。
 * 这里先把云端快照 merge 进本机,再把合并结果写回,与教师端 / D1 同步同一套口径。
 */
async function pushSnapshot(): Promise<void> {
  const uid = realUid(session);
  if (!uid) return;
  msg('snap-msg', '正在合并并上传…');

  const { data: remote, error: readError } = await cloud.database
    .from('learning_snapshots')
    .select('payload')
    .eq('owner_id', uid)
    .maybeSingle();
  if (readError) {
    msg('snap-msg', `读取云端记录失败,已中止上传以免覆盖:${errorMessage(readError)}`, 'error');
    return;
  }

  if (remote?.payload) {
    const merged = store.importJSON(JSON.stringify(remote.payload), 'merge');
    if (!merged.ok) {
      msg('snap-msg', `云端记录格式不兼容,已中止上传:${merged.error ?? ''}`, 'error');
      return;
    }
  }

  const payload = JSON.parse(store.exportJSON());
  const { error } = await cloud.database
    .from('learning_snapshots')
    .upsert({ payload, revision: 1, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
    .select('id');
  msg('snap-msg', error ? `上传失败:${errorMessage(error)}` : '本机与云端记录已合并,已上传到云端。', error ? 'error' : 'info');
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
  if (!b.error) {
    invalidateProfile(session.user.id);
    el<HTMLInputElement>('profile-no').value = '';
    el<HTMLInputElement>('profile-name').value = '';
    msg('profile-msg', '还没有档案,请填写后保存。');
  }
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

// —— 重新登录自动恢复 ——
// 学生登录/会话恢复后,若云端已有学习快照,静默 merge 回本机(merge 口径保留较新的本机记录,
// 不会用旧快照覆盖新数据)。同一会话对同一用户只自动恢复一次,避免每次刷新都拉取。
let autoRestoredUid: string | null = null;
async function autoRestore(next: CloudSessionData): Promise<void> {
  const uid = realUid(next);
  if (!uid) {
    autoRestoredUid = null;
    return;
  }
  if (autoRestoredUid === uid) return;
  autoRestoredUid = uid;
  try {
    const { data, error } = await cloud.database
      .from('learning_snapshots')
      .select('payload')
      .eq('owner_id', uid)
      .maybeSingle();
    if (error || !data?.payload) return; // 云端无记录/读取失败:静默跳过
    const res = store.importJSON(JSON.stringify(data.payload), 'merge');
    if (!res.ok) return; // 格式不兼容:静默,手动「取回」仍可用
  } catch {
    /* 网络异常静默,不阻塞登录 */
  }
}

function handleAuth(next: CloudSessionData): void {
  render(next);
  void autoRestore(next);
}

onAuthChange(handleAuth);
void currentSession().then((s) => {
  render(s);
  void autoRestore(s);
});
