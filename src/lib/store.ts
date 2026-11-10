// 学习数据存储层:localStorage 持久化 + 响应式更新 + 导出/导入
//
// schemaVersion 2 变更:
//   + concepts  概念题作答记录
//   + mistakes  错题本(按题目去重留痕)
// 迁移策略:v1 数据不丢弃,补齐新字段后升版(见 migrate)。

import type {
  Attempt,
  LearningData,
  LessonProgress,
  MistakeRecord,
  RecordKind,
} from './types';
import { masteryFromAttempts } from './scoring';
import { defaultData, migrate, SCHEMA_VERSION } from './schema';
import { lessons as courseLessons } from '../data/course';

const STORAGE_KEY = `crawler-course:v${SCHEMA_VERSION}`;
const LEGACY_KEYS = ['crawler-course:v1'];

type Listener = () => void;

function readStorage(): LearningData {
  if (typeof localStorage === 'undefined') return defaultData();
  try {
    const legacy = LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) ?? null;
    const raw = localStorage.getItem(STORAGE_KEY) ?? legacy;
    if (!raw) return defaultData();
    return migrate(JSON.parse(raw)) ?? defaultData();
  } catch {
    return defaultData();
  }
}

let data: LearningData = defaultData();
let loaded = false;
const listeners = new Set<Listener>();

