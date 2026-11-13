/**
 * 在线考试 · 学生端。
 *
 * 安全约定:
 * - 页面只渲染 exams.paper(题目快照),里面没有答案、解析或误区标签。
 * - 判分走数据库 RPC submit_exam,答案表 exam_keys 对学生不可见;前端不计算分数。
 * - 一次提交由数据库唯一约束 + RPC 双重保证,提交后行被 RLS 锁死。
 */
import { cloud, currentSession, onAuthChange, isTeacher, errorMessage } from '../lib/cloud';
import type { CloudSessionData } from '../lib/cloud';
import { onProfileChange } from '../lib/profile';
import type { ExamQuestion } from '../lib/exam-data';
import { answerValuesFor } from '../lib/exam-data';

interface ExamRow {
  id: number;
  code: string;
  title: string;
  class_id: string | null;
  paper: ExamQuestion[];
  duration_min: number;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
}

interface SubmissionRow {
  exam_id: number;
  score: number | null;
  submitted_at: string | null;
  focus_loss_count: number;
  duration_sec: number | null;
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少元素 #${id}`);
  return node as T;
}

function msg(text: string, kind: 'info' | 'error' = 'info'): void {
  const node = el('exam-run-msg');
  node.textContent = text;
  node.dataset.kind = kind;
}

let session: CloudSessionData = null;
let exams: ExamRow[] = [];
let submissions = new Map<number, SubmissionRow>();
let active: ExamRow | null = null;
/** 没有班级 / 学号 / 姓名,交卷成绩无法归属到本人,因此不允许开考。 */
let profileBound = false;
let endsAt = 0;
let timer: number | null = null;
let focusLoss = 0;

function switchTab(name: 'student' | 'teacher'): void {
  document.querySelectorAll<HTMLButtonElement>('[data-exam-tab]').forEach((button) => {
    const on = button.dataset.examTab === name;
    button.classList.toggle('active', on);
    button.setAttribute('aria-selected', String(on));
  });
  el('exam-student').hidden = name !== 'student';
  el('exam-teacher').hidden = name !== 'teacher';
}

function showList(): void {
  active = null;
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  el('exam-runner').hidden = true;
  el('exam-result').hidden = true;
  el('exam-list-view').hidden = false;
}

function inWindow(exam: ExamRow): boolean {
  const now = Date.now();
  if (exam.opens_at && now < new Date(exam.opens_at).getTime()) return false;
  if (exam.closes_at && now > new Date(exam.closes_at).getTime()) return false;
  return true;
}

