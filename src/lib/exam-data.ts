/**
 * 考试试卷生成(教师端组卷时一次性执行)。
 *
 * 与形成性诊断题的区别:试卷是**题目快照**,写进 exams.paper 后不再引用可变题库;
 * 正确答案单独写进 exam_keys(仅教师可读),学生端拿到的 paper 里绝不出现答案/解析。
 *
 * 题型与判分(全部自动判分):
 *  - choice  单选   : 与正确答案集合相等
 *  - truefalse 判断 : 与正确答案集合相等
 *  - multi   多选   : 与正确答案集合相等(漏选/多选/错选均不得分)
 *  - fill    填空   : 学生答案命中任一可接受答案(忽略首尾空白,大小写不敏感)
 *  - short   简答   : 学生答案包含任一关键词(用于可机判的要点题)
 *  - code    编程   : 学生在浏览器内用 Pyodide 跑代码 + 隐藏 check 判分,
 *                     通过则提交 ['PASS'],否则 ['FAIL'](服务端按集合相等判分)
 */
import { conceptQuestions } from '../data/questions.ts';
import { examQuestions } from '../data/exam-questions.ts';
import { examQuestionsExtra } from '../data/exam-questions-extra.ts';
import { examQuestionsExtra2 } from '../data/exam-questions-extra2.ts';
import { units } from '../data/course.ts';

const ALL_QUESTIONS = [...conceptQuestions, ...examQuestions, ...examQuestionsExtra, ...examQuestionsExtra2];

export type ExamQuestionType = 'choice' | 'truefalse' | 'multi' | 'fill' | 'short' | 'code';

export interface ExamQuestion {
  id: string;
  type: ExamQuestionType;
  prompt: string;
  /** choice / multi 的选项 */
  options?: string[];
  /** fill 的可接受答案(任一命中即可) */
  accept?: string[];
  /** short 的关键词(任一命中即可,大小写不敏感) */
  keywords?: string[];
  /** code 的初始代码(编辑器预填) */
  starter?: string;
  /** code 的隐藏判分代码(保存在 paper 快照中,随卷下发) */
  check?: string;
  points: number;
}

/** 判分规则:mode 决定服务端如何比较学生答案与参考答案 */
export interface ObjectiveRule {
  mode: 'set' | 'any' | 'keyword';
  answer: string[];
  /** 编程题前端判分通过后的提交值 */
  points: number;
}

export interface BuiltPaper {
  paper: ExamQuestion[];
  objective: Record<string, ObjectiveRule>;
  total: number;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function unitOptions(): { id: string; label: string }[] {
  return [
    { id: '', label: '全部单元' },
    ...units.map((u) => ({ id: u.id, label: `单元${u.number} · ${u.title}` })),
  ];
}

/** 题型配比:每个题型的抽题数量,0 表示该题型不抽。 */
export type ExamTypePlan = Partial<Record<ExamQuestionType, number>>;

/**
 * 按题型配比从题库分层抽题,保证编程题等指定题型一定入选。
 * 各题型抽不满时,缺口由其他题型随机补齐,直到凑够 count。
 */
function pickByPlan(pool: typeof ALL_QUESTIONS, count: number, plan: ExamTypePlan): typeof ALL_QUESTIONS {
  const picked: typeof ALL_QUESTIONS = [];
  const used = new Set<string>();
  for (const type of Object.keys(plan) as ExamQuestionType[]) {
    const want = Math.max(0, plan[type] ?? 0);
    if (want === 0 || picked.length >= count) continue;
    const candidates = shuffle(pool.filter((q) => q.type === type && !used.has(q.id)));
    let taken = 0;
    for (const q of candidates) {
      if (taken >= want || picked.length >= count) break;
      picked.push(q);
      used.add(q.id);
      taken += 1;
    }
  }
  // 缺口用其余题补齐(仍排除已选),保证总题量达标
  if (picked.length < count) {
    const rest = shuffle(pool.filter((q) => !used.has(q.id)));
    for (const q of rest) {
      if (picked.length >= count) break;
      picked.push(q);
      used.add(q.id);
    }
  }
  return shuffle(picked);
}

/** 从课程题库抽题,返回可直接写入 exams.paper / exam_keys.objective 的两份数据。 */
export function buildPaper(unitId: string, count: number, pointsPerQuestion: number, plan?: ExamTypePlan): BuiltPaper {
  const pool = ALL_QUESTIONS.filter((q) => (!unitId || q.unitId === unitId));
  const hasPlan = plan && Object.values(plan).some((n) => (n ?? 0) > 0);
  const picked = hasPlan
    ? pickByPlan(pool, Math.max(1, Math.min(count, pool.length)), plan!)
    : shuffle(pool).slice(0, Math.max(1, Math.min(count, pool.length)));

  const paper: ExamQuestion[] = picked.map((q) => {
    const base: ExamQuestion = {
      id: q.id,
      type: q.type as ExamQuestionType,
      prompt: q.prompt,
      points: pointsPerQuestion,
    };
    if (q.options) base.options = q.options;
    if (q.accept) base.accept = [...q.accept];
    if (q.keywords) base.keywords = [...q.keywords];
    if (q.starter) base.starter = q.starter;
    if (q.check) base.check = q.check;
    return base;
  });

  const objective: Record<string, ObjectiveRule> = {};
  for (const q of picked) {
    const rule: ObjectiveRule = { mode: 'set', answer: [...(q.answer ?? [])], points: pointsPerQuestion };
    if (q.type === 'fill') {
      rule.mode = 'any';
      rule.answer = [...(q.accept ?? q.answer ?? [])];
    } else if (q.type === 'short') {
      rule.mode = 'keyword';
      rule.answer = [...(q.keywords ?? q.answer ?? [])];
    } else if (q.type === 'code') {
      rule.mode = 'set';
      rule.answer = ['PASS'];
    }
    objective[q.id] = rule;
  }

  return { paper, objective, total: paper.length * pointsPerQuestion };
}

/** ─────────────────────────────────────────────────────────────
 * 正式考试:稳定随机 + ABC 平行卷
 * ─────────────────────────────────────────────────────────────
 * 关键约定(务必保持):
 * - 判分按题号 key 匹配学生提交的答案;多套卷的题目 id 互不重复,
 *   因此把各套 objective 合并进同一张 exam_keys.objective 后,学生只提交
 *   自己那套的题号,其余题号因无作答被服务端跳过 —— 判分/回看 RPC 无需改动。
 * - 分卷用「考试 id + uid」的稳定哈希,同一考生重进永远拿到同一套卷,
 *   避免刷新换卷导致心跳备份与显示错位,也保证申诉可复现。
 */

/** 32 位字符串哈希(FNV-1a),用于稳定分卷与稳定乱序种子 */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 由种子派生的确定性伪随机数发生器(mulberry32) */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 用给定随机源做 Fisher-Yates 洗牌(不传入则用 Math.random) */
function shuffleWith<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 稳定洗牌:同一 seed 永远得到同一顺序 */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  return shuffleWith(items, seededRandom(seed));
}

