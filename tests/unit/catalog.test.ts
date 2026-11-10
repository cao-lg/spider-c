// 课程数据完整性测试 —— 保证"教—学—评"三者不脱节
//
// 这些断言看起来琐碎,但每一条都对应一类真实事故:
//   · 答案索引越界 → 学生怎么选都错(静默)
//   · 错误选项没有诊断 → 学生只知道错了,不知道错在哪
//   · 目标没有题覆盖 → "教了但不评",教师无法判断是否达成
//   · 时间轴合计与课时不符 → 备课稿没法直接拿去用

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lessons, units, skillDomains } from '../../src/data/course.ts';
import { conceptQuestions, misconceptionLabels } from '../../src/data/questions.ts';
import { lessonDesigns, designList } from '../../src/data/design.ts';
import { lessonTasks } from '../../src/data/tasks.ts';

const lessonIds = new Set(lessons.map((l) => l.id));
const unitIds = new Set(units.map((u) => u.id));

test('题目 id 唯一', () => {
  const seen = new Set<string>();
  for (const q of conceptQuestions) {
    assert.ok(!seen.has(q.id), `重复题目 id: ${q.id}`);
    seen.add(q.id);
  }
});

test('每道题都归属存在的课程与单元,且二者一致', () => {
  for (const q of conceptQuestions) {
    assert.ok(lessonIds.has(q.lessonId), `${q.id} 的 lessonId 不存在: ${q.lessonId}`);
    assert.ok(unitIds.has(q.unitId), `${q.id} 的 unitId 不存在: ${q.unitId}`);
    const lesson = lessons.find((l) => l.id === q.lessonId)!;
    assert.equal(q.unitId, lesson.unitId, `${q.id} 的单元与课程所属单元不一致`);
  }
});

test('选择题答案索引合法且选项不重复', () => {
  for (const q of conceptQuestions.filter((x) => x.type === 'choice')) {
    const opts = q.options ?? [];
    assert.ok(opts.length >= 2 && opts.length <= 4, `${q.id} 选项数量异常: ${opts.length}`);
    const idx = Number(q.answer[0]);
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx < opts.length, `${q.id} 答案索引越界: ${idx}`);
    assert.equal(new Set(opts).size, opts.length, `${q.id} 存在重复选项`);
  }
});

test('选择题的每个错误选项都必须有诊断反馈', () => {
  for (const q of conceptQuestions.filter((x) => x.type === 'choice')) {
    const opts = q.options ?? [];
    const fb = q.optionFeedback ?? [];
    assert.equal(fb.length, opts.length, `${q.id} 的 optionFeedback 数量与选项不一致`);
    const correct = Number(q.answer[0]);
    fb.forEach((text, i) => {
      if (i === correct) return;
      assert.ok(
        typeof text === 'string' && text.trim().length >= 8,
        `${q.id} 第 ${i} 个错误选项缺少诊断文本(诊断性评价的核心资产)`,
      );
    });
  }
});

test('判断题与填空题有可匹配的答案', () => {
  for (const q of conceptQuestions.filter((x) => x.type !== 'choice')) {
    assert.ok(q.answer.length > 0 && q.answer.every((a) => a.trim().length > 0), `${q.id} 答案为空`);
    if (q.type === 'truefalse') {
      assert.ok(['T', 'F'].includes(q.answer[0]), `${q.id} 判断题答案应为 T/F`);
    }
  }
});

test('每道题都有解析与课内锚点', () => {
  for (const q of conceptQuestions) {
    assert.ok((q.explanation ?? '').length >= 15, `${q.id} 缺少解析`);
    assert.ok((q.anchor ?? '').length >= 2, `${q.id} 缺少 anchor(答错后回看哪一节)`);
  }
});

test('误区标签全部登记了中文名', () => {
  for (const q of conceptQuestions) {
    if (!q.misconception) continue;
    assert.ok(
      misconceptionLabels[q.misconception],
      `${q.id} 使用了未登记的误区标签: ${q.misconception}`,
    );
  }
});

