/**
 * 在线考试 · 教师端(组卷 / 发布 / 成绩册)。
 *
 * 权限完全由数据库 RLS 决定:非白名单用户即使打开了这一屏,exams 的写入与
 * exam_keys 的读取都会被拒绝,前端只负责把错误说清楚。
 */
import { cloud, currentSession, onAuthChange, isTeacher, errorMessage } from '../lib/cloud';
import type { CloudSessionData } from '../lib/cloud';
import { buildPaper } from '../lib/exam-data';

interface ExamAdminRow {
  id: number;
  code: string;
  title: string;
  class_id: string | null;
  paper: { points: number }[];
  duration_min: number;
  published: boolean;
  created_at: string;
}

interface GradeRow {
  exam_id: number;
  owner_id: string;
  class_id: string;
  student_no: string;
  score: number | null;
  submitted_at: string | null;
  duration_sec: number | null;
  focus_loss_count: number;
}

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

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let session: CloudSessionData = null;
let examRows: ExamAdminRow[] = [];
let gradeRows: GradeRow[] = [];
let nameByOwner = new Map<string, string>();
let gradeExam: ExamAdminRow | null = null;

async function loadExams(): Promise<void> {
  const { data, error } = await cloud.database
    .from('exams')
    .select('id, code, title, class_id, paper, duration_min, published, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    el('exam-admin-list').innerHTML = `<p class="report-hint">读取失败:${escape(errorMessage(error))}</p>`;
    return;
  }
  examRows = (data ?? []) as ExamAdminRow[];
  renderExamList();
  renderGradeSelect();
}

function renderExamList(): void {
  const box = el('exam-admin-list');
  if (examRows.length === 0) {
    box.innerHTML = '<p class="report-hint">还没有试卷,用上面的表单创建第一场。</p>';
    return;
  }
  box.innerHTML = `<table class="design-table"><thead><tr><th>标题 / 代号</th><th>班级</th><th>题量</th><th>时长</th><th>状态</th><th>操作</th></tr></thead><tbody>${examRows
    .map(
      (row) => `<tr>
        <td><strong>${escape(row.title)}</strong><br /><span class="report-hint">${escape(row.code)}</span></td>
        <td>${escape(row.class_id ?? '全部')}</td>
        <td>${row.paper?.length ?? 0}</td>
        <td>${row.duration_min} 分钟</td>
        <td>${row.published ? '<span class="exam-published">已发布</span>' : '草稿'}</td>
        <td><button type="button" class="btn sm" data-exam-toggle="${row.id}">${row.published ? '停止发布' : '发布'}</button></td>
      </tr>`,
    )
    .join('')}</tbody></table>`;
  box.querySelectorAll<HTMLButtonElement>('[data-exam-toggle]').forEach((button) => {
    button.addEventListener('click', () => void togglePublish(Number(button.dataset.examToggle)));
  });
}

function renderGradeSelect(): void {
  const select = el<HTMLSelectElement>('exam-grade-select');
  select.innerHTML =
    '<option value="">选择考试</option>' +
    examRows
      .map((row) => `<option value="${row.id}">${escape(row.title)} (${escape(row.class_id ?? '全部')})</option>`)
      .join('');
}

async function togglePublish(id: number): Promise<void> {
  const row = examRows.find((e) => e.id === id);
  if (!row) return;
  const { error } = await cloud.database
    .from('exams')
    .update({ published: !row.published })
    .eq('id', id)
    .select('id');
  if (error) {
    msg('exam-create-msg', `切换发布状态失败:${errorMessage(error)}`, 'error');
    return;
  }
  await loadExams();
}

async function createExam(): Promise<void> {
  const title = el<HTMLInputElement>('exam-new-title').value.trim();
  const code = el<HTMLInputElement>('exam-new-code').value.trim();
  const classId = el<HTMLSelectElement>('exam-new-class').value;
  const unitId = el<HTMLSelectElement>('exam-new-unit').value;
  const count = Number(el<HTMLInputElement>('exam-new-count').value);
  const points = Number(el<HTMLInputElement>('exam-new-points').value);
  const duration = Number(el<HTMLInputElement>('exam-new-duration').value);

  if (!title || !/^[a-z0-9-]{3,24}$/i.test(code)) {
    msg('exam-create-msg', '请填写标题,代号用 3-24 位字母、数字或连字符。', 'error');
    return;
  }
  if (!Number.isFinite(count) || count < 1 || !Number.isFinite(points) || points < 1 || !Number.isFinite(duration) || duration < 1) {
    msg('exam-create-msg', '题量、每题分值、时长都要是正整数。', 'error');
    return;
  }

  const built = buildPaper(unitId, count, points);
  if (built.paper.length === 0) {
    msg('exam-create-msg', '该范围没有可用客观题,请换一个抽题范围。', 'error');
    return;
  }

  const button = el<HTMLButtonElement>('exam-create');
  button.disabled = true;
  msg('exam-create-msg', '正在创建草稿…');

  const created = await cloud.database
    .from('exams')
    .insert({
      code,
      title,
      kind: 'exam',
      class_id: classId || null,
      paper: built.paper,
      duration_min: duration,
      shuffle_questions: false,
      shuffle_options: false,
      max_attempts: 1,
      published: false,
    })
    .select('id');

  if (created.error || !Array.isArray(created.data) || created.data.length === 0) {
    button.disabled = false;
    const text = errorMessage(created.error, '可能被权限策略拒绝');
    msg('exam-create-msg', `创建失败:${text.includes('23505') ? '考试代号已存在' : text}`, 'error');
    return;
  }

  const examId = (created.data[0] as { id: number }).id;
  const key = await cloud.database.from('exam_keys').insert({
    exam_id: examId,
    objective: built.objective,
    code_tests: [],
    total_score: built.total,
  });

  if (key.error) {
    button.disabled = false;
    msg('exam-create-msg', `答案写入失败,试卷保持草稿:${errorMessage(key.error)}`, 'error');
    await loadExams();
    return;
  }

  const published = await cloud.database.from('exams').update({ published: true }).eq('id', examId).select('id');
  button.disabled = false;
  msg(
    'exam-create-msg',
    published.error
      ? `试卷已创建但发布失败:${errorMessage(published.error)}`
      : `已发布:${built.paper.length} 题,满分 ${built.total} 分。`,
    published.error ? 'error' : 'info',
  );
  await loadExams();
}

