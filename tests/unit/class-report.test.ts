// 教师端报告引擎 + 合并规则的纯逻辑快测
//
// 重点守住三条教学底线:
//   · 「没做过」不能算「已达成」(无概念题的目标必须有实操证据)
//   · 误区按「人」去重,不按错误次数放大
//   · 合并不能丢记录、不能把已消除的错题复活

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultData } from '../../src/lib/schema.ts';
import {
  mergeAttemptMap,
  mergeLearningData,
  inferRoster,
  countAttempts,
} from '../../src/lib/merge.ts';
import {
  buildClassReport,
  collapseByStudent,
  parseBackup,
  objectivesCsv,
  studentsCsv,
  csvEscape,
  archivePayload,
  type StudentRecord,
} from '../../src/lib/class-report.ts';
import { demoRecords } from '../../src/lib/demo-data.ts';
import { designList } from '../../src/data/design.ts';
import { conceptQuestions, misconceptionLabels } from '../../src/data/questions.ts';
import { lessons, skillDomains } from '../../src/data/course.ts';
import type { LearningData } from '../../src/lib/types.ts';

const T = 1_700_000_001_000;

function student(
  studentId: string,
  classId: string,
  fill?: (d: LearningData) => void,
): StudentRecord {
  const data = defaultData();
  data.profile = { name: studentId, createdAt: T - 86400000 };
  data.roster = { studentId, classId };
  fill?.(data);
  return {
    studentId,
    classId,
    sourceLabel: `${studentId}.json`,
    source: 'file',
    data,
  };
}

function attempt(ts: number, ratio: number, passed?: boolean) {
  return { ts, score: Math.round(ratio * 10), maxScore: 10, ratio, passed };
}

// ── 合并规则 ────────────────────────────────────────────────────

test('mergeAttemptMap 按 ts 去重、升序,且不修改入参', () => {
  const a = { q: [attempt(T, 0.5), attempt(T + 20, 0.8)] };
  const b = { q: [attempt(T, 0.1), attempt(T + 10, 0.6)], r: [attempt(T, 1)] };
  const out = mergeAttemptMap(a, b);
  assert.equal(out.q.length, 3);
  assert.deepEqual(out.q.map((x) => x.ts), [T, T + 10, T + 20]);
  assert.equal(out.q[0].ratio, 0.5, '同一 ts 保留已有记录');
  assert.equal(out.r.length, 1);
  assert.equal(a.q.length, 2, '入参未被改动');
  assert.equal(b.q.length, 2);
});

test('mergeLearningData 不复活已消除错题、不降低课程状态与掌握度', () => {
  const base = defaultData();
  base.mistakes['q-01-1'] = {
    qid: 'q-01-1', lessonId: '01-environment', wrongCount: 3,
    firstWrongAt: T, lastWrongAt: T + 100, lastGiven: '0',
    misconception: 'env-not-activated', resolvedAt: T + 200,
  };
  base.lessons['01-environment'] = { status: 'completed', mastery: 0.9 };
  const incoming = defaultData();
  incoming.mistakes['q-01-1'] = {
    qid: 'q-01-1', lessonId: '01-environment', wrongCount: 5,
    firstWrongAt: T - 100, lastWrongAt: T + 300, lastGiven: '2',
    misconception: 'env-not-activated',
  };
  incoming.lessons['01-environment'] = { status: 'in_progress', mastery: 0.2 };
  incoming.exercises['x'] = [attempt(T + 400, 1)];

  const out = mergeLearningData(base, incoming);
  assert.equal(out.mistakes['q-01-1'].resolvedAt, T + 200, '旧备份不能复活已消除错题');
  assert.equal(out.mistakes['q-01-1'].wrongCount, 5, '取更大的错误次数');
  assert.equal(out.mistakes['q-01-1'].firstWrongAt, T - 100, '取更早的首次错误');
  assert.equal(out.lessons['01-environment'].status, 'completed');
  assert.equal(out.lessons['01-environment'].mastery, 0.9);
  assert.equal(countAttempts(out), 1);
});

test('inferRoster:文件内名册 > 昵称里的班级/学号 > 文件名', () => {
  const a = defaultData();
  a.roster = { studentId: 'S01', classId: '1班' };
  assert.deepEqual(inferRoster(a, 'backup.json'), { studentId: 'S01', classId: '1班' });

  const b = defaultData();
  b.profile.name = '2班/S09';
  assert.deepEqual(inferRoster(b, 'x.json'), { studentId: 'S09', classId: '2班' });

  const c = defaultData();
  const r = inferRoster(c, 'crawler-course-backup-2026-11-10.json');
  assert.equal(r.classId, '');
  assert.equal(r.studentId, '');
});

