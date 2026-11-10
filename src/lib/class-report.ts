// 教师端学情报告引擎 —— 纯函数,无 DOM / 无网络 / 无 localStorage
//
// 设计立场(教学视角,比技术更重要):
//  1. 报告不是排行榜。学生明细只出现匿名学号,不出现姓名、不排名、不折算总分。
//  2. 「目标达成」必须标注证据强度。旧版备份只存卷面总分,没有逐题明细,
//     此时"没犯错"只能算间接证据,不能冒充"已达成";没有作答就是「无数据」。
//  3. 一切结论要能指向下一步动作:重讲哪一课、回看哪个锚点、改哪条提问链。
//  4. 阶段 0(离线文件)与阶段 1(D1 在线)共用本文件,口径永远一致。

import type { Attempt, BloomLevel, LearningData, QuestionAnswer } from './types.ts';
import { lessons, skillDomains, getLessonById, getUnit } from '../data/course.ts';
import {
  conceptQuestions,
  misconceptionLabels,
  misconceptionLabel,
  lessonQuizId,
  unitQuizId,
} from '../data/questions.ts';
import { designList, type Objective } from '../data/design.ts';
import { lessonTasks } from '../data/tasks.ts';
import { migrate } from './schema.ts';
import { countAttempts, inferRoster, mergeLearningData } from './merge.ts';

export const DEFAULT_CLASS_A = '1班';
export const DEFAULT_CLASS_B = '2班';
export const RETEACH_THRESHOLD = 0.6;
export const WATCH_THRESHOLD = 0.8;

export interface StudentRecord {
  studentId: string;
  classId: string;
  /** 页面列表里显示的来源说明(文件名 / 云端同步时间),不参与统计 */
  sourceLabel: string;
  source: 'file' | 'cloud' | 'demo';
  fileName?: string;
  syncedAt?: number;
  data: LearningData;
}

export interface ObjectiveStat {
  id: string;
  statement: string;
  bloom: BloomLevel;
  lessonId: string;
  lessonTitle: string;
  unitTitle: string;
  evidence: string;
  questionIds: string[];
  /** 有证据(直接/间接)的学生数 */
  attempted: number;
  /** 判定达成的人数 */
  achieved: number;
  /** 逐题明细充分的学生数 */
  directCount: number;
  rate: number | null;
  status: 'good' | 'watch' | 'critical' | 'nodata';
  anchor?: string;
}

export interface MisconceptionStat {
  key: string;
  label: string;
  /** 命中该误区的学生数(同一学生只算 1 人) */
  students: number;
  /** 累计错误次数 */
  occurrences: number;
  /** 已通过重练消除的人数 */
  resolved: number;
  /** 仍未消除的人次 */
  unresolved: number;
  lessonIds: string[];
}

export interface LessonStat {
  id: string;
  title: string;
  unitId: string;
  unitTitle: string;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
  avgMastery: number;
}

export interface SkillStat {
  name: string;
  /** 班级平均掌握度(0-1) */
  avgMastery: number;
  /** 有多少学生在该维度上有记录 */
  covered: number;
}

export interface StudentSummary {
  studentId: string;
  classId: string;
  completed: number;
  avgMastery: number;
  openMistakes: number;
  attempts: number;
  lastActive: number;
  status: 'ontrack' | 'watch' | 'behind';
}

export interface TeachingDecision {
  kind: 'reteach' | 'misconception' | 'pace' | 'group' | 'assessment';
  priority: number;
  title: string;
  detail: string;
  href?: string;
  linkLabel?: string;
}

export interface ClassSummary {
  classId: string;
  students: number;
  avgCompleted: number;
  conceptAccuracy: number | null;
  openMistakes: number;
}

