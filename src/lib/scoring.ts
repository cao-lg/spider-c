// 评分与掌握度计算
//
// 设计要点(教学视角):
// 1. 判分只回答"对不对",诊断才回答"为什么错"——两者分离,见 optionDiagnosis。
// 2. 掌握度用指数滑动平均,首答直接作为初值,避免"第一次全对却只记 35 分"的低估。
// 3. 所有函数保持纯函数,便于用 node --test 做秒级回归(tests/unit)。

import type { Attempt, Question, QuestionAnswer } from './types';

/** 归一化答案:去首尾空白、压缩内部空白、统一小写 */
export function normalizeAnswer(s: string): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** 判断题/填空题匹配:大小写不敏感,忽略空白差异 */
export function answersMatch(given: string, accepted: string[]): boolean {
  const g = normalizeAnswer(given);
  return accepted.some((a) => normalizeAnswer(a) === g);
}

/** 判单题:返回得分与是否正确 */
export function gradeQuestion(q: Question, given: string): QuestionAnswer {
  let correct = false;
  if (q.type === 'choice') {
    const idx = parseInt(given, 10);
    const ans = parseInt(q.answer[0] ?? '-1', 10);
    correct = !Number.isNaN(idx) && idx === ans;
  } else {
    // truefalse / fill 同一套字符串匹配规则
    correct = answersMatch(given, q.answer);
  }
  return {
    qid: q.id,
    given,
    correct,
    points: correct ? q.points : 0,
    maxPoints: q.points,
  };
}

/** 对一组回答计分 */
export function gradeQuestions(questions: Question[], answers: Record<string, string>): {
  results: QuestionAnswer[];
  score: number;
  maxScore: number;
} {
  const results = questions.map((q) => gradeQuestion(q, answers[q.id] ?? ''));
  const score = results.reduce((s, r) => s + r.points, 0);
  const maxScore = results.reduce((s, r) => s + r.maxPoints, 0);
  return { results, score, maxScore };
}

/**
 * 选项级诊断:学生选错时,返回该选项对应的误区说明;无对应反馈时回落到题目通用解释。
 * 这是"诊断性评价"与"只报答案"的分水岭。
 */
export function optionDiagnosis(q: Question, given: string): string | undefined {
  if (q.type !== 'choice') return undefined;
  const idx = parseInt(given, 10);
  if (Number.isNaN(idx)) return undefined;
  const feedback = q.optionFeedback?.[idx];
  return feedback?.trim() ? feedback : undefined;
}

/** 正答文本(用于反馈面板回显) */
export function correctAnswerText(q: Question): string {
  if (q.type === 'choice') {
    const idx = parseInt(q.answer[0] ?? '-1', 10);
    return q.options?.[idx] ?? '—';
  }
  if (q.type === 'truefalse') {
    return normalizeAnswer(q.answer[0]) === 't' || normalizeAnswer(q.answer[0]) === 'true'
      ? '正确'
      : '错误';
  }
  return q.answer[0] ?? '—';
}

export function buildAttempt(score: number, maxScore: number, extra?: Partial<Attempt>): Attempt {
  return {
    ts: Date.now(),
    score,
    maxScore,
    ratio: maxScore > 0 ? score / maxScore : 0,
    ...extra,
  };
}

/** 掌握度:近期得分加权(指数滑动平均,首答作为初值) */
export function masteryFromAttempts(attempts: Attempt[]): number {
  if (!attempts || attempts.length === 0) return 0;
  const sorted = [...attempts].sort((a, b) => a.ts - b.ts);
  let m = clamp01(sorted[0].ratio ?? 0);
  for (let i = 1; i < sorted.length; i++) {
    m = 0.35 * clamp01(sorted[i].ratio ?? 0) + 0.65 * m;
  }
  return m;
}

/** 最佳一次成绩 */
export function bestAttempt(attempts: Attempt[] | undefined): Attempt | undefined {
  if (!attempts || attempts.length === 0) return undefined;
  return [...attempts].sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)[0];
}

/** 最近一次成绩 */
export function lastAttempt(attempts: Attempt[] | undefined): Attempt | undefined {
  if (!attempts || attempts.length === 0) return undefined;
  return [...attempts].sort((a, b) => b.ts - a.ts)[0];
}

/** 得分百分比 */
export function pct(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * 间隔复习优先级(0-1,越大越该复习)。
 * 依据:错误次数 + 距离上次作答的天数(艾宾浩斯式衰减的工程近似)。
 * 教学用途:错题本排序,让学生先补"又错又久"的点,而不是按时间倒序翻。
 */
export function reviewPriority(
  wrongCount: number,
  lastSeenAt: number,
  now: number,
  resolvedAt?: number,
): number {
  const days = Math.max(0, (now - lastSeenAt) / 86400000);
  const decay = days / (days + 3); // 3 天半衰,越久越接近 1
  const heat = Math.min(1, wrongCount / 3);
  const base = 0.55 * heat + 0.45 * decay;
  return clamp01(resolvedAt ? base * 0.35 : base);
}
