// 评分与掌握度计算

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
  } else if (q.type === 'truefalse') {
    correct = answersMatch(given, q.answer);
  } else {
    // fill
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

export function buildAttempt(score: number, maxScore: number, extra?: Partial<Attempt>): Attempt {
  return {
    ts: Date.now(),
    score,
    maxScore,
    ratio: maxScore > 0 ? score / maxScore : 0,
    ...extra,
  };
}

/** 掌握度:近期得分加权(指数滑动平均) */
export function masteryFromAttempts(attempts: Attempt[]): number {
  if (!attempts || attempts.length === 0) return 0;
  const sorted = [...attempts].sort((a, b) => a.ts - b.ts);
  let m = 0;
  for (const a of sorted) {
    const r = a.ratio ?? 0;
    m = 0.35 * r + 0.65 * m;
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
