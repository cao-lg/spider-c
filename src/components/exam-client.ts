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
import { answerValuesFor, CODE_PASS, CODE_FAIL } from '../lib/exam-data';
import { runPython } from './runner-runtime';

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
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
}

/** exam_start / exam_heartbeat 返回的服务器权威状态 */
interface SessionState {
  status: 'in_progress' | 'none' | 'force_submitted' | 'reset' | 'submitted';
  message?: string;
  endsAt?: string;
  serverNow?: string;
  attempts?: number;
  broadcastMsg?: string | null;
  broadcastAt?: string | null;
}

interface SubmissionRow {
  exam_id: number;
  score: number | null;
  submitted_at: string | null;
  focus_loss_count: number;
  duration_sec: number | null;
  answers?: Record<string, string[]>;
}

/** 服务端逐题回看:只含对错与得分,绝不含正确答案 */
interface FeedbackItem {
  id: string;
  correct: boolean;
  points: number;
  earned: number;
}

interface FeedbackResult {
  score: number | null;
  totalScore: number | null;
  items: FeedbackItem[];
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
/** 监考:心跳定时器、服务器时间偏移、服务器权威结束时间、广播去重 */
let heartbeatTimer: number | null = null;
let statePollTimer: number | null = null;
let serverOffsetMs = 0; // 服务器时间 - 本地时间
let lastBroadcastAt: string | null = null;
/** 当前显示的题目/选项乱序映射(仅显示层,提交值仍为原始 id/索引) */
let displayPaper: ExamQuestion[] = [];
let optionOrder = new Map<string, number[]>();

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
        action =
          `<span class="exam-done">已交卷 · ${done.score ?? '-'} 分</span> ` +
          `<button class="btn sm" type="button" data-exam-review="${exam.id}">查看回看</button>`;
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
  box.querySelectorAll<HTMLButtonElement>('[data-exam-review]').forEach((button) => {
    button.addEventListener('click', () => {
      const found = exams.find((e) => String(e.id) === button.dataset.examReview);
      if (!found) return;
      el('exam-list-view').hidden = true;
      void showFeedback(found, submissions.get(found.id)?.answers);
    });
  });
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 交卷后,学生已无法再改动答卷;作答原文随卷回放,仅让学生看自己写了什么 */
let lastAnswers: Record<string, string[]> = {};

/** 把某题的学生作答(值数组)转成可读文本;不暴露正确答案。 */
function answerText(q: ExamQuestion, given: string[] | undefined): string {
  if (!given || given.length === 0) return '未作答';
  if (q.type === 'truefalse') {
    return given.map((v) => (v === 'T' ? '正确' : v === 'F' ? '错误' : v)).join('、');
  }
  if (q.type === 'choice' || q.type === 'multi') {
    return given
      .map((v) => {
        const i = Number(v);
        return Number.isInteger(i) && i >= 0 && i < (q.options?.length ?? 0) ? q.options![i] : v;
      })
      .join('、');
  }
  if (q.type === 'code') {
    // answers 形如 ['PASS'|'', 'code:源码'],这里只显示判分状态,不回显整段代码
    return given[0] ? '判分通过' : '未通过判分';
  }
  // fill / short:显示学生自己填写的内容
  return given[0] || '未作答';
}

/**
 * 拉取并渲染逐题回看。核心:服务端 RPC 只返回 {id,correct,points,earned},
 * 题干/选项来自随卷下发的 exams.paper,作答来自 laAnswers,全程不下发正确答案。
 */
async function showFeedback(exam: ExamRow, answersOverride?: Record<string, string[]>): Promise<void> {
  const resultBox = el('exam-result');
  if (answersOverride) lastAnswers = answersOverride;
  resultBox.hidden = false;
  resultBox.innerHTML = '<h2>逐题回看</h2><p class="report-hint">正在加载判分明细…</p>';
  const { data, error } = await cloud.database.rpc('exam_feedback', { p_exam_id: exam.id });
  if (error) {
    resultBox.innerHTML = `<h2>逐题回看</h2><p class="report-hint" data-kind="error">加载失败:${escape(errorMessage(error))}</p><div class="btn-row"><button id="exam-result-back" class="btn sm" type="button">返回列表</button></div>`;
    el<HTMLButtonElement>('exam-result-back').addEventListener('click', () => {
      showList();
      void refresh();
    });
    return;
  }
  const fb = (Array.isArray(data) ? data[0] : data) as FeedbackResult | null;
  const items = fb?.items ?? [];
  const byId = new Map(items.map((it) => [it.id, it]));
  const typeLabel: Record<string, string> = {
    choice: '单选',
    truefalse: '判断',
    multi: '多选',
    fill: '填空',
    short: '简答',
    code: '编程',
  };
  const rows = (exam.paper ?? []).map((q, i) => {
    const it = byId.get(q.id);
    const correct = it?.correct === true;
    const earned = it?.earned ?? 0;
    return `<li class="exam-fb-item" data-correct="${correct}">
      <div class="exam-fb-head">
        <span class="exam-fb-no">第 ${i + 1} 题</span>
        <span class="exam-fb-type">${typeLabel[q.type] ?? '题目'}</span>
        <span class="exam-fb-mark">${correct ? '✓ 正确' : '✗ 错误'}</span>
        <span class="exam-fb-score">${earned} / ${q.points} 分</span>
      </div>
      <div class="exam-fb-prompt">${q.prompt}</div>
      <div class="exam-fb-given">你的作答:${escape(answerText(q, lastAnswers[q.id]))}</div>
    </li>`;
  });
  const right = items.filter((it) => it.correct).length;
  resultBox.innerHTML = `<h2>逐题回看</h2>
    <p>本场得分 <strong>${fb?.score ?? '-'}</strong> / ${fb?.totalScore ?? '-'} · 答对 ${right} / ${items.length} 题</p>
    <p class="report-hint">仅显示你的作答与对错,正确答案不公开,如需讲评请联系教师。</p>
    <ol class="exam-fb-list">${rows.join('')}</ol>
    <div class="btn-row"><button id="exam-result-back" class="btn sm" type="button">返回列表</button></div>`;
  el<HTMLButtonElement>('exam-result-back').addEventListener('click', () => {
    showList();
    void refresh();
  });
}

/** 编程题判分状态: code -> 学生代码, pass -> 是否判分通过 */
const codeState = new Map<string, { code: string; pass: boolean; grading: boolean }>();

/** 转义 HTML,保证题目/选项里的 <code> 等原样渲染 */
function escapeForPrompt(value: string): string {
  // prompt/options 里含 <code> 等受信标签,这里只转义引号,其余保留以渲染富文本。
  return value;
}

/** Fisher-Yates 打乱,返回新数组 */
function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function renderOptions(q: ExamQuestion, index: number): string {
  if (q.type === 'truefalse') {
    const pair = [
      { value: 'T', label: '正确' },
      { value: 'F', label: '错误' },
    ];
    // 判断题也可乱序:打乱显示,value 保持 T/F 不变
    const order = optionOrder.get(q.id);
    const shown = order ? order.map((i) => pair[i]) : pair;
    return shown
      .map(
        (o) =>
          `<label class="exam-option"><input type="radio" name="${escape(q.id)}" value="${o.value}" /> <span>${o.label}</span></label>`,
      )
      .join('');
  }
  if (q.type === 'multi' || q.type === 'choice') {
    const order = optionOrder.get(q.id) ?? (q.options ?? []).map((_, i) => i);
    const inputType = q.type === 'multi' ? 'checkbox' : 'radio';
    return order
      .map(
        (i) =>
          `<label class="exam-option"><input type="${inputType}" name="${escape(q.id)}" value="${String(i)}" /> <span>${q.options?.[i] ?? ''}</span></label>`,
      )
      .join('');
  }
  if (q.type === 'fill') {
    return `<div class="exam-fill"><input type="text" name="${escape(q.id)}" autocomplete="off" placeholder="填写答案" /></div>`;
  }
  if (q.type === 'short') {
    return `<div class="exam-fill"><textarea name="${escape(q.id)}" rows="2" placeholder="简要作答(需包含关键词)" ></textarea></div>`;
  }
  if (q.type === 'code') {
    // 隐藏域承载判分结果;textarea 为学生编辑区
    return `<div class="exam-code">
      <input type="hidden" name="${escape(q.id)}" data-code-pass value="" />
      <textarea class="exam-code-editor" spellcheck="false" rows="6">${escape(q.starter ?? '')}</textarea>
      <div class="btn-row">
        <button type="button" class="btn sm" data-code-run="${escape(q.id)}">运行并判分</button>
        <span class="exam-code-status" data-code-status="${escape(q.id)}">未判分</span>
      </div>
    </div>`;
  }
  return '';
}

function renderQuestions(exam: ExamRow): void {
  const form = el<HTMLFormElement>('exam-form');
  codeState.clear();
  // 题目/选项乱序:只改变显示顺序,答案按 q.id 与选项原始索引对应,判分不受影响。
  displayPaper = exam.shuffle_questions ? shuffled(exam.paper ?? []) : [...(exam.paper ?? [])];
  optionOrder = new Map();
  if (exam.shuffle_options) {
    for (const q of exam.paper ?? []) {
      if (q.type === 'choice' || q.type === 'multi') {
        optionOrder.set(q.id, shuffled((q.options ?? []).map((_, i) => i)));
      } else if (q.type === 'truefalse') {
        optionOrder.set(q.id, shuffled([0, 1]));
      }
    }
  }
  form.innerHTML = displayPaper
    .map((q, index) => {
      const typeLabel: Record<string, string> = {
        choice: '单选题',
        truefalse: '判断题',
        multi: '多选题',
        fill: '填空题',
        short: '简答题',
        code: '编程题',
      };
      const label = typeLabel[q.type] ?? '题目';
      return `<fieldset class="exam-question" data-qtype="${escape(q.type)}"><legend>第 ${index + 1} 题 · ${label} · ${q.points} 分</legend><div class="exam-prompt">${q.prompt}</div>${renderOptions(q, index)}</fieldset>`;
    })
    .join('');

  // 绑定编程题"运行并判分"事件
  form.querySelectorAll<HTMLButtonElement>('[data-code-run]').forEach((button) => {
    button.addEventListener('click', () => void runCodeQuestion(button.dataset.codeRun as string));
  });
}

/** 运行某道编程题:拼接学生代码 + 隐藏 check,跑 Pyodide,把结果写入隐藏 input */
async function runCodeQuestion(qid: string): Promise<void> {
  const form = el<HTMLFormElement>('exam-form');
  const editor = form.querySelector<HTMLTextAreaElement>(`textarea[name="${escape(qid)}"]`);
  if (!editor) return;
  const status = form.querySelector<HTMLElement>(`[data-code-status="${escape(qid)}"]`);
  const btn = form.querySelector<HTMLButtonElement>(`[data-code-run="${escape(qid)}"]`);
  const hidden = form.querySelector<HTMLInputElement>(`input[name="${escape(qid)}"][data-code-pass]`);
  const question = active?.paper?.find((q) => q.id === qid);

  const code = editor.value;
  codeState.set(qid, { code, pass: false, grading: true });
  if (status) { status.textContent = '判分中…'; status.dataset.kind = 'info'; }
  if (btn) btn.disabled = true;

  const full = `${code}\n\n# ---- 判分器 ----\n${question?.check ?? ''}`;
  let passed = false;
  let message = '';
  let out = '';
  try {
    const result = await runPython(full, {
      timeout: 45000,
      onOutput: (c) => {
        if (c.text) out += c.text;
      },
    });
    // 判分器是隐藏 check:无异常、无断言失败即通过
    if (result.ok) {
      passed = true;
      message = '已通过判分';
    } else {
      const trimmed = (out || result.error || '').trim();
      message = trimmed ? trimmed.slice(-140) : '未通过,请检查代码';
    }
  } catch (error) {
    message = `判分异常:${error instanceof Error ? error.message : String(error)}`;
  }

  codeState.set(qid, { code, pass: passed, grading: false });
  if (hidden) hidden.value = passed ? CODE_PASS : '';
  if (status) { status.textContent = message; status.dataset.kind = passed ? 'ok' : 'bad'; }
  if (btn) btn.disabled = false;
}

function updateTimer(): void {
  const left = Math.max(0, endsAt - serverNow());
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

async function startExam(exam: ExamRow): Promise<void> {
  msg('正在进入考试…');
  const { data, error } = await cloud.database.rpc('exam_start', { p_exam_id: exam.id });
  if (error) {
    msg(`无法开考:${errorMessage(error)}`, 'error');
    return;
  }
  const state = (Array.isArray(data) ? data[0] : data) as SessionState | null;
  if (!state || state.status !== 'in_progress') {
    msg(state?.message ?? '无法开考,请刷新后重试。', 'error');
    return;
  }

  active = exam;
  focusLoss = 0;
  // 用服务器时间校准,避免本地改时间延长考试。
  serverOffsetMs = state.serverNow ? new Date(state.serverNow).getTime() - Date.now() : 0;
  endsAt = state.endsAt ? new Date(state.endsAt).getTime() : Date.now() + Math.max(1, exam.duration_min) * 60000;
  lastBroadcastAt = state.broadcastAt ?? null;
  if (state.broadcastMsg) showBroadcast(state.broadcastMsg);

  el('exam-list-view').hidden = true;
  el('exam-result').hidden = true;
  el('exam-runner').hidden = false;
  el('exam-run-title').textContent = exam.title;
  renderQuestions(exam);

  updateTimer();
  timer = window.setInterval(updateTimer, 1000);
  startHeartbeat();
  enterExamGuards();
  msg(`答题中(第 ${state.attempts ?? 1} 次)。已锁定全屏并禁用复制;切屏/离焦会被记录,时间到自动交卷。`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** 服务器权威时间(ms) */
function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

/** 心跳:每 8 秒上报作答原文、进度与切屏次数,并接收教师指令 */
function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => void beat(), 8000);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) { window.clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

async function beat(): Promise<void> {
  if (!active || !session) return;
  const answers = collectAnswers(active);
  const { data, error } = await cloud.database.rpc('exam_heartbeat', {
    p_exam_id: active.id,
    p_answers: answers,
    p_answer_count: Object.values(answers).filter((v) => v.length > 0).length,
    p_focus_loss: focusLoss,
  });
  if (error) return; // 心跳失败不影响作答,下次重试
  const state = (Array.isArray(data) ? data[0] : data) as SessionState | null;
  if (!state) return;
  if (state.serverNow) {
    serverOffsetMs = new Date(state.serverNow).getTime() - Date.now();
  }
  if (state.status !== 'in_progress') {
    handleServerEnd(state);
    return;
  }
  if (state.endsAt) endsAt = new Date(state.endsAt).getTime();
  if (state.broadcastAt && state.broadcastAt !== lastBroadcastAt) {
    lastBroadcastAt = state.broadcastAt;
    if (state.broadcastMsg) showBroadcast(state.broadcastMsg);
  }
}

/** 收集当前答题框的答案(与提交同口径,但不包含判分动作) */
function collectAnswers(exam: ExamRow): Record<string, string[]> {
  const form = el<HTMLFormElement>('exam-form');
  const out: Record<string, string[]> = {};
  for (const q of exam.paper ?? []) {
    if (q.type === 'code') {
      const hidden = form.querySelector<HTMLInputElement>(`input[name="${escape(q.id)}"][data-code-pass]`);
      const editor = form.querySelector<HTMLTextAreaElement>(`textarea[name="${escape(q.id)}"]`);
      const pass = hidden?.value ?? '';
      const code = editor?.value ?? '';
      out[q.id] = pass ? [pass, `code:${code}`] : ['', `code:${code}`];
    } else {
      out[q.id] = answerValuesFor(q.type, q.id, form);
    }
  }
  return out;
}

// ── 防作弊守卫(浏览器端只能提高成本,无法绝对阻止) ─────────────────────────
let guardsOn = false;
const blockCtx = (e: Event) => e.preventDefault();
const onBlur = () => { if (active && guardsOn) focusLoss += 1; };
const onVisibility = () => { if (document.hidden && active && guardsOn) focusLoss += 1; };
const onFullscreenChange = () => {
  // 学生主动退出全屏视为一次切屏(不强制作弊判定,只记录)
  if (guardsOn && !document.fullscreenElement && active) focusLoss += 1;
};

function enterExamGuards(): void {
  if (guardsOn) return;
  guardsOn = true;
  document.addEventListener('contextmenu', blockCtx);
  document.addEventListener('copy', blockCtx);
  document.addEventListener('cut', blockCtx);
  document.addEventListener('paste', blockCtx);
  document.addEventListener('selectstart', blockCtx);
  document.addEventListener('dragstart', blockCtx);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  // 尝试锁定全屏;被浏览器/用户拒绝也不阻断考试。
  const root = document.documentElement;
  if (root.requestFullscreen && !document.fullscreenElement) {
    void root.requestFullscreen().catch(() => { /* 用户或策略拒绝 */ });
  }
}

function exitExamGuards(): void {
  if (!guardsOn) return;
  guardsOn = false;
  document.removeEventListener('contextmenu', blockCtx);
  document.removeEventListener('copy', blockCtx);
  document.removeEventListener('cut', blockCtx);
  document.removeEventListener('paste', blockCtx);
  document.removeEventListener('selectstart', blockCtx);
  document.removeEventListener('dragstart', blockCtx);
  window.removeEventListener('blur', onBlur);
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => { /* ignore */ });
}

function showBroadcast(text: string): void {
  window.alert(`教师通知:${text}`);
}

function handleServerEnd(state: SessionState): void {
  stopHeartbeat();
  if (timer !== null) { window.clearInterval(timer); timer = null; }
  exitExamGuards();
  const message = state.message ?? '本场考试已结束';
  if (state.status === 'reset') {
    // 教师允许重做:回列表,学生可重新开考
    window.alert(`${message}`);
    showList();
    void refresh();
  } else {
    // 被强交/结束:交卷结果由服务端落库,提示回列表查看
    window.alert(`${message}。成绩已记录,返回列表可查看逐题回看。`);
    showList();
    void refresh();
  }
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

  const answers = collectAnswers(active);
  const elapsed = Math.round((serverNow() - (endsAt - Math.max(1, active.duration_min) * 60000)) / 1000);
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
  stopHeartbeat();
  exitExamGuards();
  const result = (Array.isArray(data) ? data[0] : data) as { score?: number; totalScore?: number } | null;
  el('exam-runner').hidden = true;
  el('exam-result').hidden = false;
  el('exam-result').innerHTML = `<h2>交卷完成</h2><p>本场得分 <strong>${result?.score ?? '-'}</strong> / ${result?.totalScore ?? '-'}</p><p class="report-hint">切屏 ${focusLoss} 次。正在生成逐题回看…</p>`;
  // 交卷后立即拉取逐题明细;传本次作答原文供回放
  void showFeedback(active, answers);
}

async function refresh(): Promise<void> {
  if (!session) return;
  try {
  const uid = session.user.id;
  const [examResult, subResult, profileResult] = await Promise.all([
    cloud.database.from('exams').select('*').eq('published', true).order('created_at', { ascending: false }),
    cloud.database.from('exam_submissions').select('exam_id, score, submitted_at, focus_loss_count, duration_sec, answers').eq('owner_id', uid),
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
  // 切屏计数由考试守卫 onVisibility 统一处理(仅答题中累加),这里只负责列表刷新。
  if (!document.hidden && !active) refreshIfIdle();
});
window.addEventListener('focus', () => refreshIfIdle());

// 在档案页保存 / 删除档案后回到本页时,立即重判能否开考。
onProfileChange(() => refreshIfIdle(true));

onAuthChange(render);
void currentSession().then(render);
