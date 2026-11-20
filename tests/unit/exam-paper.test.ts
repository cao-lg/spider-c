// 正式考试题库与组卷测试 —— 保证"题型齐全 + 单元覆盖 + 配比可靠 + 判分对齐"
//
// 这些断言对应的真实事故:
//   · 编程题 0 道 → 试卷里永远没有编程题,"有编程题"成为空话
//   · unitId 全写 unit-1 → 按单元组卷时其他单元抽不到多/填/简/编
//   · 配比不生效 → 教师勾了编程 2 道,抽出来却是 0 道
//   · objective 规则与题型错配 → 填空/简答/编程判分静默出错

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { examQuestions } from '../../src/data/exam-questions.ts';
import { examQuestionsExtra } from '../../src/data/exam-questions-extra.ts';
import { conceptQuestions } from '../../src/data/questions.ts';
import { lessons } from '../../src/data/course.ts';
import { buildPaper } from '../../src/lib/exam-data.ts';

const extQuestions = [...examQuestions, ...examQuestionsExtra];
const EXT_TYPES = ['multi', 'fill', 'short', 'code'] as const;
const ALL_TYPES = ['choice', 'truefalse', ...EXT_TYPES] as const;

test('六种题型齐备,且每种都有题目', () => {
  const all = [...conceptQuestions, ...extQuestions];
  const counts = Object.fromEntries(ALL_TYPES.map((t) => [t, 0])) as Record<string, number>;
  for (const q of all) counts[q.type] = (counts[q.type] ?? 0) + 1;
  for (const t of ALL_TYPES) assert.ok(counts[t] > 0, `题型 ${t} 没有题目`);
});

test('全库题号唯一,总量达到正式考试规模(>=140)', () => {
  const all = [...conceptQuestions, ...extQuestions];
  const ids = all.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, '存在重复题号');
  assert.ok(all.length >= 140, `题库总量仅 ${all.length},不足以支撑多套不重复试卷`);
  const codeCount = all.filter((q) => q.type === 'code').length;
  assert.ok(codeCount >= 20, `编程题仅 ${codeCount} 道`);
});

test('扩展题库:每单元齐备四种题型,且编程题总量 >= 10', () => {
  const units = ['unit-1', 'unit-2', 'unit-3', 'unit-4', 'unit-5'];
  for (const u of units) {
    const inUnit = extQuestions.filter((q) => q.unitId === u);
    for (const t of EXT_TYPES) {
      assert.ok(inUnit.some((q) => q.type === t), `${u} 缺少 ${t} 题型`);
    }
  }
  const codeCount = extQuestions.filter((q) => q.type === 'code').length;
  assert.ok(codeCount >= 10, `编程题只有 ${codeCount} 道,不足以防短期重复`);
});

test('扩展题 unitId 与课程定义的 lesson 归属一致(不再全部落在 unit-1)', () => {
  const unitOfLesson = new Map(lessons.map((l) => [l.id, l.unitId]));
  for (const q of extQuestions) {
    const expectUnit = unitOfLesson.get(q.lessonId);
    assert.ok(expectUnit, `${q.id} 的 lessonId=${q.lessonId} 不存在于课程定义`);
    assert.equal(q.unitId, expectUnit, `${q.id} 的 unitId=${q.unitId} 应为 ${expectUnit}`);
  }
});

test('编程题均带 starter 与 check,multi 带 options,填空/简答带判分字段', () => {
  for (const q of extQuestions) {
    if (q.type === 'code') {
      assert.ok(q.starter && q.check, `${q.id} 编程题缺 starter/check`);
    } else if (q.type === 'multi') {
      assert.ok(q.options && q.options.length >= 2 && q.answer && q.answer.length >= 1, `${q.id} 多选题字段不全`);
      for (const a of q.answer!) assert.ok(Number(a) < q.options!.length, `${q.id} 答案索引越界`);
    } else if (q.type === 'fill') {
      assert.ok(q.accept && q.accept.length >= 1, `${q.id} 填空题缺 accept`);
    } else if (q.type === 'short') {
      assert.ok(q.keywords && q.keywords.length >= 1, `${q.id} 简答题缺 keywords`);
    }
  }
});

test('题型配比:编程题必入选,且各题型数量符合配额', () => {
  const plan = { choice: 0, truefalse: 0, multi: 1, fill: 1, short: 0, code: 2 };
  const built = buildPaper('', 10, 10, plan);
  const typeCount = Object.fromEntries(ALL_TYPES.map((t) => [t, 0])) as Record<string, number>;
  for (const q of built.paper) typeCount[q.type] += 1;
  assert.ok(typeCount.code >= 2, `编程题应至少 2 道,实际 ${typeCount.code}`);
  assert.ok(typeCount.multi >= 1, `多选题应至少 1 道,实际 ${typeCount.multi}`);
  assert.ok(typeCount.fill >= 1, `填空题应至少 1 道,实际 ${typeCount.fill}`);
  assert.equal(built.paper.length, 10, '总题量应补齐到 10');
});

test('按单元组卷 + 编程配比:unit-4 也能抽到编程题', () => {
  const built = buildPaper('unit-4', 6, 10, { code: 2 });
  assert.equal(built.paper.length, 6);
  const code = built.paper.filter((q) => q.type === 'code');
  assert.ok(code.length >= 2, `unit-4 应至少抽到 2 道编程题,实际 ${code.length}`);
  for (const q of built.paper) assert.equal((q as { starter?: string }).starter !== undefined, q.type === 'code');
});

test('objective 判分规则与题型对齐', () => {
  const built = buildPaper('', 40, 5, { code: 10, multi: 10, fill: 10, short: 10 });
  for (const q of built.paper) {
    const rule = built.objective[q.id];
    assert.ok(rule, `${q.id} 缺 objective 规则`);
    if (q.type === 'fill') assert.equal(rule.mode, 'any', `${q.id} 填空应为 any`);
    else if (q.type === 'short') assert.equal(rule.mode, 'keyword', `${q.id} 简答应为 keyword`);
    else if (q.type === 'code') {
      assert.equal(rule.mode, 'set');
      assert.deepEqual(rule.answer, ['PASS'], `${q.id} 编程题答案应为 PASS`);
    } else assert.equal(rule.mode, 'set', `${q.id} 客观题应为 set`);
  }
});
