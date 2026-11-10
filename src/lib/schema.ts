// 学习数据的 schema 与迁移
//
// 单独成文件的原因:迁移逻辑是"最容易在升级时把学生数据搞丢"的地方,
// 必须能脱离 localStorage 单独测试(tests/unit/schema.test.ts)。

import type { LearningData } from './types';

export const SCHEMA_VERSION = 2 as const;

export function defaultData(): LearningData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { name: '', createdAt: Date.now() },
    lessons: {},
    exercises: {},
    unitTests: {},
    practice: {},
    concepts: {},
    mistakes: {},
  };
}

/**
 * 把任意历史版本数据补齐为当前结构(不做破坏性删除)。
 * 返回 null 表示无法识别(非对象 / 来自更高版本),调用方应回落到空数据而不是覆盖写回。
 */
export function migrate(raw: unknown): LearningData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Partial<LearningData> & Record<string, unknown>;
  const version = Number(obj.schemaVersion ?? 1);
  if (!Number.isFinite(version) || version > SCHEMA_VERSION) return null;

  const base = defaultData();
  return {
    ...base,
    ...obj,
    schemaVersion: SCHEMA_VERSION,
    profile: { ...base.profile, ...(obj.profile ?? {}) },
    // 每层都浅拷贝,避免调用方后续写入时反向污染传入对象(导入合并会踩到)
    lessons: { ...(obj.lessons ?? {}) },
    exercises: { ...(obj.exercises ?? {}) },
    unitTests: { ...(obj.unitTests ?? {}) },
    practice: { ...(obj.practice ?? {}) },
    concepts: { ...(obj.concepts ?? {}) },
    mistakes: { ...(obj.mistakes ?? {}) },
  };
}