export interface ClassReport {
  generatedAt: number;
  classId: string | null;
  classes: string[];
  byClass: ClassSummary[];
  studentCount: number;
  students: StudentSummary[];
  objectives: ObjectiveStat[];
  misconceptions: MisconceptionStat[];
  lessonStats: LessonStat[];
  skills: SkillStat[];
  decisions: TeachingDecision[];
  totals: {
    avgCompleted: number;
    conceptAccuracy: number | null;
    openMistakes: number;
    attempts: number;
    unresolvedMistakes: number;
    lastSyncedAt: number;
  };
}

interface ObjectiveMeta {
  objective: Objective;
  lessonId: string;
  lessonTitle: string;
  unitTitle: string;
  questionIds: string[];
  /** 该课代码实战的任务 id(无概念题覆盖的目标靠它取证) */
  practiceKeys: string[];
  anchor?: string;
}

/** 目标 → 课 / 题 / 锚点的索引,模块加载时构建一次 */
const objectiveMeta: ObjectiveMeta[] = designList.flatMap((d) => {
  const lesson = getLessonById(d.lessonId);
  return d.objectives.map((o) => {
    const qs = conceptQuestions.filter((q) => q.objectiveId === o.id);
    return {
      objective: o,
      lessonId: d.lessonId,
      lessonTitle: lesson?.title ?? d.lessonId,
      unitTitle: lesson ? getUnit(lesson.unitId).title : '',
      questionIds: qs.map((q) => q.id),
      practiceKeys: lessonTasks[d.lessonId] ? [lessonTasks[d.lessonId].id] : [],
      anchor: qs[0]?.anchor,
    };
  });
});

const qidToObjective = new Map<string, string>();
for (const m of objectiveMeta) {
  for (const qid of m.questionIds) qidToObjective.set(qid, m.objective.id);
}

/** 解析一份备份文件。坏 JSON / 版本不认识 / 空记录分别给出可读原因 */
export function parseBackup(
  text: string,
  fileName: string,
): { ok: true; record: StudentRecord } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: `${fileName}:不是合法的 JSON,可能选错了文件。` };
  }
  const data = migrate(raw);
  if (!data) {
    return { ok: false, error: `${fileName}:结构无法识别,可能不是本课程的备份或来自更新的版本。` };
  }
  if (countAttempts(data) === 0 && Object.keys(data.lessons ?? {}).length === 0) {
    return { ok: false, error: `${fileName}:备份里没有任何学习记录,加入后不会产生变化。` };
  }
  const roster = inferRoster(data, fileName);
  return {
    ok: true,
    record: {
      studentId: roster.studentId || fileName.replace(/\.json$/i, ''),
      classId: roster.classId || DEFAULT_CLASS_A,
      sourceLabel: fileName,
      source: 'file',
      fileName,
      data,
    },
  };
}

