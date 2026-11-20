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
import { units } from '../data/course.ts';

const ALL_QUESTIONS = [...conceptQuestions, ...examQuestions, ...examQuestionsExtra];

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
