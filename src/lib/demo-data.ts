// 教师端「载入示例班级」用的合成数据。
// 目的:让教师在还没收到任何学生备份时,就能先看清报告长什么样、字段够不够用。
// 数据全部由真实题库 id 生成,不会随题目改名而失效;绝不写入 localStorage。

import type { LearningData, MistakeRecord, QuestionAnswer } from './types.ts';
import { defaultData } from './schema.ts';
import { lessons } from '../data/course.ts';
import { conceptQuestions, lessonQuizId } from '../data/questions.ts';
import { lessonTasks } from '../data/tasks.ts';
import {
  DEFAULT_CLASS_A,
  DEFAULT_CLASS_B,
  type StudentRecord,
} from './class-report.ts';

interface Spec {
  studentId: string;
  classId: string;
  /** 已完成课程数 */
  completed: number;
  /** 概念题正确率 0-1 */
  accuracy: number;
  /** 命中的误区标签(未消除) */
  openMisconceptions: string[];
  /** 已通过重练消除的误区标签 */
  resolvedMisconceptions?: string[];
  /** 掌握度整体系数 */
  mastery: number;
}

const SPECS: Spec[] = [
  { studentId: 'S01', classId: DEFAULT_CLASS_A, completed: 12, accuracy: 0.95, openMisconceptions: [], mastery: 0.92 },
  { studentId: 'S02', classId: DEFAULT_CLASS_A, completed: 10, accuracy: 0.82, openMisconceptions: ['status-code-confusion'], resolvedMisconceptions: ['no-timeout'], mastery: 0.8 },
  { studentId: 'S03', classId: DEFAULT_CLASS_A, completed: 8, accuracy: 0.68, openMisconceptions: ['status-code-confusion', 'no-timeout'], mastery: 0.67 },
  { studentId: 'S04', classId: DEFAULT_CLASS_A, completed: 5, accuracy: 0.52, openMisconceptions: ['status-code-confusion', 'css-combinator', 'encoding-guess'], mastery: 0.5 },
  { studentId: 'S05', classId: DEFAULT_CLASS_A, completed: 2, accuracy: 0.4, openMisconceptions: ['status-code-confusion', 'no-timeout'], mastery: 0.35 },
  { studentId: 'S06', classId: DEFAULT_CLASS_B, completed: 11, accuracy: 0.9, openMisconceptions: [], resolvedMisconceptions: ['xpath-return-list'], mastery: 0.88 },
  { studentId: 'S07', classId: DEFAULT_CLASS_B, completed: 9, accuracy: 0.78, openMisconceptions: ['xpath-return-list', 'no-timeout'], mastery: 0.75 },
  { studentId: 'S08', classId: DEFAULT_CLASS_B, completed: 7, accuracy: 0.63, openMisconceptions: ['xpath-return-list', 'json-vs-text'], mastery: 0.62 },
  { studentId: 'S09', classId: DEFAULT_CLASS_B, completed: 4, accuracy: 0.48, openMisconceptions: ['xpath-return-list', 'json-vs-text', 'no-timeout'], mastery: 0.45 },
  { studentId: 'S10', classId: DEFAULT_CLASS_B, completed: 1, accuracy: 0.3, openMisconceptions: ['status-code-confusion', 'xpath-return-list'], mastery: 0.25 },
];

function demoLearningData(spec: Spec, now: number, index: number): LearningData {
  const d = defaultData();
  d.profile = { name: spec.studentId, createdAt: now - (20 - index) * 86400000 };
  d.roster = { studentId: spec.studentId, classId: spec.classId };

  lessons.slice(0, spec.completed).forEach((l, i) => {
    d.lessons[l.id] = {
      status: 'completed',
      mastery: Math.max(0.1, Math.min(1, spec.mastery + (i % 3) * 0.04 - 0.04)),
      lastVisitedAt: now - (spec.completed - i) * 86400000,
      completedAt: now - (spec.completed - i) * 86400000,
    };
  });

  // 每门已学课写一次概念卷,逐题明细用真实题号
  lessons.slice(0, spec.completed).forEach((l, i) => {
    const qs = conceptQuestions.filter((q) => q.lessonId === l.id);
    if (qs.length === 0) return;
    const answers: QuestionAnswer[] = qs.map((q, qi) => ({
      qid: q.id,
      given: q.answer[0] ?? '',
      correct: (qi + i + index) % 10 < Math.round(spec.accuracy * 10),
      points: q.points,
      maxPoints: q.points,
    }));
    const score = answers.filter((a) => a.correct).reduce((s, a) => s + a.points, 0);
    const maxScore = answers.reduce((s, a) => s + a.maxPoints, 0);
    d.concepts[lessonQuizId(l.id)] = [
      {
        ts: now - (spec.completed - i) * 86400000,
        score,
        maxScore,
        ratio: maxScore ? score / maxScore : 0,
        answers,
        skills: [...new Set(qs.flatMap((q) => q.skills))],
        lessonId: l.id,
      },
    ];
    d.practice[lessonTasks[l.id]?.id ?? `ex-${l.id}`] = [
      {
        ts: now - (spec.completed - i) * 86400000 + 1000,
        score: Math.round(spec.mastery * 10),
        maxScore: 10,
        ratio: spec.mastery,
        passed: spec.mastery >= 0.6,
        skills: l.skills,
        lessonId: l.id,
      },
    ];
  });

  const addMistake = (key: string, resolved: boolean, seq: number) => {
    const q = conceptQuestions.find((x) => x.misconception === key) ?? conceptQuestions[seq % conceptQuestions.length];
    const rec: MistakeRecord = {
      qid: q.id,
      lessonId: q.lessonId,
      wrongCount: 1 + (seq % 3),
      firstWrongAt: now - (6 + seq) * 86400000,
      lastWrongAt: now - (2 + seq) * 86400000,
      lastGiven: '0',
      misconception: key,
      ...(resolved ? { resolvedAt: now - 86400000 } : {}),
    };
    d.mistakes[q.id] = rec;
  };
  spec.openMisconceptions.forEach((k, i) => addMistake(k, false, i + index));
  (spec.resolvedMisconceptions ?? []).forEach((k, i) => addMistake(k, true, i + index + 7));

  return d;
}

/** 10 名示例学生 / 2 个班,数据不落盘,刷新页面即消失 */
export function demoRecords(now = Date.now()): StudentRecord[] {
  return SPECS.map((spec, i) => ({
    studentId: spec.studentId,
    classId: spec.classId,
    sourceLabel: '示例数据(不写入本机)',
    source: 'demo' as const,
    syncedAt: now - i * 3600000,
    data: demoLearningData(spec, now, i),
  }));
}
