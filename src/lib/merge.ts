// 学习记录的合并规则 —— 三处共用,口径必须完全一致:
//   1. store.importJSON        学生在本机合并自己的备份
//   2. 教师端离线汇总          同一学生在多台设备导出的多份备份合并
//   3. functions/api/sync.ts   云端收到上报时与已有快照合并(防止两设备互相覆盖丢记录)
//
// 放在独立纯函数文件(不碰 DOM / localStorage / node: 任何模块)的原因:
//   Cloudflare Workers 运行时能直接打包它,而 store.ts 不能。
//   合并口径一旦前后端各写一份,「同一份数据在教师端和学生端对不上」是必然的。

import type { Attempt, LearningData, RosterMeta } from './types.ts';

/** 同一题组的作答按 ts 去重后升序;返回新对象,不修改任何入参 */
export function mergeAttemptMap(
  target: Record<string, Attempt[]> | undefined,
  incoming: Record<string, Attempt[]> | undefined,
): Record<string, Attempt[]> {
  const out: Record<string, Attempt[]> = {};
  for (const [key, list] of Object.entries(target ?? {})) {
    out[key] = [...list];
  }
  for (const [key, list] of Object.entries(incoming ?? {})) {
    const cur = out[key] ?? [];
    const seen = new Set(cur.map((a) => a.ts));
    out[key] = [...cur, ...list.filter((a) => !seen.has(a.ts))].sort((a, b) => a.ts - b.ts);
  }
  return out;
}

/** 所有作答表(用于统计作答条数,不含课程状态与错题本) */
export function allAttemptMaps(d: LearningData): Record<string, Attempt[]>[] {
  return [d.exercises, d.unitTests, d.practice, d.concepts].map((m) => m ?? {});
}

export function countAttempts(d: LearningData): number {
  return allAttemptMaps(d).reduce(
    (sum, map) => sum + Object.values(map).reduce((s, list) => s + list.length, 0),
    0,
  );
}

/**
 * 把 incoming 合进 base,返回全新的 LearningData。
 * 冲突规则(与教学语义一致,不是简单的「后者覆盖前者」):
 *  · 作答:按 ts 去重,保留全部历史,不丢任何一次尝试
 *  · 错题:取错误次数更多 / 时间更晚的一份;已消除状态不被旧备份复活
 *  · 课程状态:已开始/已完成的记录优先于未开始;掌握度取较高值
 *  · 昵称/名册:只补空缺,不用空值覆盖已有值
 */
export function mergeLearningData(base: LearningData, incoming: LearningData): LearningData {
  const lessons: LearningData['lessons'] = { ...(base.lessons ?? {}) };
  for (const [lid, p] of Object.entries(incoming.lessons ?? {})) {
    const cur = lessons[lid];
    if (!cur) {
      lessons[lid] = { ...p };
      continue;
    }
    const rank = (s: string) => (s === 'completed' ? 2 : s === 'in_progress' ? 1 : 0);
    lessons[lid] = {
      ...cur,
      ...(rank(p.status) > rank(cur.status) ? { status: p.status } : {}),
      mastery: Math.max(cur.mastery ?? 0, p.mastery ?? 0),
      lastVisitedAt: Math.max(cur.lastVisitedAt ?? 0, p.lastVisitedAt ?? 0),
      completedAt: Math.max(cur.completedAt ?? 0, p.completedAt ?? 0) || undefined,
    };
  }

  const mistakes: LearningData['mistakes'] = { ...(base.mistakes ?? {}) };
  for (const [qid, inc] of Object.entries(incoming.mistakes ?? {})) {
    const cur = mistakes[qid];
    if (!cur) {
      mistakes[qid] = { ...inc };
      continue;
    }
    mistakes[qid] = {
      ...cur,
      wrongCount: Math.max(cur.wrongCount, inc.wrongCount),
      firstWrongAt: Math.min(cur.firstWrongAt, inc.firstWrongAt),
      lastWrongAt: Math.max(cur.lastWrongAt, inc.lastWrongAt),
      lastGiven: inc.lastWrongAt >= cur.lastWrongAt ? inc.lastGiven : cur.lastGiven,
      misconception: inc.lastWrongAt >= cur.lastWrongAt ? inc.misconception : cur.misconception,
      lessonId: inc.lastWrongAt >= cur.lastWrongAt ? inc.lessonId : cur.lessonId,
      // 只要有一侧已消除,就保持消除 —— 避免旧备份把补过的错题复活
      resolvedAt: cur.resolvedAt ?? inc.resolvedAt,
    };
  }

  const profile = { ...base.profile, ...incoming.profile };
  if (!profile.name && incoming.profile?.name) profile.name = incoming.profile.name;

  const roster: RosterMeta = { ...(base.roster ?? {}), ...(incoming.roster ?? {}) };
  if (!roster.studentId && incoming.roster?.studentId) roster.studentId = incoming.roster.studentId;
  if (!roster.classId && incoming.roster?.classId) roster.classId = incoming.roster.classId;

  return {
    ...base,
    ...incoming,
    schemaVersion: 2,
    profile,
    roster,
    lessons,
    exercises: mergeAttemptMap(base.exercises, incoming.exercises),
    unitTests: mergeAttemptMap(base.unitTests, incoming.unitTests),
    practice: mergeAttemptMap(base.practice, incoming.practice),
    concepts: mergeAttemptMap(base.concepts, incoming.concepts),
    mistakes,
  };
}

/**
 * 备份文件 → 学生身份。离线文件没有身份是常态(导出文件名只有日期),
 * 依次尝试:文件内 roster → profile.name 里的「班级/学号」→ 文件名。
 * 教师仍可在页面上手工改写,这里只负责给一个合理的初值。
 */
export function inferRoster(data: LearningData, fileName: string): RosterMeta {
  const fromData = data.roster ?? {};
  if (fromData.studentId && fromData.classId) {
    return { studentId: fromData.studentId, classId: fromData.classId };
  }
  const name = (data.profile?.name ?? '').trim();
  const m = name.match(/^(.+?)[/:：\- ]+(.+)$/);
  const parsed = m ? { classId: m[1].trim(), studentId: m[2].trim() } : {};
  const stem = fileName.replace(/\.json$/i, '').replace(/^crawler-course-backup-?/i, '');
  const fallbackId = stem && !/^\d{4}-\d{2}-\d{2}$/.test(stem) ? stem : '';
  return {
    classId: fromData.classId ?? parsed.classId ?? '',
    studentId: fromData.studentId ?? parsed.studentId ?? (m ? '' : name || fallbackId),
  };
}