function ensureLoaded() {
  if (!loaded) {
    data = readStorage();
    loaded = true;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('保存学习数据失败:', e);
  }
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

function mutate(fn: () => void) {
  ensureLoaded();
  fn();
  persist();
  notify();
}

function attemptsMap(d: LearningData, kind: RecordKind): Record<string, Attempt[]> {
  switch (kind) {
    case 'exercise':
      return d.exercises;
    case 'practice':
      return d.practice;
    case 'concept':
      return d.concepts;
    default:
      return d.unitTests;
  }
}

export const store = {
  /** 当前数据快照 */
  getData(): LearningData {
    ensureLoaded();
    return data;
  },

  /** 订阅变更 */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** 设置学员昵称 */
  setProfile(name: string) {
    mutate(() => {
      data.profile.name = name;
    });
  },

  /** 记录课程访问(自动标记 in_progress 并设为"当前课程"以归因掌握度) */
  recordLessonVisit(lessonId: string) {
    mutate(() => {
      const p = data.lessons[lessonId] ?? { status: 'in_progress' as const, mastery: 0 };
      if (p.status === 'not_started') p.status = 'in_progress';
      p.lastVisitedAt = Date.now();
      data.lessons[lessonId] = p;
      this.pendingLesson = lessonId;
    });
  },

  /** 标记课程完成 */
  recordLessonCompleted(lessonId: string) {
    mutate(() => {
      const p = data.lessons[lessonId] ?? { status: 'completed' as const, mastery: 0 };
      p.status = 'completed';
      p.completedAt = Date.now();
      p.lastVisitedAt = Date.now();
      data.lessons[lessonId] = p;
    });
  },

  /** 记录一次练习/测试成绩;skills 用于提升对应课程的掌握度 */
  recordAttempt(kind: RecordKind, id: string, attempt: Attempt, skills: string[] = []) {
    mutate(() => {
      const map = attemptsMap(data, kind);
      const list = map[id] ?? [];
      list.push({ ...attempt, skills });
      map[id] = list;

      // 掌握度归因:优先当前课程 > 作答自带课程 > 按技能匹配相关课程
      const targets = new Set<string>();
      const current = this.pendingLesson;
      if (current) {
        targets.add(current);
      } else if (attempt.lessonId) {
        targets.add(attempt.lessonId);
      } else if (skills.length > 0) {
        for (const l of courseLessons) {
          if ((l.skills ?? []).some((s) => skills.includes(s))) targets.add(l.id);
        }
      }
      const mastery = masteryFromAttempts(list);
      for (const lid of targets) {
        const p = data.lessons[lid] ?? { status: 'in_progress' as const, mastery: 0 };
        p.mastery = Math.max(p.mastery, mastery);
        data.lessons[lid] = p;
      }
    });
  },

  /**
   * 概念题批量作答留痕:一次提交里答错的题进入错题本,答对的题标记为已消除。
   * 与 recordAttempt 分开,是因为错题本的粒度是"题",不是"卷"。
   */
  recordConceptOutcome(
    lessonId: string,
    outcomes: {
      qid: string;
      correct: boolean;
      given: string;
      misconception?: string;
    }[],
  ) {
    mutate(() => {
      const now = Date.now();
      for (const o of outcomes) {
        if (o.correct) {
          const rec = data.mistakes[o.qid];
          if (rec) {
            rec.resolvedAt = now;
            rec.lastWrongAt = rec.lastWrongAt; // 保留历史错误时间,便于统计"曾经错过"
          }
          continue;
        }
        const rec: MistakeRecord = data.mistakes[o.qid] ?? {
          qid: o.qid,
          lessonId,
          wrongCount: 0,
          firstWrongAt: now,
          lastWrongAt: now,
          lastGiven: o.given,
        };
        rec.wrongCount += 1;
        rec.lastWrongAt = now;
        rec.lastGiven = o.given;
        rec.misconception = o.misconception;
        rec.lessonId = lessonId;
        rec.resolvedAt = undefined;
        data.mistakes[o.qid] = rec;
      }
    });
  },

  /** 手动清除某题的错题记录(学生确认已掌握) */
  clearMistake(qid: string) {
    mutate(() => {
      delete data.mistakes[qid];
    });
  },

  /** 未消除的错题列表(按最近错误时间倒序,排序交给调用方) */
  getOpenMistakes(): MistakeRecord[] {
    ensureLoaded();
    return Object.values(data.mistakes).filter((m) => !m.resolvedAt);
  },

  /** 手动关联"当前课程"用于掌握度归因 */
  set pendingLesson(lessonId: string | undefined) {
    (data as { pendingLesson?: string }).pendingLesson = lessonId;
  },
  get pendingLesson(): string | undefined {
    return (data as { pendingLesson?: string }).pendingLesson;
  },

  getLessonProgress(lessonId: string): LessonProgress {
    ensureLoaded();
    return data.lessons[lessonId] ?? { status: 'not_started', mastery: 0 };
  },

  getAttempts(kind: RecordKind, id: string): Attempt[] {
    ensureLoaded();
    return attemptsMap(data, kind)[id] ?? [];
  },

  /** 重置全部学习数据 */
  resetAll() {
    mutate(() => {
      data = defaultData();
    });
  },

  /** 导出为 JSON 字符串(剔除内部临时字段) */
  exportJSON(): string {
    ensureLoaded();
    const clone = { ...data, pendingLesson: undefined };
    return JSON.stringify(clone, null, 2);
  },

  /** 导入 JSON;mode = 'replace' | 'merge' */
  importJSON(text: string, mode: 'replace' | 'merge'): { ok: boolean; error?: string } {
    try {
      const parsed = migrate(JSON.parse(text));
      if (!parsed) return { ok: false, error: '文件格式或版本不兼容' };
      mutate(() => {
        if (mode === 'replace') {
          data = parsed;
        } else {
          // 合并:按记录时间戳去重
          const mergeMap = (
            target: Record<string, Attempt[]>,
            incoming: Record<string, Attempt[]> | undefined,
          ) => {
            if (!incoming) return;
            for (const [key, list] of Object.entries(incoming)) {
              const cur = target[key] ?? [];
              const seen = new Set(cur.map((a) => a.ts));
              target[key] = [...cur, ...list.filter((a) => !seen.has(a.ts))].sort(
                (a, b) => a.ts - b.ts,
              );
            }
          };
          mergeMap(data.exercises, parsed.exercises);
          mergeMap(data.unitTests, parsed.unitTests);
          mergeMap(data.practice, parsed.practice);
          mergeMap(data.concepts, parsed.concepts);

          // 错题本取"错误次数更多 / 更晚"的一份,避免合并把已消除的错题复活
          for (const [qid, incoming] of Object.entries(parsed.mistakes ?? {})) {
            const cur = data.mistakes[qid];
            if (!cur) {
              data.mistakes[qid] = incoming;
              continue;
            }
            data.mistakes[qid] = {
              ...cur,
              wrongCount: Math.max(cur.wrongCount, incoming.wrongCount),
              firstWrongAt: Math.min(cur.firstWrongAt, incoming.firstWrongAt),
              lastWrongAt: Math.max(cur.lastWrongAt, incoming.lastWrongAt),
              lastGiven: incoming.lastWrongAt >= cur.lastWrongAt ? incoming.lastGiven : cur.lastGiven,
              misconception:
                incoming.lastWrongAt >= cur.lastWrongAt ? incoming.misconception : cur.misconception,
              resolvedAt: cur.resolvedAt ?? incoming.resolvedAt,
            };
          }

          for (const [lid, p] of Object.entries(parsed.lessons ?? {})) {
            const cur = data.lessons[lid];
            data.lessons[lid] = cur && cur.status !== 'not_started' ? cur : p;
          }
          if (!data.profile.name && parsed.profile?.name) data.profile.name = parsed.profile.name;
        }
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `解析失败:${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

/** 浏览器端加载存储(module 初始化) */
if (typeof window !== 'undefined') {
  store.getData();
}