/** 同一学号的多份备份(如同一学生两台电脑)合并成一条记录 */
export function collapseByStudent(records: StudentRecord[]): StudentRecord[] {
  // 同一份文件被重复选择时去重。键里必须带上学号/班级:
  // 示例数据与云端快照的 sourceLabel 是统一的文案,只看文件名会把全班压成 1 人。
  const seen = new Set<string>();
  const unique = records.filter((r) => {
    const key = `${r.source}:${r.sourceLabel}:${r.classId}:${r.studentId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const groups = new Map<string, StudentRecord[]>();
  for (const r of unique) {
    const key = `${r.classId}::${r.studentId}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.values()].map((list) => {
    if (list.length === 1) return list[0];
    const sorted = [...list].sort((a, b) => (a.syncedAt ?? 0) - (b.syncedAt ?? 0));
    let data = sorted[0].data;
    for (let i = 1; i < sorted.length; i++) data = mergeLearningData(data, sorted[i].data);
    return {
      ...sorted[0],
      data,
      sourceLabel: `${list.length} 份备份已合并`,
    };
  });
}

function allConceptAttempts(d: LearningData): { key: string; attempt: Attempt }[] {
  const out: { key: string; attempt: Attempt }[] = [];
  for (const [key, list] of Object.entries(d.concepts ?? {})) {
    for (const attempt of list ?? []) out.push({ key, attempt });
  }
  return out.sort((a, b) => a.attempt.ts - b.attempt.ts);
}

/** 逐题明细:同一题多次作答,取最近一次 */
function latestAnswers(d: LearningData): Map<string, QuestionAnswer> {
  const map = new Map<string, QuestionAnswer>();
  for (const { attempt } of allConceptAttempts(d)) {
    for (const a of attempt.answers ?? []) map.set(a.qid, a);
  }
  return map;
}

function unresolvedMistakes(d: LearningData, qids: string[]): number {
  const set = new Set(qids);
  return Object.values(d.mistakes ?? {}).filter((m) => !m.resolvedAt && set.has(m.qid)).length;
}

function hasQuizEvidence(d: LearningData, lessonId: string): boolean {
  const quizKeys = [lessonQuizId(lessonId)];
  const lesson = getLessonById(lessonId);
  if (lesson) quizKeys.push(unitQuizId(lesson.unitId));
  for (const { key, attempt } of allConceptAttempts(d)) {
    if (quizKeys.includes(key) || attempt.lessonId === lessonId) return true;
  }
  return false;
}

type Evidence = { kind: 'direct' | 'indirect' | 'none'; achieved: boolean };

/** 代码实战是否通过:取该课任务最近一次尝试,passed 优先,旧数据用得分率兜底 */
function practiceEvidence(d: LearningData, meta: ObjectiveMeta): { has: boolean; passed: boolean } {
  const candidates: Attempt[] = [];
  for (const key of meta.practiceKeys) candidates.push(...(d.practice?.[key] ?? []));
  for (const list of Object.values(d.practice ?? {})) {
    candidates.push(...list.filter((a) => a.lessonId === meta.lessonId));
  }
  if (candidates.length === 0) return { has: false, passed: false };
  const latest = [...candidates].sort((a, b) => a.ts - b.ts).at(-1)!;
  return {
    has: true,
    passed: latest.passed === true || (latest.passed === undefined && latest.ratio >= RETEACH_THRESHOLD),
  };
}

function objectiveEvidence(d: LearningData, meta: ObjectiveMeta): Evidence {
  const answers = latestAnswers(d);
  const direct = meta.questionIds
    .map((qid) => answers.get(qid))
    .filter((a): a is QuestionAnswer => Boolean(a));
  const open = unresolvedMistakes(d, meta.questionIds);

  // ① 有逐题明细 —— 最硬的证据
  if (direct.length > 0) {
    const ratio = direct.filter((a) => a.correct).length / direct.length;
    return { kind: 'direct', achieved: ratio >= RETEACH_THRESHOLD && open === 0 };
  }

  // ② 该目标没有概念题(44 个里有 17 个由代码实战评价)。
  //    绝不能拿"参与过别的概念卷且没错题"当达成证据 —— 那是"教了但没评",
  //    看起来会是虚假的 100%。只认该课实操任务的通过记录。
  if (meta.questionIds.length === 0) {
    const p = practiceEvidence(d, meta);
    return p.has ? { kind: 'indirect', achieved: p.passed } : { kind: 'none', achieved: false };
  }

  // ③ 有概念题但备份是旧版(只存卷面总分):由"参与作答 + 无未消除错题"间接推断
  if (hasQuizEvidence(d, meta.lessonId)) {
    return { kind: 'indirect', achieved: open === 0 };
  }
  return { kind: 'none', achieved: false };
}

function lastActiveAt(d: LearningData): number {
  let t = d.profile?.createdAt ?? 0;
  for (const map of [d.exercises, d.unitTests, d.practice, d.concepts]) {
    for (const list of Object.values(map ?? {})) {
      for (const a of list ?? []) t = Math.max(t, a.ts ?? 0);
    }
  }
  for (const p of Object.values(d.lessons ?? {})) {
    t = Math.max(t, p.lastVisitedAt ?? 0, p.completedAt ?? 0);
  }
  return t;
}

function conceptAccuracyOf(d: LearningData): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const { attempt } of allConceptAttempts(d)) {
    const answers = attempt.answers ?? [];
    if (answers.length > 0) {
      for (const a of answers) {
        total += 1;
        if (a.correct) correct += 1;
      }
    } else {
      total += 1;
      // 旧版备份没有逐题明细:用卷面得分率折算成"约等于答对的题数",
      // 并在页面上标注为估算值,不让教师把它当成精确诊断。
      const estimated = Math.round(attempt.ratio * 3) / 3;
      correct += estimated;
    }
  }
  return { correct, total };
}