async function loadGrades(): Promise<void> {
  const id = Number(el<HTMLSelectElement>('exam-grade-select').value);
  gradeExam = examRows.find((r) => r.id === id) ?? null;
  if (!gradeExam) {
    msg('exam-grade-msg', '请先选择一场考试。', 'error');
    return;
  }
  const [subs, profiles] = await Promise.all([
    cloud.database
      .from('exam_submissions')
      .select('exam_id, owner_id, class_id, student_no, score, submitted_at, duration_sec, focus_loss_count')
      .eq('exam_id', id)
      .order('score', { ascending: false }),
    cloud.database.from('student_profiles').select('owner_id, real_name'),
  ]);
  if (subs.error || profiles.error) {
    msg('exam-grade-msg', `读取失败:${errorMessage(subs.error ?? profiles.error)}`, 'error');
    return;
  }
  gradeRows = (subs.data ?? []) as GradeRow[];
  nameByOwner = new Map(((profiles.data ?? []) as { owner_id: string; real_name: string }[]).map((p) => [p.owner_id, p.real_name]));
  renderGradeTable();
  msg('exam-grade-msg', `共 ${gradeRows.length} 条答卷。`);
}

function renderGradeTable(): void {
  const box = el('exam-grade-table');
  if (gradeRows.length === 0) {
    box.innerHTML = '<p class="report-hint">还没有人交卷。</p>';
    return;
  }
  const full = (gradeExam?.paper ?? []).reduce((sum, q) => sum + q.points, 0);
  box.innerHTML = `<table class="design-table"><thead><tr><th>班级</th><th>学号</th><th>姓名</th><th>得分</th><th>满分</th><th>用时</th><th>切屏</th><th>提交时间</th></tr></thead><tbody>${gradeRows
    .map(
      (row) => `<tr>
        <td>${escape(row.class_id)}</td>
        <td>${escape(row.student_no)}</td>
        <td>${escape(nameByOwner.get(row.owner_id) ?? '—')}</td>
        <td><strong>${row.score ?? '-'}</strong></td>
        <td>${full}</td>
        <td>${row.duration_sec != null ? `${Math.round(row.duration_sec / 60)} 分` : '—'}</td>
        <td>${row.focus_loss_count}</td>
        <td>${row.submitted_at ? escape(new Date(row.submitted_at).toLocaleString('zh-CN')) : '—'}</td>
      </tr>`,
    )
    .join('')}</tbody></table>`;
}

function exportCsv(): void {
  if (gradeRows.length === 0 || !gradeExam) {
    msg('exam-grade-msg', '请先加载一场有答卷的考试。', 'error');
    return;
  }
  const full = (gradeExam.paper ?? []).reduce((sum, q) => sum + q.points, 0);
  const rows = [
    ['考试', gradeExam.title],
    [],
    ['班级', '学号', '姓名', '得分', '满分', '用时(秒)', '切屏次数', '提交时间'],
    ...gradeRows.map((r) => [
      r.class_id,
      r.student_no,
      nameByOwner.get(r.owner_id) ?? '',
      String(r.score ?? ''),
      String(full),
      String(r.duration_sec ?? ''),
      String(r.focus_loss_count),
      r.submitted_at ?? '',
    ]),
  ];
  const csv = '\ufeff' + rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${gradeExam.code}-成绩册.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function render(next: CloudSessionData): void {
  session = next;
  const allowed = Boolean(next);
  el('exam-admin-locked').hidden = false;
  el('exam-admin-body').hidden = true;
  if (!allowed || !session) return;
  void isTeacher(session).then(async (teacher) => {
    if (!teacher) return;
    el('exam-admin-locked').hidden = true;
    el('exam-admin-body').hidden = false;
    await loadExams();
  });
}

el<HTMLButtonElement>('exam-create').addEventListener('click', () => void createExam());
el<HTMLButtonElement>('exam-grade-load').addEventListener('click', () => void loadGrades());
el<HTMLButtonElement>('exam-grade-csv').addEventListener('click', exportCsv);

onAuthChange(render);
void currentSession().then(render);