// ── 备份解析 ────────────────────────────────────────────────────

test('parseBackup 三类坏文件分别给出可读原因', () => {
  const errorOf = (text: string) => {
    const r = parseBackup(text, 'a.json');
    return r.ok ? '' : r.error;
  };
  assert.match(errorOf('not json'), /不是合法的 JSON/);
  assert.match(errorOf('{"schemaVersion":99}'), /结构无法识别/);
  assert.match(errorOf(JSON.stringify(defaultData())), /没有任何学习记录/);
});

test('parseBackup 正常备份保留 roster 并给出学号', () => {
  const d = defaultData();
  d.roster = { studentId: 'S07', classId: '2班' };
  d.practice['ex'] = [attempt(T, 1)];
  const res = parseBackup(JSON.stringify(d), 'a.json');
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.record.studentId, 'S07');
    assert.equal(res.record.classId, '2班');
  }
});

// ── 报告结构 ────────────────────────────────────────────────────

test('报告维度与课程数据一致:44 目标 / 28 误区 / 13 课 / 5 技能', () => {
  const r = buildClassReport(demoRecords(T), { now: T });
  const objectiveCount = designList.reduce((s, d) => s + d.objectives.length, 0);
  assert.equal(r.objectives.length, objectiveCount);
  assert.equal(r.misconceptions.length, Object.keys(misconceptionLabels).length);
  assert.equal(r.lessonStats.length, lessons.length);
  assert.equal(r.skills.length, skillDomains.length);
  assert.equal(r.studentCount, 10);
  assert.deepEqual(r.classes, ['1班', '2班']);
  assert.equal(r.byClass.length, 2);
});

test('无概念题覆盖的目标:只做概念卷不算达成,必须看实操通过', () => {
  const noQuestion = designList
    .flatMap((d) => d.objectives.map((o) => ({ id: o.id, lessonId: d.lessonId })))
    .find((o) => conceptQuestions.filter((q) => q.objectiveId === o.id).length === 0);
  assert.ok(noQuestion, '题库里应存在由代码实战覆盖的目标');

  // 只写一份没有逐题明细的旧版概念卷,没有任何实操记录
  const onlyQuiz = student('S1', '1班', (d) => {
    d.concepts['quiz-01-environment'] = [attempt(T, 1)];
  });
  const r1 = buildClassReport([onlyQuiz], { now: T });
  const o1 = r1.objectives.find((o) => o.id === noQuestion.id)!;
  assert.equal(o1.attempted, 0, '没有实操证据就是无数据');
  assert.equal(o1.rate, null);
  assert.equal(o1.status, 'nodata');

  // 加上该课实操且通过 → 才有间接证据
  const withPractice = student('S1', '1班', (d) => {
    d.concepts['quiz-01-environment'] = [attempt(T, 1)];
    d.practice['ex-01-environment'] = [{ ...attempt(T, 0.9), passed: true, lessonId: '01-environment' }];
  });
  const r2 = buildClassReport([withPractice], { now: T });
  const o2 = r2.objectives.find((o) => o.id === noQuestion.id)!;
  assert.equal(o2.attempted, 1);
  assert.equal(o2.achieved, 1);
  assert.equal(o2.directCount, 0);
});

test('逐题明细优先:答错且有未消除错题时不算达成', () => {
  const q = conceptQuestions.find((x) => x.objectiveId);
  assert.ok(q);
  const wrong = student('S1', '1班', (d) => {
    d.concepts['quiz-01-environment'] = [
      { ...attempt(T, 0), answers: [{ qid: q.id, given: '0', correct: false, points: 0, maxPoints: 5 }] },
    ];
    d.mistakes[q.id] = {
      qid: q.id, lessonId: q.lessonId, wrongCount: 1,
      firstWrongAt: T, lastWrongAt: T, lastGiven: '0', misconception: q.misconception,
    };
  });
  const r = buildClassReport([wrong], { now: T });
  const o = r.objectives.find((x) => x.id === q.objectiveId)!;
  assert.equal(o.attempted, 1);
  assert.equal(o.directCount, 1);
  assert.equal(o.achieved, 0);
});