function buildStudentSummary(r: StudentRecord, medianCompleted: number): StudentSummary {
  const d = r.data;
  const progresses = Object.values(d.lessons ?? {});
  const completed = progresses.filter((p) => p.status === 'completed').length;
  const started = progresses.filter((p) => p.status !== 'not_started');
  const avgMastery = started.length
    ? started.reduce((s, p) => s + (p.mastery ?? 0), 0) / started.length
    : 0;
  const openMistakes = Object.values(d.mistakes ?? {}).filter((m) => !m.resolvedAt).length;
  const status: StudentSummary['status'] =
    medianCompleted > 0 && completed < medianCompleted / 2
      ? 'behind'
      : completed < medianCompleted
        ? 'watch'
        : 'ontrack';
  return {
    studentId: r.studentId,
    classId: r.classId,
    completed,
    avgMastery,
    openMistakes,
    attempts: countAttempts(d),
    lastActive: lastActiveAt(d),
    status,
  };
}

function buildClassSummary(records: StudentRecord[]): ClassSummary {
  const acc = records.reduce(
    (s, r) => {
      const a = conceptAccuracyOf(r.data);
      return { correct: s.correct + a.correct, total: s.total + a.total };
    },
    { correct: 0, total: 0 },
  );
  return {
    classId: records[0]?.classId ?? DEFAULT_CLASS_A,
    students: records.length,
    avgCompleted: records.length
      ? records.reduce(
          (s, r) =>
            s + Object.values(r.data.lessons ?? {}).filter((p) => p.status === 'completed').length,
          0,
        ) / records.length
      : 0,
    conceptAccuracy: acc.total ? acc.correct / acc.total : null,
    openMistakes: records.reduce(
      (s, r) => s + Object.values(r.data.mistakes ?? {}).filter((m) => !m.resolvedAt).length,
      0,
    ),
  };
}

