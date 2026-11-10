// 纯逻辑快测:判分、掌握度、复习优先级
// 运行:npm test(秒级,不需要浏览器)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  answersMatch,
  correctAnswerText,
  gradeQuestion,
  gradeQuestions,
  masteryFromAttempts,
  normalizeAnswer,
  optionDiagnosis,
  pct,
  reviewPriority,
} from '../../src/lib/scoring.ts';
import type { Question } from '../../src/lib/types.ts';

const choice: Question = {
  id: 'q1',
  type: 'choice',
  prompt: 'p',
  options: ['A', 'B', 'C'],
  answer: ['1'],
  points: 5,
  optionFeedback: ['fb-a', '', 'fb-c'],
};

const tf: Question = { id: 'q2', type: 'truefalse', prompt: 'p', answer: ['T'], points: 5 };
const fill: Question = { id: 'q3', type: 'fill', prompt: 'p', answer: ['Session'], points: 5 };

test('normalizeAnswer 去掉首尾空白并压缩内部空白', () => {
  assert.equal(normalizeAnswer('  Hello   World '), 'hello world');
});

test('answersMatch 大小写与空白不敏感', () => {
  assert.ok(answersMatch(' SESSION ', ['session']));
  assert.ok(!answersMatch('sess', ['session']));
});

test('选择题按索引判分', () => {
  assert.equal(gradeQuestion(choice, '1').correct, true);
  assert.equal(gradeQuestion(choice, '0').correct, false);
  assert.equal(gradeQuestion(choice, '').correct, false);
});

test('非法索引不会误判为正确', () => {
  assert.equal(gradeQuestion(choice, 'abc').correct, false);
  assert.equal(gradeQuestion({ ...choice, answer: [] }, '0').correct, false);
});

test('判断题与填空题共用字符串匹配', () => {
  assert.equal(gradeQuestion(tf, 'T').correct, true);
  assert.equal(gradeQuestion(tf, 't').correct, true);
  assert.equal(gradeQuestion(tf, 'F').correct, false);
  assert.equal(gradeQuestion(fill, 'session').correct, true);
});

test('未作答一律不得分', () => {
  assert.equal(gradeQuestion(fill, '').points, 0);
});

test('批量判分汇总分数与满分', () => {
  const { results, score, maxScore } = gradeQuestions([choice, tf, fill], {
    q1: '1',
    q2: 'F',
    q3: 'Session',
  });
  assert.equal(maxScore, 15);
  assert.equal(score, 10);
  assert.equal(results.filter((r) => r.correct).length, 2);
});

test('选项诊断只对错误选项给出,不泄露正答', () => {
  assert.equal(optionDiagnosis(choice, '0'), 'fb-a');
  assert.equal(optionDiagnosis(choice, '2'), 'fb-c');
  assert.equal(optionDiagnosis(choice, '1'), undefined);
  assert.equal(optionDiagnosis(tf, 'F'), undefined);
});

test('correctAnswerText 覆盖三种题型', () => {
  assert.equal(correctAnswerText(choice), 'B');
  assert.equal(correctAnswerText(tf), '正确');
  assert.equal(correctAnswerText({ ...tf, answer: ['F'] }), '错误');
  assert.equal(correctAnswerText(fill), 'Session');
});

test('掌握度:首次作答直接作为初值,不被衰减', () => {
  assert.equal(masteryFromAttempts([{ ts: 1, score: 5, maxScore: 5, ratio: 1 }]), 1);
});

test('掌握度:后续作答按 0.35 权重滑动', () => {
  const m = masteryFromAttempts([
    { ts: 1, score: 10, maxScore: 10, ratio: 1 },
    { ts: 2, score: 0, maxScore: 10, ratio: 0 },
  ]);
  assert.ok(Math.abs(m - 0.65) < 1e-9, `期望 0.65,实际 ${m}`);
});

test('掌握度:连续答对会把早期失败逐步冲淡', () => {
  const attempts = [
    { ts: 1, score: 0, maxScore: 10, ratio: 0 },
    { ts: 2, score: 10, maxScore: 10, ratio: 1 },
    { ts: 3, score: 10, maxScore: 10, ratio: 1 },
    { ts: 4, score: 10, maxScore: 10, ratio: 1 },
    { ts: 5, score: 10, maxScore: 10, ratio: 1 },
  ];
  const m = masteryFromAttempts(attempts);
  // 0.35 权重的指数平均,4 次满分后约 0.82:不追求收敛到 1,避免"一次走运=已掌握"
  assert.ok(m > 0.8 && m < 1, `期望 (0.8, 1),实际 ${m}`);
});

test('掌握度:空数据为 0,且对越界比率做裁剪', () => {
  assert.equal(masteryFromAttempts([]), 0);
  assert.equal(masteryFromAttempts([{ ts: 1, score: 99, maxScore: 10, ratio: 99 }]), 1);
});

test('pct 对 0 分满分不产生 NaN', () => {
  assert.equal(pct(0, 0), 0);
  assert.equal(pct(1, 3), 33);
});

test('复习优先级:错得多 > 错得少,放得久 > 刚错过', () => {
  const now = Date.UTC(2026, 0, 31);
  const fresh = reviewPriority(1, now - 1000, now);
  const old = reviewPriority(1, now - 30 * 86400000, now);
  const often = reviewPriority(5, now - 1000, now);
  assert.ok(old > fresh, '放置更久的应当更靠前');
  assert.ok(often > fresh, '错得更多的应当更靠前');
});

test('复习优先级:已消除的题目优先级明显下降但不为 0', () => {
  const now = Date.UTC(2026, 0, 31);
  const open = reviewPriority(3, now - 10 * 86400000, now);
  const resolved = reviewPriority(3, now - 10 * 86400000, now, now);
  assert.ok(resolved < open / 2);
  assert.ok(resolved > 0);
});