test('题目的 objectiveId 必须在设计层存在', () => {
  const ids = new Set(designList.flatMap((d) => d.objectives.map((o) => o.id)));
  for (const q of conceptQuestions) {
    if (!q.objectiveId) continue;
    assert.ok(ids.has(q.objectiveId), `${q.id} 指向不存在的目标: ${q.objectiveId}`);
  }
});

test('题目的 skills 取值必须在技能维度内', () => {
  const domains = new Set<string>(skillDomains);
  for (const q of conceptQuestions) {
    for (const s of q.skills ?? []) {
      assert.ok(domains.has(s), `${q.id} 含未知技能维度: ${s}`);
    }
  }
});

test('每门课至少 2 道概念题(保证课内检查点有内容)', () => {
  for (const lesson of lessons) {
    const n = conceptQuestions.filter((q) => q.lessonId === lesson.id).length;
    assert.ok(n >= 2, `${lesson.id} 只有 ${n} 道概念题`);
  }
});

test('每门课都有教学设计卡', () => {
  for (const lesson of lessons) {
    assert.ok(lessonDesigns[lesson.id], `${lesson.id} 缺少教学设计卡`);
  }
});

test('每个目标都被至少一种评价覆盖(概念题或实操任务)', () => {
  for (const d of designList) {
    for (const o of d.objectives) {
      const concept = conceptQuestions.filter((q) => q.objectiveId === o.id).length;
      const task = Boolean(lessonTasks[d.lessonId]);
      assert.ok(concept > 0 || task, `${o.id} 既无概念题也无实操任务覆盖——"教了但不评"`);
    }
  }
});

test('时间轴合计必须等于课时时长(备课稿可直接使用)', () => {
  for (const d of designList) {
    const lesson = lessons.find((l) => l.id === d.lessonId)!;
    const total = d.timeline.reduce((s, t) => s + t.min, 0);
    assert.equal(total, lesson.duration, `${d.lessonId} 时间轴合计 ${total} 分钟,课时 ${lesson.duration} 分钟`);
  }
});

test('先修关系指向存在的课程,且不自指', () => {
  for (const d of designList) {
    for (const p of d.prerequisites) {
      assert.ok(lessonIds.has(p), `${d.lessonId} 的先修课程不存在: ${p}`);
      assert.notEqual(p, d.lessonId, `${d.lessonId} 不能以自己为先修`);
    }
  }
});

test('先修关系无环(否则排课无解)', () => {
  const graph = new Map(designList.map((d) => [d.lessonId, d.prerequisites]));
  const state = new Map<string, 0 | 1 | 2>();

  const visit = (id: string, path: string[]): void => {
    const st = state.get(id) ?? 0;
    if (st === 1) {
      assert.fail(`先修关系出现环: ${[...path, id].join(' → ')}`);
    }
    if (st === 2) return;
    state.set(id, 1);
    for (const p of graph.get(id) ?? []) {
      if (graph.has(p)) visit(p, [...path, id]);
    }
    state.set(id, 2);
  };

  for (const d of designList) visit(d.lessonId, []);
});

test('每个目标的表述是可观测的行为动词,不用"理解/掌握"', () => {
  const banned = /\b(理解|掌握|熟悉|了解|体会)\b/;
  for (const o of designList.flatMap((d) => d.objectives)) {
    assert.ok(!banned.test(o.statement), `${o.id} 用了不可测动词: ${o.statement}`);
  }
});

test('每课都有驱动性问题与迁移问题', () => {
  for (const d of designList) {
    assert.ok(d.driving.length >= 8, `${d.lessonId} 驱动性问题太短`);
    assert.ok(d.transfer.length >= 8, `${d.lessonId} 迁移问题太短`);
    assert.ok(d.pitfalls.length >= 2, `${d.lessonId} 至少列 2 个课堂误区`);
  }
});
