// schema 迁移测试 —— 升级版本最不能出错的地方:老用户的学习记录不能丢

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultData, migrate, SCHEMA_VERSION } from '../../src/lib/schema.ts';

test('defaultData 包含全部字段且版本号正确', () => {
  const d = defaultData();
  assert.equal(d.schemaVersion, SCHEMA_VERSION);
  for (const key of ['lessons', 'exercises', 'unitTests', 'practice', 'concepts', 'mistakes']) {
    assert.deepEqual((d as unknown as Record<string, unknown>)[key], {});
  }
});

test('v1 数据升级后保留原有成绩,并补齐新字段', () => {
  const v1 = {
    schemaVersion: 1,
    profile: { name: '小明', createdAt: 1 },
    lessons: { '01-environment': { status: 'completed', mastery: 1 } },
    exercises: {},
    unitTests: {},
    practice: { 'ex-06-level1': [{ ts: 10, score: 8, maxScore: 10, ratio: 0.8 }] },
  };
  const m = migrate(v1);
  assert.ok(m);
  assert.equal(m.schemaVersion, SCHEMA_VERSION);
  assert.equal(m.profile.name, '小明');
  assert.equal(m.lessons['01-environment'].status, 'completed');
  assert.equal(m.practice['ex-06-level1'].length, 1);
  assert.deepEqual(m.concepts, {});
  assert.deepEqual(m.mistakes, {});
});

test('缺少 schemaVersion 的远古数据按 v1 处理', () => {
  const m = migrate({ profile: { name: '旧数据' } });
  assert.ok(m);
  assert.equal(m.schemaVersion, SCHEMA_VERSION);
  assert.equal(m.profile.name, '旧数据');
});

test('无法识别的输入返回 null,避免覆盖写回', () => {
  assert.equal(migrate(null), null);
  assert.equal(migrate('string'), null);
  assert.equal(migrate(123), null);
  assert.equal(migrate([]), null);
});

test('高版本数据不被降级(防止把新结构读坏)', () => {
  assert.equal(migrate({ schemaVersion: SCHEMA_VERSION + 1 }), null);
});

test('已有 concepts / mistakes 不会被清空', () => {
  const m = migrate({
    schemaVersion: 2,
    concepts: { 'quiz-x': [{ ts: 1, score: 5, maxScore: 5, ratio: 1 }] },
    mistakes: { q1: { qid: 'q1', lessonId: 'x', wrongCount: 2, firstWrongAt: 1, lastWrongAt: 2, lastGiven: '0' } },
  });
  assert.ok(m);
  assert.equal(m.concepts['quiz-x'].length, 1);
  assert.equal(m.mistakes.q1.wrongCount, 2);
});

test('迁移不修改入参对象', () => {
  const input = { schemaVersion: 1, profile: { name: 'a', createdAt: 1 } };
  const snapshot = JSON.stringify(input);
  migrate(input);
  assert.equal(JSON.stringify(input), snapshot);
});