test('误区按学生去重:两人各错 3 次 = 2 人 / 6 次', () => {
  const mk = (id: string) =>
    student(id, '1班', (d) => {
      d.mistakes['q-01-1'] = {
        qid: 'q-01-1', lessonId: '01-environment', wrongCount: 3,
        firstWrongAt: T, lastWrongAt: T, lastGiven: '0',
        misconception: 'env-not-activated',
      };
    });
  const r = buildClassReport([mk('S1'), mk('S2')], { now: T });
  const m = r.misconceptions.find((x) => x.key === 'env-not-activated')!;
  assert.equal(m.students, 2);
  assert.equal(m.occurrences, 6);
  assert.equal(m.unresolved, 2);
  assert.equal(m.resolved, 0);
});

test('已消除的误区计入 resolved,未消除人次不被高估', () => {
  const r = buildClassReport([
    student('S1', '1班', (d) => {
      d.mistakes['q-01-1'] = {
        qid: 'q-01-1', lessonId: '01-environment', wrongCount: 1,
        firstWrongAt: T, lastWrongAt: T, lastGiven: '0',
        misconception: 'env-not-activated', resolvedAt: T + 1,
      };
    }),
  ], { now: T });
  const m = r.misconceptions.find((x) => x.key === 'env-not-activated')!;
  assert.equal(m.students, 1);
  assert.equal(m.resolved, 1);
  assert.equal(m.unresolved, 0);
});

test('班级筛选只影响统计,classes/byClass 仍返回全量', () => {
  const recs = demoRecords(T);
  const all = buildClassReport(recs, { now: T });
  const one = buildClassReport(recs, { classId: '1班', now: T });
  assert.equal(all.studentCount, 10);
  assert.equal(one.studentCount, 5);
  assert.equal(one.classId, '1班');
  assert.deepEqual(one.classes, ['1班', '2班']);
  assert.equal(one.byClass.length, 2);
});

test('教学决策有阈值:低达成率目标才触发重讲,且给出可跳转链接', () => {
  const r = buildClassReport(demoRecords(T), { now: T });
  assert.ok(r.decisions.length > 0);
  assert.ok(r.decisions.length <= 8);
  const reteach = r.decisions.filter((d) => d.kind === 'reteach');
  assert.ok(reteach.length > 0);
  assert.ok(reteach.every((d) => d.href?.startsWith('/tutorials/')));
  assert.ok(r.decisions.every((d) => d.detail.length > 20), '不能只给「加强练习」这类空话');
});

// ── 合并与去重回归 ──────────────────────────────────────────────

test('collapseByStudent:相同 sourceLabel 但学号不同不会被压成 1 人', () => {
  const recs = demoRecords(T);
  const out = collapseByStudent(recs);
  assert.equal(out.length, 10, '示例数据统一文案曾导致全班被去重成 1 人');
});

test('collapseByStudent:同一学号多份备份合并且保留全部作答', () => {
  const a = student('S1', '1班', (d) => { d.practice['x'] = [attempt(T, 0.5)]; });
  const b = student('S1', '1班', (d) => { d.practice['x'] = [attempt(T + 10, 1)]; });
  b.sourceLabel = 'S1-2.json';
  const out = collapseByStudent([a, b]);
  assert.equal(out.length, 1);
  assert.equal(countAttempts(out[0].data), 2);
});

// ── 导出 ────────────────────────────────────────────────────────

test('csvEscape 正确转义逗号、引号与换行', () => {
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('a"b'), '"a""b"');
  assert.equal(csvEscape('a\nb'), '"a\nb"');
  assert.equal(csvEscape(null), '');
});

test('CSV 带 BOM、含评价方式列,学生明细不含姓名', () => {
  const r = buildClassReport(demoRecords(T), { now: T });
  const oc = objectivesCsv(r);
  assert.ok(oc.startsWith('\ufeff'));
  assert.ok(oc.includes('评价方式'));
  assert.ok(oc.includes('代码实战'));
  assert.equal(oc.trim().split('\r\n').length, r.objectives.length + 1);
  const sc = studentsCsv(r);
  assert.ok(sc.includes('匿名学号'));
  assert.ok(!sc.includes('真实姓名'));
});

test('归档载荷只带聚合结果,不含原始作答文本', () => {
  const r = buildClassReport(demoRecords(T), { now: T });
  const payload = JSON.parse(archivePayload(r));
  assert.equal(payload.kind, 'class-report-snapshot');
  assert.equal(payload.studentCount, 10);
  assert.ok(!JSON.stringify(payload).includes('answers'));
  assert.ok(!JSON.stringify(payload).includes('profile'));
});
