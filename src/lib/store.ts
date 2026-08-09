// 学习数据存储层:localStorage 持久化 + 响应式更新 + 导出/导入

import type { Attempt, LearningData, LessonProgress, RecordKind } from './types';
import { masteryFromAttempts } from './scoring';
import { lessons as courseLessons } from '../data/course';

const STORAGE_KEY = 'crawler-course:v1';
const SCHEMA_VERSION = 1;

type Listener = () => void;

function defaultData(): LearningData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { name: '', createdAt: Date.now() },
    lessons: {},
    exercises: {},
    unitTests: {},
    practice: {},
  };
}

function readStorage(): LearningData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as LearningData;
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return defaultData();
    return {
      ...defaultData(),
      ...parsed,
      profile: { ...defaultData().profile, ...(parsed.profile ?? {}) },
    };
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
      p.status = p.status === 'not_started' ? 'in_progress' : p.status;
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
      const map =
        kind === 'exercise' ? data.exercises : kind === 'practice' ? data.practice : data.unitTests;
      const list = map[id] ?? [];
      list.push({ ...attempt, skills });
      map[id] = list;

      // 掌握度归因:优先当前课程,否则按技能匹配相关课程
      const targets = new Set<string>();
      const current = this.pendingLesson;
      if (current) {
        targets.add(current);
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
    const map =
      kind === 'exercise' ? data.exercises : kind === 'practice' ? data.practice : data.unitTests;
    return map[id] ?? [];
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
      const parsed = JSON.parse(text) as LearningData;
      if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
        return { ok: false, error: '文件格式或版本不兼容' };
      }
      mutate(() => {
        if (mode === 'replace') {
          data = {
            ...defaultData(),
            ...parsed,
            profile: { ...defaultData().profile, ...(parsed.profile ?? {}) },
          };
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
              const merged = [...cur, ...list.filter((a) => !seen.has(a.ts))].sort(
                (a, b) => a.ts - b.ts,
              );
              target[key] = merged;
            }
          };
          mergeMap(data.exercises, parsed.exercises);
          mergeMap(data.unitTests, parsed.unitTests);
          mergeMap(data.practice, parsed.practice);
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