function buildDecisions(
  report: Omit<ClassReport, 'decisions'>,
): TeachingDecision[] {
  const out: TeachingDecision[] = [];
  const n = report.studentCount;

  for (const o of report.objectives) {
    if (o.rate === null || o.rate >= RETEACH_THRESHOLD || o.attempted < 2) continue;
    const href = o.anchor
      ? `/tutorials/${getLessonById(o.lessonId)?.slug ?? o.lessonId}/`
      : undefined;
    out.push({
      kind: 'reteach',
      priority: (1 - o.rate) * 100 + o.attempted,
      title: `重讲:${o.lessonTitle} · ${o.statement}`,
      detail:
        `${o.achieved}/${o.attempted} 人有证据达成(达成率 ${Math.round(o.rate * 100)}%)。` +
        (o.anchor ? `回看锚点「${o.anchor}」,先用一个反例提问暴露错误想法,再给正例。` : '') +
        (o.directCount < o.attempted
          ? ` 其中 ${o.attempted - o.directCount} 人只有间接证据(旧备份无逐题明细),建议补一道即时检测题。`
          : ''),
      href,
      linkLabel: '打开该课',
    });
  }

  for (const m of report.misconceptions) {
    if (m.unresolved === 0 || m.students < Math.max(2, Math.ceil(n * 0.3))) continue;
    out.push({
      kind: 'misconception',
      priority: (m.students / Math.max(1, n)) * 100 + m.unresolved,
      title: `共性误区:${m.label}`,
      detail:
        `${m.students}/${n} 人命中,累计错 ${m.occurrences} 次,仍有 ${m.unresolved} 人次未消除。` +
        `下节课的提问链里加一道专门针对这个错误想法的辨析题,别只重讲正确答案。`,
      href: m.lessonIds[0]
        ? `/tutorials/${getLessonById(m.lessonIds[0])?.slug ?? m.lessonIds[0]}/`
        : undefined,
      linkLabel: '打开相关课',
    });
  }

  for (const l of report.lessonStats) {
    if (n < 3 || l.completionRate >= 0.5) continue;
    out.push({
      kind: 'pace',
      priority: (1 - l.completionRate) * 60,
      title: `进度预警:${l.title}`,
      detail: `仅 ${l.completed}/${n} 人完成,${l.notStarted} 人未开始。先确认是课时不够还是前置课卡住了,再决定是否调整时间轴。`,
      href: `/tutorials/${getLessonById(l.id)?.slug ?? l.id}/`,
      linkLabel: '打开该课',
    });
  }

  const behind = report.students.filter((s) => s.status === 'behind');
  if (behind.length >= 2) {
    out.push({
      kind: 'group',
      priority: 40 + behind.length,
      title: `分组补救:${behind.length} 人明显掉队`,
      detail:
        `学号 ${behind.slice(0, 8).map((s) => s.studentId).join('、')}${behind.length > 8 ? ' 等' : ''}。` +
        `按误区标签而不是按总分分组:同一误区的学生做同一组补救题,教师只巡视最集中的那一组。`,
      href: '/mistakes/',
      linkLabel: '查看补救入口',
    });
  }

  if (report.totals.conceptAccuracy !== null && report.totals.conceptAccuracy < 0.7) {
    out.push({
      kind: 'assessment',
      priority: 35,
      title: '调整形成性评价',
      detail:
        `班级概念题正确率约 ${Math.round(report.totals.conceptAccuracy * 100)}%,` +
        `说明"讲得清"这一步没过关。先增加课内即时检测的频率,再推进实操任务;` +
        `不要用代码通过率代替概念检查。`,
      href: '/design/',
      linkLabel: '查看教学设计',
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

/**
 * 生成班级报告。
 * records 传全量,classId 只做筛选 —— 这样班级下拉与两班对比始终能拿到完整列表。
 */
export function buildClassReport(
  allRecords: StudentRecord[],
  opts: { classId?: string | null; now?: number } = {},
): ClassReport {
  const now = opts.now ?? Date.now();
  const classId = opts.classId ?? null;
  const classes = [...new Set(allRecords.map((r) => r.classId).filter(Boolean))].sort();
  const byClass = classes.map((c) => buildClassSummary(allRecords.filter((r) => r.classId === c)));
  const records = (classId ? allRecords.filter((r) => r.classId === classId) : allRecords).filter(
    (r) => r.studentId,
  );
  const n = records.length;

  const completedCounts = records.map(
    (r) => Object.values(r.data.lessons ?? {}).filter((p) => p.status === 'completed').length,
  );
  const sortedCounts = [...completedCounts].sort((a, b) => a - b);
  const median = sortedCounts.length
    ? sortedCounts[Math.floor(sortedCounts.length / 2)]
    : 0;
  const students = records.map((r) => buildStudentSummary(r, median));

  const objectives: ObjectiveStat[] = objectiveMeta.map((meta) => {
    let attempted = 0;
    let achieved = 0;
    let directCount = 0;
    for (const r of records) {
      const ev = objectiveEvidence(r.data, meta);
      if (ev.kind === 'none') continue;
      attempted += 1;
      if (ev.kind === 'direct') directCount += 1;
      if (ev.achieved) achieved += 1;
    }
    const rate = attempted ? achieved / attempted : null;
    const status: ObjectiveStat['status'] =
      rate === null
        ? 'nodata'
        : rate < RETEACH_THRESHOLD
          ? 'critical'
          : rate < WATCH_THRESHOLD
            ? 'watch'
            : 'good';
    return {
      id: meta.objective.id,
      statement: meta.objective.statement,
      bloom: meta.objective.bloom,
      lessonId: meta.lessonId,
      lessonTitle: meta.lessonTitle,
      unitTitle: meta.unitTitle,
      evidence: meta.objective.evidence,
      questionIds: meta.questionIds,
      attempted,
      achieved,
      directCount,
      rate,
      status,
      anchor: meta.anchor,
    };
  });

  const misMap = new Map<string, MisconceptionStat>();
  for (const key of Object.keys(misconceptionLabels)) {
    misMap.set(key, {
      key,
      label: misconceptionLabels[key],
      students: 0,
      occurrences: 0,
      resolved: 0,
      unresolved: 0,
      lessonIds: [],
    });
  }
  for (const r of records) {
    // 「命中人数」按学生去重;「已消除人数」要求该生此标签下所有错题都已消除,
    // 消了一半不算消除 —— 否则教师会误以为这个误区已经补完。
    const perStudent = new Map<string, { total: number; resolved: number }>();
    for (const m of Object.values(r.data.mistakes ?? {})) {
      const key = m.misconception ?? '';
      if (!key) continue;
      const stat = misMap.get(key) ?? {
        key,
        label: misconceptionLabel(key),
        students: 0,
        occurrences: 0,
        resolved: 0,
        unresolved: 0,
        lessonIds: [],
      };
      const agg = perStudent.get(key) ?? { total: 0, resolved: 0 };
      agg.total += 1;
      if (m.resolvedAt) agg.resolved += 1;
      else stat.unresolved += 1;
      perStudent.set(key, agg);
      stat.occurrences += m.wrongCount ?? 0;
      if (m.lessonId && !stat.lessonIds.includes(m.lessonId)) stat.lessonIds.push(m.lessonId);
      misMap.set(key, stat);
    }
    for (const [key, agg] of perStudent) {
      const stat = misMap.get(key)!;
      stat.students += 1;
      if (agg.resolved === agg.total) stat.resolved += 1;
    }
  }
  const misconceptions = [...misMap.values()]
    .map((m) => ({ ...m, resolved: Math.min(m.resolved, m.students) }))
    .sort(
      (a, b) =>
        b.students - a.students ||
        b.occurrences - a.occurrences ||
        a.label.localeCompare(b.label, 'zh'),
    );

  const lessonStats: LessonStat[] = lessons.map((l) => {
    let completed = 0;
    let inProgress = 0;
    let masterySum = 0;
    for (const r of records) {
      const p = r.data.lessons?.[l.id];
      if (!p || p.status === 'not_started') continue;
      if (p.status === 'completed') completed += 1;
      else inProgress += 1;
      masterySum += p.mastery ?? 0;
    }
    return {
      id: l.id,
      title: l.title,
      unitId: l.unitId,
      unitTitle: getUnit(l.unitId).title,
      completed,
      inProgress,
      notStarted: Math.max(0, n - completed - inProgress),
      completionRate: n ? completed / n : 0,
      avgMastery: n ? masterySum / n : 0,
    };
  });

  const skills: SkillStat[] = skillDomains.map((name) => {
    const related = lessons.filter((l) => (l.skills ?? []).includes(name));
    let sum = 0;
    let covered = 0;
    for (const r of records) {
      const vals = related
        .map((l) => r.data.lessons?.[l.id]?.mastery ?? 0)
        .filter((v) => v > 0);
      if (vals.length) {
        sum += vals.reduce((s, v) => s + v, 0) / vals.length;
        covered += 1;
      }
    }
    return { name, avgMastery: covered ? sum / covered : 0, covered };
  });

  const acc = records.reduce(
    (s, r) => {
      const a = conceptAccuracyOf(r.data);
      return { correct: s.correct + a.correct, total: s.total + a.total };
    },
    { correct: 0, total: 0 },
  );
  const totals = {
    avgCompleted: completedCounts.length
      ? completedCounts.reduce((s, v) => s + v, 0) / completedCounts.length
      : 0,
    conceptAccuracy: acc.total ? acc.correct / acc.total : null,
    openMistakes: students.reduce((s, x) => s + x.openMistakes, 0),
    attempts: records.reduce((s, r) => s + countAttempts(r.data), 0),
    unresolvedMistakes: misconceptions.reduce((s, m) => s + m.unresolved, 0),
    lastSyncedAt: records.reduce((s, r) => Math.max(s, r.syncedAt ?? lastActiveAt(r.data)), 0),
  };

  const base: Omit<ClassReport, 'decisions'> = {
    generatedAt: now,
    classId,
    classes,
    byClass,
    studentCount: n,
    students,
    objectives,
    misconceptions,
    lessonStats,
    skills,
    totals,
  };
  return { ...base, decisions: buildDecisions(base) };
}

// ── CSV 导出(教师把报告带进 Excel / 教务系统) ──────────────────────

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  // BOM 让 Excel 正确识别 UTF-8 中文
  return '\ufeff' + rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

export function objectivesCsv(report: ClassReport): string {
  return toCsv([
    ['目标ID', '课程', '单元', '可观测目标', '认知层级', '评价方式', '达成人数', '有证据人数', '达成率%', '直接证据人数', '状态', '回看锚点'],
    ...report.objectives.map((o) => [
      o.id,
      o.lessonTitle,
      o.unitTitle,
      o.statement,
      o.bloom,
      o.questionIds.length ? '概念题' : '代码实战',
      o.achieved,
      o.attempted,
      o.rate === null ? '' : Math.round(o.rate * 100),
      o.directCount,
      { good: '达成', watch: '观察', critical: '需重讲', nodata: '无数据' }[o.status],
      o.anchor ?? '',
    ]),
  ]);
}

export function misconceptionsCsv(report: ClassReport): string {
  return toCsv([
    ['误区标签', '命中人数', '累计错误次数', '已消除人数', '未消除人次', '关联课程'],
    ...report.misconceptions.map((m) => [
      m.label,
      m.students,
      m.occurrences,
      m.resolved,
      m.unresolved,
      m.lessonIds.map((id) => getLessonById(id)?.title ?? id).join(' / '),
    ]),
  ]);
}

export function studentsCsv(report: ClassReport): string {
  return toCsv([
    ['匿名学号', '班级', '完成课程数', '平均掌握度%', '未消除错题', '累计作答', '最后活动', '跟进状态'],
    ...report.students.map((s) => [
      s.studentId,
      s.classId,
      s.completed,
      Math.round(s.avgMastery * 100),
      s.openMistakes,
      s.attempts,
      s.lastActive ? new Date(s.lastActive).toISOString().slice(0, 10) : '',
      { ontrack: '正常', watch: '关注', behind: '需补救' }[s.status],
    ]),
  ]);
}

/** 归档用的整包 JSON(阶段 2 写进 R2 的就是这个) */
export function archivePayload(report: ClassReport): string {
  return JSON.stringify(
    {
      kind: 'class-report-snapshot',
      version: 1,
      generatedAt: report.generatedAt,
      classId: report.classId,
      classes: report.classes,
      studentCount: report.studentCount,
      totals: report.totals,
      objectives: report.objectives,
      misconceptions: report.misconceptions,
      lessonStats: report.lessonStats,
      skills: report.skills,
      decisions: report.decisions,
      // 学生明细只留匿名学号与聚合指标,不带原始作答文本
      students: report.students,
    },
    null,
    2,
  );
}