/** 稳定分卷:按 examId+uid 哈希,把考生分配到 0..variants-1 的某一套 */
export function assignVariant(examId: number, uid: string, variants: number): number {
  if (variants <= 1) return 0;
  return hashSeed(`${examId}:${uid}`) % variants;
}

/** 变体卷标 A/B/C/... */
export function variantLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export interface PaperVariant {
  label: string;
  paper: ExamQuestion[];
  /** 该套卷的题号集合,便于前端/监考识别 */
  questionIds: string[];
}

/**
 * 生成 N 套平行卷:每套都按同一题型配比独立抽题,且各套之间题目不重复。
 * 返回各套 paper 以及合并后的 objective(直接写进 exam_keys.objective)与总分。
 * - 抽题池足够大时才真正互不重复;池不够时允许跨套复用(不重复优先,不足则回退)。
 * - total 取各套最大值写进 exam_keys.total_score(判分回看显示的总分)。
 */
export function buildVariants(
  unitId: string,
  count: number,
  pointsPerQuestion: number,
  plan: ExamTypePlan | undefined,
  variantCount: number,
): { variants: PaperVariant[]; objective: Record<string, ObjectiveRule>; total: number } {
  const n = Math.max(1, Math.min(5, variantCount));
  const variants: PaperVariant[] = [];
  const merged: Record<string, ObjectiveRule> = {};
  const globalUsed = new Set<string>();
  let maxTotal = 0;

  for (let v = 0; v < n; v += 1) {
    const built = buildPaperAvoiding(unitId, count, pointsPerQuestion, plan, globalUsed);
    variants.push({
      label: variantLabel(v),
      paper: built.paper,
      questionIds: built.paper.map((q) => q.id),
    });
    for (const q of built.paper) globalUsed.add(q.id);
    Object.assign(merged, built.objective);
    maxTotal = Math.max(maxTotal, built.total);
  }
  return { variants, objective: merged, total: maxTotal };
}

/**
 * 与 buildPaper 同规则抽题,但优先排除 globalUsed 里的题号(跨套不重复);
 * 若排除后池不足,逐步放宽以凑够题量(保证每套都能开考)。
 */