function renderList(classId: string): void {
  const box = el('exam-list');
  const visible = exams.filter((e) => !e.class_id || !classId || e.class_id === classId);
  if (visible.length === 0) {
    box.innerHTML = '<p class="report-hint">当前没有可参加的考试。教师发布后会出现在这里。</p>';
    return;
  }
  box.innerHTML = visible
    .map((exam) => {
      const done = submissions.get(exam.id);
      const open = inWindow(exam);
      const meta = `${exam.paper?.length ?? 0} 题 · ${exam.duration_min} 分钟 · 满分 ${(exam.paper ?? []).reduce((s, q) => s + q.points, 0)}`;
      let action = '';
      if (done) {
        action = `<span class="exam-done">已交卷 · ${done.score ?? '-'} 分</span>`;
      } else if (!profileBound) {
        action = '<a class="btn sm" href="/account/">先绑定档案</a>';
      } else if (!open) {
        action = '<span class="exam-done">不在开放时间内</span>';
      } else {
        action = `<button class="btn sm primary" type="button" data-exam-start="${exam.id}">开始考试</button>`;
      }
      return `<div class="exam-list-item"><div><strong>${escape(exam.title)}</strong><p class="report-hint">${escape(exam.code)} · ${escape(meta)}</p></div><div>${action}</div></div>`;
    })
    .join('');
  box.querySelectorAll<HTMLButtonElement>('[data-exam-start]').forEach((button) => {
    button.addEventListener('click', () => {
      const found = exams.find((e) => String(e.id) === button.dataset.examStart);
      if (found) startExam(found);
    });
  });
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderQuestions(exam: ExamRow): void {
  const form = el<HTMLFormElement>('exam-form');
  form.innerHTML = (exam.paper ?? [])
    .map((q, index) => {
      const options =
        q.type === 'truefalse'
          ? [
              { value: 'T', label: '正确' },
              { value: 'F', label: '错误' },
            ]
          : (q.options ?? []).map((label, i) => ({ value: String(i), label }));
      const inputs = options
        .map(
          (o) =>
            `<label class="exam-option"><input type="radio" name="${escape(q.id)}" value="${escape(o.value)}" /> <span>${o.label}</span></label>`,
        )
        .join('');
      return `<fieldset class="exam-question"><legend>第 ${index + 1} 题 · ${q.points} 分</legend><div class="exam-prompt">${q.prompt}</div>${inputs}</fieldset>`;
    })
    .join('');
}

function updateTimer(): void {
  const left = Math.max(0, endsAt - Date.now());
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  el('exam-timer').textContent = `剩余 ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  if (left <= 0 && timer !== null) {
    window.clearInterval(timer);
    timer = null;
    msg('时间到,正在自动交卷…');
    void submitExam(true);
  }
}

function startExam(exam: ExamRow): void {
  active = exam;
  focusLoss = 0;
  el('exam-list-view').hidden = true;
  el('exam-result').hidden = true;
  el('exam-runner').hidden = false;
  el('exam-run-title').textContent = exam.title;
  renderQuestions(exam);
  endsAt = Date.now() + Math.max(1, exam.duration_min) * 60000;
  updateTimer();
  timer = window.setInterval(updateTimer, 1000);
  msg('答题中。切出页面会被计入切屏次数,时间到会自动交卷。');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitExam(auto = false): Promise<void> {
  if (!active || !session) return;
  if (!profileBound) {
    msg('尚未绑定班级 / 学号 / 姓名,成绩无法归属。请先到「我的档案」保存,再刷新本页。', 'error');
    return;
  }
  if (!auto && !window.confirm('交卷后不能修改答案,确定提交吗?')) return;
  const button = el<HTMLButtonElement>('exam-submit');
  button.disabled = true;

  const form = el<HTMLFormElement>('exam-form');
  const answers: Record<string, string[]> = {};
  for (const q of active.paper ?? []) answers[q.id] = answerValuesFor(q.type, q.id, form);

  const elapsed = Math.round((Date.now() - (endsAt - Math.max(1, active.duration_min) * 60000)) / 1000);
  const { data, error } = await cloud.database.rpc('submit_exam', {
    p_exam_id: active.id,
    p_answers: answers,
    p_duration_sec: Math.max(0, elapsed),
    p_focus_loss: focusLoss,
  });

  button.disabled = false;
  if (error) {
    msg(`交卷失败:${errorMessage(error)}`, 'error');
    return;
  }

  if (timer !== null) window.clearInterval(timer);
  timer = null;
  const result = (Array.isArray(data) ? data[0] : data) as { score?: number; totalScore?: number } | null;
  el('exam-runner').hidden = true;
  el('exam-result').hidden = false;
  el('exam-result').innerHTML = `<h2>交卷完成</h2><p>本场得分 <strong>${result?.score ?? '-'}</strong> / ${result?.totalScore ?? '-'}</p><p class="report-hint">正确答案不公开,如需讲评请联系教师。切屏 ${focusLoss} 次。</p><div class="btn-row"><button id="exam-result-back" class="btn sm" type="button">返回列表</button></div>`;
  el<HTMLButtonElement>('exam-result-back').addEventListener('click', () => {
    showList();
    void refresh();
  });
}

async function refresh(): Promise<void> {
  if (!session) return;
  try {
  const uid = session.user.id;
  const [examResult, subResult, profileResult] = await Promise.all([
    cloud.database.from('exams').select('*').eq('published', true).order('created_at', { ascending: false }),
    cloud.database.from('exam_submissions').select('exam_id, score, submitted_at, focus_loss_count, duration_sec').eq('owner_id', uid),
    cloud.database.from('student_profiles').select('class_id').eq('owner_id', uid).maybeSingle(),
  ]);

  profileBound = !profileResult.error && Boolean(profileResult.data);
  const warn = el('exam-profile-warn');
  warn.hidden = profileBound;
  if (!warn.hidden) {
    // 固定模板,不含任何用户数据;保留直达档案页的链接。
    warn.innerHTML = profileResult.error
      ? '档案状态读取失败,暂时不能开考。请检查网络后点「刷新列表」重试。'
      : '还没有绑定班级 / 学号 / 姓名,暂时不能开考。请先到 <a href="/account/">我的档案</a> 保存,再回本页刷新列表。';
  }
  if (examResult.error) {
    el('exam-list-msg').textContent = `读取考试列表失败:${errorMessage(examResult.error)}`;
    exams = [];
  } else {
    exams = (examResult.data ?? []) as ExamRow[];
    el('exam-list-msg').textContent = subResult.error ? `读取交卷记录失败:${errorMessage(subResult.error)}` : '';
  }
  submissions = new Map(((subResult.data ?? []) as SubmissionRow[]).map((row) => [row.exam_id, row]));
  renderList((profileResult.data as { class_id?: string } | null)?.class_id ?? '');
  } catch (error) {
    el('exam-list-msg').textContent = `加载失败:${errorMessage(error, '请检查网络后刷新')}`;
  }
}

let lastRefreshAt = 0;

/**
 * 教师发布新试卷时,学生页面可能还停在旧列表。切回标签页、窗口获得焦点、
 * 点「刷新列表」以及教师端派发的 exam-list-changed 都会重新拉取。
 * 答题过程中不刷新,避免重建列表打断作答;3 秒内的重复触发合并为一次。
 */
function refreshIfIdle(force = false): void {
  if (!session || active) return;
  const now = Date.now();
  if (!force && now - lastRefreshAt < 3000) return;
  lastRefreshAt = now;
  void refresh();
}

function render(next: CloudSessionData): void {
  session = next;
  el('exam-locked').hidden = Boolean(next);
  el('exam-student-body').hidden = !next;
  const teacherTab = document.querySelector<HTMLButtonElement>('[data-exam-tab="teacher"]');
  if (teacherTab) teacherTab.hidden = true;
  if (!next) {
    switchTab('student');
    return;
  }
  void isTeacher(next).then((teacher) => {
    if (teacher && teacherTab) teacherTab.hidden = false;
  });
  refreshIfIdle(true);
}

document.querySelectorAll<HTMLButtonElement>('[data-exam-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const name: 'student' | 'teacher' = button.dataset.examTab === 'teacher' ? 'teacher' : 'student';
    switchTab(name);
    if (name === 'student') refreshIfIdle(true);
  });
});
el<HTMLButtonElement>('exam-submit').addEventListener('click', () => void submitExam());
el<HTMLButtonElement>('exam-back').addEventListener('click', showList);
el<HTMLButtonElement>('exam-refresh').addEventListener('click', () => {
  el('exam-list-msg').textContent = '正在刷新考试列表…';
  refreshIfIdle(true);
});

// 同一页面里教师发布 / 停止发布试卷后,学生端列表立刻同步。
window.addEventListener('exam-list-changed', () => refreshIfIdle(true));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (active) focusLoss += 1;
  } else {
    refreshIfIdle();
  }
});
window.addEventListener('focus', () => refreshIfIdle());

// 在档案页保存 / 删除档案后回到本页时,立即重判能否开考。
onProfileChange(() => refreshIfIdle(true));

onAuthChange(render);
void currentSession().then(render);
