/**
 * 在线考试 · 教师端(组卷 / 发布 / 成绩册)。
 *
 * 权限完全由数据库 RLS 决定:非白名单用户即使打开了这一屏,exams 的写入与
 * exam_keys 的读取都会被拒绝,前端只负责把错误说清楚。
 */
import { cloud, currentSession, onAuthChange, isTeacher, errorMessage } from '../lib/cloud';
import type { CloudSessionData } from '../lib/cloud';
import { buildVariants, gradeQuestion, type ExamTypePlan, type ObjectiveRule } from '../lib/exam-data';
import type { ExamQuestion } from '../lib/exam-data';

interface ExamAdminRow {
  id: number;
  code: string;
  title: string;
  class_id: string | null;
  paper: ExamQuestion[];
  duration_min: number;
  published: boolean;
  created_at: string;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
  variants?: unknown[] | null;
  max_focus_loss?: number;
}

interface MonitorRow {
  ownerId: string;
  classId: string;
  studentNo: string;
  realName: string;
  status: string;
  answerCount: number;
  focusLoss: number;
  attempts: number;
  extendedSec: number;
  startedAt: string;
  lastSeenAt: string;
  online: boolean;
  submitted: boolean;
  score: number | null;
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
  answers?: Record<string, string[]>;
}

/** 教师端逐题回看:从客观题规则还原出的对错明细 */
interface GradeItem {
  qid: string;
  given: string;
  correct: boolean;
  earned: number;
  points: number;
}