function buildPaperAvoiding(
  unitId: string,
  count: number,
  pointsPerQuestion: number,
  plan: ExamTypePlan | undefined,
  globalUsed: Set<string>,
): BuiltPaper {
  const fullPool = ALL_QUESTIONS.filter((q) => (!unitId || q.unitId === unitId));
  const want = Math.max(1, Math.min(count, fullPool.length));
  const pickFrom = (pool: typeof ALL_QUESTIONS): typeof ALL_QUESTIONS => {
    const hasPlan = plan && Object.values(plan).some((n) => (n ?? 0) > 0);
    if (hasPlan) return pickByPlan(pool, want, plan!);
    return shuffle(pool).slice(0, want);
  };
  let picked = pickFrom(fullPool.filter((q) => !globalUsed.has(q.id)));
  if (picked.length < want) {
    // 跨套不重复优先,但池不足时放宽:先补未被本套选中的题
    const already = new Set(picked.map((q) => q.id));
    const rest = shuffle(fullPool.filter((q) => !already.has(q.id)));
    for (const q of rest) {
      if (picked.length >= want) break;
      picked.push(q);
    }
  }

  const paper: ExamQuestion[] = picked.map((q) => {
    const base: ExamQuestion = { id: q.id, type: q.type as ExamQuestionType, prompt: q.prompt, points: pointsPerQuestion };
    if (q.options) base.options = q.options;
    if (q.accept) base.accept = [...q.accept];
    if (q.keywords) base.keywords = [...q.keywords];
    if (q.starter) base.starter = q.starter;
    if (q.check) base.check = q.check;
    return base;
  });
  const objective: Record<string, ObjectiveRule> = {};
  for (const q of picked) {
    const rule: ObjectiveRule = { mode: 'set', answer: [...(q.answer ?? [])], points: pointsPerQuestion };
    if (q.type === 'fill') {
      rule.mode = 'any';
      rule.answer = [...(q.accept ?? q.answer ?? [])];
    } else if (q.type === 'short') {
      rule.mode = 'keyword';
      rule.answer = [...(q.keywords ?? q.answer ?? [])];
    } else if (q.type === 'code') {
      rule.mode = 'set';
      rule.answer = ['PASS'];
    }
    objective[q.id] = rule;
  }
  return { paper, objective, total: paper.length * pointsPerQuestion };
}

/** 判断题选项 */
export function trueFalseOptions(): string[] {
  return ['正确', '错误'];
}

/** 编程题前端判分通过后提交给服务端的固定值 */
export const CODE_PASS = 'PASS';
export const CODE_FAIL = 'FAIL';

/**
 * 收集某题的答案,按题型返回 string[]。
 * code 题由 exam 前端在页面内先判分,再以 ['PASS'] / ['FAIL'] 形式并入 answers。
 */
export function answerValuesFor(type: ExamQuestionType, questionId: string, form: HTMLFormElement): string[] {
  if (type === 'fill' || type === 'short') {
    const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${questionId}"]`);
    return input ? [input.value.trim()] : [];
  }
  if (type === 'code') {
    const input = form.querySelector<HTMLInputElement>(`input[name="${questionId}"][data-code-pass]`);
    return input && input.value ? [input.value] : [];
  }
  // choice / truefalse / multi —— 取所有选中的 radio/checkbox 的值
  return Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${questionId}"]:checked`)).map((n) => n.value);
}

/** ─────────────────────────────────────────────────────────────
 * 共享判分口径(教师端导出逐题对错用)
 * 与服务端 submit_exam / exam_feedback 的 set/any/keyword 三分支完全一致。
 * 服务端是权威;此处仅用于教师导出报表时把「学生答案」还原为「每题对错」,
 * 输入为教师可读的 exam_keys.objective(RLS 仅教师可见)与学生答卷。
 * ─────────────────────────────────────────────────────────────
 */
export interface GradeResult {
  correct: boolean;
  earned: number;
}

export function gradeQuestion(rule: ObjectiveRule, given: string[] | undefined): GradeResult {
  const points = Number.isFinite(rule.points) ? rule.points : 0;
  const correct = Array.isArray(rule.answer) ? rule.answer : [];
  if (!Array.isArray(given) || given.length === 0) return { correct: false, earned: 0 };

  if (rule.mode === 'any') {
    const player = String(given[0] ?? '').trim().toLowerCase();
    if (!player) return { correct: false, earned: 0 };
    for (const a of correct) {
      if (player === String(a).trim().toLowerCase()) return { correct: points > 0, earned: points };
    }
    return { correct: false, earned: 0 };
  }
  if (rule.mode === 'keyword') {
    const player = String(given[0] ?? '').toLowerCase();
    if (!player) return { correct: false, earned: 0 };
    for (const kw of correct) {
      const k = String(kw).toLowerCase();
      if (k && player.includes(k)) return { correct: points > 0, earned: points };
    }
    return { correct: false, earned: 0 };
  }
  // set:集合完全相等(顺序无关,重复按集合处理)
  const norm = (arr: string[]) => Array.from(new Set(arr.map(String))).sort();
  const a = norm(correct);
  const g = norm(given);
  const eq = a.length === g.length && a.every((v, i) => v === g[i]);
  return { correct: eq && points > 0, earned: eq ? points : 0 };
}