interface AnswerKey {
  objective: Record<string, ObjectiveRule>;
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
/** 当前考试的答案规则(教师 RLS 可读),用于逐题还原对错;加载失败则导出不含对错 */
let gradeKey: AnswerKey | null = null;

async function loadExams(): Promise<void> {
  const { data, error } = await cloud.database
    .from('exams')
    .select('id, code, title, class_id, paper, duration_min, published, created_at, shuffle_questions, shuffle_options, opens_at, closes_at, variants, max_focus_loss')
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
  box.innerHTML = `<table class="design-table"><thead><tr><th>标题 / 代号</th><th>班级</th><th>题量</th><th>时长</th><th>防作弊</th><th>开放窗口</th><th>状态</th><th>操作</th></tr></thead><tbody>${examRows
    .map((row) => {
      const vcount = Array.isArray(row.variants) && row.variants.length > 1 ? `${row.variants.length}套ABC卷` : '单卷';
      const focus = row.max_focus_loss && row.max_focus_loss > 0 ? `切屏>${row.max_focus_loss}强交` : '';
      const ac = [vcount, row.shuffle_questions ? '题乱序' : '', row.shuffle_options ? '选项乱序' : '', focus].filter(Boolean).join(' / ');
      const windowLabel = row.opens_at || row.closes_at
        ? `${row.opens_at ? escape(new Date(row.opens_at).toLocaleString('zh-CN')) : '不限'} ~ ${row.closes_at ? escape(new Date(row.closes_at).toLocaleString('zh-CN')) : '不限'}`
        : '不限';
      return `<tr>
        <td><strong>${escape(row.title)}</strong><br /><span class="report-hint">${escape(row.code)}</span></td>
        <td>${escape(row.class_id ?? '全部')}</td>
        <td>${row.paper?.length ?? 0}</td>
        <td>${row.duration_min} 分钟</td>
        <td>${ac}</td>
        <td class="report-hint">${windowLabel}</td>
        <td>${row.published ? '<span class="exam-published">已发布</span>' : '草稿'}</td>
        <td>
          <button type="button" class="btn sm" data-exam-preview="${row.id}">预览试卷</button>
          <button type="button" class="btn sm" data-exam-toggle="${row.id}">${row.published ? '停止发布' : '发布'}</button>
        </td>
      </tr>`;
    })
    .join('')}</tbody></table>`;
  box.querySelectorAll<HTMLButtonElement>('[data-exam-toggle]').forEach((button) => {
    button.addEventListener('click', () => void togglePublish(Number(button.dataset.examToggle)));
  });
  box.querySelectorAll<HTMLButtonElement>('[data-exam-preview]').forEach((button) => {
    button.addEventListener('click', () => openPreview(Number(button.dataset.examPreview)));
  });
}

/** 试卷预览:只读展示卷面题目/选项/分值,不含答案与判分规则;ABC 卷可切换套别 */
function openPreview(examId: number): void {
  const exam = examRows.find((r) => r.id === examId);
  if (!exam) return;
  const variants = Array.isArray(exam.variants) && exam.variants.length > 0 ? exam.variants : null;
  const sets: { label: string; paper: ExamQuestion[] }[] = variants
    ? (variants as { label?: string; paper: ExamQuestion[] }[]).map((v, i) => ({ label: v.label ?? String.fromCharCode(65 + i), paper: v.paper ?? [] }))
    : [{ label: 'A', paper: (exam.paper ?? []) as ExamQuestion[] }];

  const modal = el('exam-preview-modal');
  const title = el('exam-preview-title');
  const tabs = el('exam-preview-tabs');
  const body = el('exam-preview-body');
  title.textContent = `试卷预览 · ${exam.title}`;
  tabs.innerHTML = sets.length > 1
    ? sets.map((s, i) => `<button type="button" class="btn sm ${i === 0 ? 'primary' : ''}" data-preview-set="${i}">${escape(s.label)} 卷</button>`).join('')
    : '';
  tabs.hidden = sets.length <= 1;

  const render = (idx: number) => {
    const set = sets[idx];
    const typeLabel: Record<string, string> = { choice: '单选', truefalse: '判断', multi: '多选', fill: '填空', short: '简答', code: '编程' };
    const total = set.paper.reduce((s, q) => s + (Number(q.points) || 0), 0);
    const parts = set.paper.map((q, i) => {
      let opts = '';
      if (q.type === 'choice' || q.type === 'multi') {
        opts = `<ul class="preview-opts">${(q.options ?? []).map((o) => `<li>${o}</li>`).join('')}</ul>`;
      } else if (q.type === 'truefalse') {
        opts = '<ul class="preview-opts"><li>正确</li><li>错误</li></ul>';
      } else if (q.type === 'code') {
        opts = `<pre class="preview-code">${escape(q.starter ?? '')}</pre>`;
      } else if (q.type === 'fill') {
        opts = '<p class="report-hint">填空作答</p>';
      } else {
        opts = '<p class="report-hint">简答作答</p>';
      }
      return `<fieldset class="exam-question"><legend>第 ${i + 1} 题 · ${typeLabel[q.type] ?? q.type} · ${q.points} 分</legend><div class="exam-prompt">${q.prompt}</div>${opts}</fieldset>`;
    });
    body.innerHTML = `<p class="report-hint">${set.paper.length} 题 · 满分 ${total} 分 · ${escape(set.label)} 卷(预览仅展示卷面,不含答案)</p>${parts.join('')}`;
    tabs.querySelectorAll<HTMLButtonElement>('[data-preview-set]').forEach((b) => {
      b.classList.toggle('primary', Number(b.dataset.previewSet) === idx);
    });
  };
  render(0);
  tabs.querySelectorAll<HTMLButtonElement>('[data-preview-set]').forEach((b) => {
    b.onclick = () => render(Number(b.dataset.previewSet));
  });
  modal.hidden = false;
}

function renderGradeSelect(): void {
  const opts =
    '<option value="">选择考试</option>' +
    examRows
      .map((row) => `<option value="${row.id}">${escape(row.title)} (${escape(row.class_id ?? '全部')})</option>`)
      .join('');
  el<HTMLSelectElement>('exam-grade-select').innerHTML = opts;
  el<HTMLSelectElement>('exam-proctor-select').innerHTML = opts;
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
  window.dispatchEvent(new Event('exam-list-changed'));
}

async function createExam(): Promise<void> {
  const title = el<HTMLInputElement>('exam-new-title').value.trim();
  const code = el<HTMLInputElement>('exam-new-code').value.trim();
  const classId = el<HTMLSelectElement>('exam-new-class').value;
  const unitId = el<HTMLSelectElement>('exam-new-unit').value;
  const count = Number(el<HTMLInputElement>('exam-new-count').value);
  const points = Number(el<HTMLInputElement>('exam-new-points').value);
  const plan: ExamTypePlan = {
    choice: Number(el<HTMLInputElement>('plan-choice').value) || 0,
    truefalse: Number(el<HTMLInputElement>('plan-truefalse').value) || 0,
    multi: Number(el<HTMLInputElement>('plan-multi').value) || 0,
    fill: Number(el<HTMLInputElement>('plan-fill').value) || 0,
    short: Number(el<HTMLInputElement>('plan-short').value) || 0,
    code: Number(el<HTMLInputElement>('plan-code').value) || 0,
  };
  const duration = Number(el<HTMLInputElement>('exam-new-duration').value);
  const shuffleQ = el<HTMLInputElement>('exam-new-shuffle-q').checked;
  const shuffleO = el<HTMLInputElement>('exam-new-shuffle-o').checked;
  // ABC 平行卷套数(1=单卷);切屏强交阈值(0=不限)
  const variantCount = Math.max(1, Math.min(5, Number(el<HTMLInputElement>('exam-new-variants').value) || 1));
  const maxFocusLoss = Math.max(0, Number(el<HTMLInputElement>('exam-new-max-focus').value) || 0);
  const opensRaw = el<HTMLInputElement>('exam-new-opens').value;
  const closesRaw = el<HTMLInputElement>('exam-new-closes').value;
  const opens = opensRaw ? new Date(opensRaw).toISOString() : null;
  const closes = closesRaw ? new Date(closesRaw).toISOString() : null;

  if (!title || !/^[a-z0-9-]{3,24}$/i.test(code)) {
    msg('exam-create-msg', '请填写标题,代号用 3-24 位字母、数字或连字符。', 'error');
    return;
  }
  if (!Number.isFinite(count) || count < 1 || !Number.isFinite(points) || points < 1 || !Number.isFinite(duration) || duration < 1) {
    msg('exam-create-msg', '题量、每题分值、时长都要是正整数。', 'error');
    return;
  }

  // 生成 ABC 平行卷:每套独立抽题、跨套尽量不重复;objective 合并为一份(按题号,互不冲突)。
  const built = buildVariants(unitId, count, points, plan, variantCount);
  if (built.variants.length === 0 || built.variants[0].paper.length === 0) {
    msg('exam-create-msg', '该范围没有可用客观题,请换一个抽题范围。', 'error');
    return;
  }
  // 单卷时保持原有结构(paper/views 全部与旧版一致)
  const isMulti = built.variants.length > 1;
  const primaryPaper = built.variants[0].paper;
  const primaryTotal = primaryPaper.length * points;

  const button = el<HTMLButtonElement>('exam-create');
  button.disabled = true;
  msg('exam-create-msg', isMulti ? `正在生成 ${built.variants.length} 套平行卷并创建草稿…` : '正在创建草稿…');

  const created = await cloud.database
    .from('exams')
    .insert({
      code,
      title,
      kind: 'exam',
      class_id: classId || null,
      paper: primaryPaper,
      duration_min: duration,
      shuffle_questions: shuffleQ,
      shuffle_options: shuffleO,
      opens_at: opens,
      closes_at: closes,
      max_attempts: 1,
      max_focus_loss: maxFocusLoss,
      variants: isMulti ? built.variants : null,
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
    total_score: primaryTotal,
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
      : isMulti
        ? `已发布:${built.variants.length} 套平行卷(考生按 uid 自动分配),每套 ${primaryPaper.length} 题,满分 ${primaryTotal} 分。`
        : `已发布:${primaryPaper.length} 题,满分 ${primaryTotal} 分。`,
    published.error ? 'error' : 'info',
  );
  await loadExams();
  window.dispatchEvent(new Event('exam-list-changed'));
}

async function loadGrades(): Promise<void> {
  const id = Number(el<HTMLSelectElement>('exam-grade-select').value);
  gradeExam = examRows.find((r) => r.id === id) ?? null;
  if (!gradeExam) {
    msg('exam-grade-msg', '请先选择一场考试。', 'error');
    return;
  }
  const [subs, profiles, keyRes] = await Promise.all([
    cloud.database
      .from('exam_submissions')
      .select('exam_id, owner_id, class_id, student_no, score, submitted_at, duration_sec, focus_loss_count, answers')
      .eq('exam_id', id)
      .order('score', { ascending: false }),
    cloud.database.from('student_profiles').select('owner_id, real_name'),
    cloud.database.from('exam_keys').select('objective').eq('exam_id', id),
  ]);
  if (subs.error || profiles.error) {
    msg('exam-grade-msg', `读取失败:${errorMessage(subs.error ?? profiles.error)}`, 'error');
    return;
  }
  gradeRows = (subs.data ?? []) as GradeRow[];
  nameByOwner = new Map(((profiles.data ?? []) as { owner_id: string; real_name: string }[]).map((p) => [p.owner_id, p.real_name]));
  // 答案规则仅教师可读;取不到时仍可导出答案原文,只是不含对错列
  const keyRow = (keyRes.data ?? []) as { objective: Record<string, ObjectiveRule> }[];
  gradeKey = keyRow.length > 0 ? { objective: keyRow[0].objective ?? {} } : null;
  renderGradeTable();
  msg('exam-grade-msg', `共 ${gradeRows.length} 条答卷。${gradeKey ? '可导出逐题明细。' : '未取到答案规则,逐题对错列将留空。'}`);
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

/** 导出完整答卷:每个学生每道题一行,含学生答案原文与对错(由教师可读的答案规则还原) */
function exportAnswersCsv(): void {
  if (gradeRows.length === 0 || !gradeExam) {
    msg('exam-grade-msg', '请先加载一场有答卷的考试。', 'error');
    return;
  }
  const typeByQid = new Map<string, string>();
  for (const q of (gradeExam.paper ?? []) as ExamQuestion[]) typeByQid.set(q.id, q.type);
  const typeLabel: Record<string, string> = {
    choice: '单选', truefalse: '判断', multi: '多选', fill: '填空', short: '简答', code: '编程',
  };
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [
    ['考试', gradeExam.title, '导出时间', new Date().toLocaleString('zh-CN')],
    [],
    ['班级', '学号', '姓名', '题号', '题型', '学生答案', '得分', '满分', '是否正确', '提交时间'],
  ];
  for (const r of gradeRows) {
    const answers = r.answers ?? {};
    const qids = Object.keys(answers);
    // 优先按卷面题序列出,再补答卷里多出的题(如历史卷)
    const ordered = [
      ...(gradeExam.paper ?? []).map((q) => q.id).filter((id) => qids.includes(id)),
      ...qids.filter((id) => !typeByQid.has(id)),
    ];
    for (const qid of ordered) {
      const raw = answers[qid] ?? [];
      let shown = '';
      if (qid && Array.isArray(raw)) {
        const first = String(raw[0] ?? '');
        // 编程题存 [PASS/FAIL, code:...]:展示判分结果与代码
        const codePart = raw.find((v) => String(v).startsWith('code:'));
        shown = codePart ? `${first} | ${String(codePart).slice(5)}` : raw.join(' / ');
      }
      const rule = gradeKey?.objective?.[qid];
      const graded = rule ? gradeQuestion(rule, Array.isArray(raw) ? raw : []) : null;
      rows.push([
        r.class_id, r.student_no, nameByOwner.get(r.owner_id) ?? '', qid,
        typeLabel[typeByQid.get(qid) ?? ''] ?? '', shown,
        graded ? String(graded.earned) : '', rule ? String(rule.points) : '',
        graded ? (graded.correct ? '对' : '错') : '', r.submitted_at ?? '',
      ]);
    }
  }
  const csv = '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${gradeExam.code}-完整答卷.csv`;
  link.click();
  URL.revokeObjectURL(url);
  msg('exam-grade-msg', `已导出 ${gradeRows.length} 名学生的逐题答卷明细。`);
}

// ── 实时监考 ─────────────────────────────────────────────────
let monitorTimer: number | null = null;

function proctorMsg(text: string, kind: 'info' | 'error' = 'info'): void {
  msg('exam-proctor-msg', text, kind);
}

async function loadMonitor(): Promise<void> {
  const id = Number(el<HTMLSelectElement>('exam-proctor-select').value);
  if (!id) {
    el('exam-proctor-list').innerHTML = '<p class="report-hint">请先选择一场考试。</p>';
    return;
  }
  const { data, error } = await cloud.database.rpc('exam_monitor', { p_exam_id: id });
  if (error) {
    proctorMsg(`读取监考状态失败:${errorMessage(error)}`, 'error');
    return;
  }
  const rows = (Array.isArray(data) ? data : []) as MonitorRow[];
  const exam = examRows.find((r) => r.id === id);
  const total = exam?.paper?.length ?? 0;
  const statusLabel: Record<string, string> = {
    in_progress: '作答中', force_submitted: '已强交', reset: '待重做', submitted: '已交卷',
  };
  el('exam-proctor-list').innerHTML = rows.length === 0
    ? '<p class="report-hint">还没有学生进入这场考试。</p>'
    : `<table class="design-table"><thead><tr><th>状态</th><th>班级 / 学号</th><th>姓名</th><th>进度</th><th>切屏</th><th>第几次</th><th>最近心跳</th><th>操作</th></tr></thead><tbody>${rows
        .map((r) => {
          const heart = r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleTimeString('zh-CN') : '—';
          const dangerFocus = r.focusLoss > 0 ? ' style="color:var(--danger);font-weight:700"' : '';
          return `<tr data-owner="${escape(r.ownerId)}">
            <td><span class="exam-mon-status" data-status="${r.status}">${statusLabel[r.status] ?? r.status}</span> ${r.online ? '<span class="exam-mon-online">●在线</span>' : '<span class="exam-mon-offline">离线</span>'}</td>
            <td>${escape(r.classId)} / ${escape(r.studentNo)}</td>
            <td>${escape(r.realName || '—')}</td>
            <td>${r.answerCount} / ${total}${r.submitted && r.score != null ? ` · ${r.score}分` : ''}</td>
            <td${dangerFocus}>${r.focusLoss}</td>
            <td>${r.attempts}</td>
            <td class="report-hint">${heart}</td>
            <td><div class="btn-row exam-mon-actions">
              ${r.status === 'in_progress' ? `<button type="button" class="btn sm" data-mon-force="${escape(r.ownerId)}">强制交卷</button>` : ''}
              <button type="button" class="btn sm" data-mon-reset="${escape(r.ownerId)}">允许重做</button>
              ${r.status === 'in_progress' ? `<button type="button" class="btn sm" data-mon-extend="${escape(r.ownerId)}">+5分</button>` : ''}
            </div></td>
          </tr>`;
        })
        .join('')}</tbody></table>`;
  bindMonitorActions();
  proctorMsg(`共 ${rows.length} 名学生 · ${rows.filter((r) => r.online).length} 人在线。`);
}

function bindMonitorActions(): void {
  const id = Number(el<HTMLSelectElement>('exam-proctor-select').value);
  el('exam-proctor-list').querySelectorAll<HTMLButtonElement>('[data-mon-force]').forEach((b) => {
    b.addEventListener('click', () => {
      const owner = b.dataset.monForce as string;
      if (!window.confirm('强制交卷将按该生当前已答内容判分,确定吗?')) return;
      void cloud.database.rpc('exam_force_submit', { p_exam_id: id, p_owner_id: owner }).then(({ data, error }) => {
        if (error) { proctorMsg(`强交失败:${errorMessage(error)}`, 'error'); return; }
        const r = (Array.isArray(data) ? data[0] : data) as { score: number; totalScore: number } | null;
        proctorMsg(`已强制交卷,得分 ${r?.score ?? '-'} / ${r?.totalScore ?? '-'}。`);
        void loadMonitor();
      });
    });
  });
  el('exam-proctor-list').querySelectorAll<HTMLButtonElement>('[data-mon-reset]').forEach((b) => {
    b.addEventListener('click', () => {
      const owner = b.dataset.monReset as string;
      if (!window.confirm('允许重做会清除该生旧答卷与成绩,学生可重新作答。确定吗?')) return;
      void cloud.database.rpc('exam_reset_attempt', { p_exam_id: id, p_owner_id: owner }).then(({ error }) => {
        if (error) { proctorMsg(`重置失败:${errorMessage(error)}`, 'error'); return; }
        proctorMsg('已允许重做,学生刷新列表后可重新开考。');
        void loadMonitor();
      });
    });
  });
  el('exam-proctor-list').querySelectorAll<HTMLButtonElement>('[data-mon-extend]').forEach((b) => {
    b.addEventListener('click', () => {
      const owner = b.dataset.monExtend as string;
      void cloud.database.rpc('exam_extend', { p_exam_id: id, p_owner_id: owner, p_seconds: 300 }).then(({ error }) => {
        if (error) { proctorMsg(`延长失败:${errorMessage(error)}`, 'error'); return; }
        proctorMsg('已为该生延长 5 分钟。');
        void loadMonitor();
      });
    });
  });
}

function bindProctor(): void {
  el<HTMLSelectElement>('exam-proctor-select').addEventListener('change', () => {
    void loadMonitor();
  });
  el('exam-proctor-refresh').addEventListener('click', () => void loadMonitor());
  el<HTMLInputElement>('exam-proctor-auto').addEventListener('change', (e) => {
    syncMonitorTimer((e.target as HTMLInputElement).checked);
  });
  el('exam-broadcast-send').addEventListener('click', () => {
    const id = Number(el<HTMLSelectElement>('exam-proctor-select').value);
    const text = el<HTMLInputElement>('exam-broadcast-msg').value.trim();
    if (!id || !text) { proctorMsg('请选择考试并输入广播内容。', 'error'); return; }
    void cloud.database.rpc('exam_broadcast', { p_exam_id: id, p_message: text }).then(({ data, error }) => {
      if (error) { proctorMsg(`广播失败:${errorMessage(error)}`, 'error'); return; }
      const r = (Array.isArray(data) ? data[0] : data) as { affected: number } | null;
      proctorMsg(`已向 ${r?.affected ?? 0} 名学生广播。`);
    });
  });
  el('exam-extend-all').addEventListener('click', () => {
    const id = Number(el<HTMLSelectElement>('exam-proctor-select').value);
    if (!id) { proctorMsg('请先选择考试。', 'error'); return; }
    void cloud.database.rpc('exam_extend', { p_exam_id: id, p_owner_id: null, p_seconds: 300 }).then(({ data, error }) => {
      if (error) { proctorMsg(`延长失败:${errorMessage(error)}`, 'error'); return; }
      const r = (Array.isArray(data) ? data[0] : data) as { affected: number } | null;
      proctorMsg(`已为 ${r?.affected ?? 0} 名学生延长 5 分钟。`);
      void loadMonitor();
    });
  });
  el('exam-end-btn').addEventListener('click', () => {
    const id = Number(el<HTMLSelectElement>('exam-proctor-select').value);
    if (!id) { proctorMsg('请先选择考试。', 'error'); return; }
    if (!window.confirm('结束考试后所有学生将无法继续作答,且不可恢复。确定吗?')) return;
    void cloud.database.rpc('exam_end', { p_exam_id: id }).then(({ error }) => {
      if (error) { proctorMsg(`结束失败:${errorMessage(error)}`, 'error'); return; }
      proctorMsg('已结束考试。');
      void loadMonitor();
      void loadExams();
    });
  });
}

function syncMonitorTimer(on: boolean): void {
  if (monitorTimer !== null) { window.clearInterval(monitorTimer); monitorTimer = null; }
  if (on) monitorTimer = window.setInterval(() => void loadMonitor(), 4000);
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
el<HTMLButtonElement>('exam-grade-answers-csv').addEventListener('click', exportAnswersCsv);
el<HTMLButtonElement>('exam-preview-close').addEventListener('click', () => { el('exam-preview-modal').hidden = true; });
el('exam-preview-modal').addEventListener('click', (e) => {
  if (e.target === el('exam-preview-modal')) el('exam-preview-modal').hidden = true;
});
bindProctor();

onAuthChange(render);
void currentSession().then(render);
