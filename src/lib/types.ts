// 学习系统共享类型定义

export type QuestionType = 'choice' | 'truefalse' | 'fill';
export type RunnerVariant = 'showcase' | 'guided' | 'challenge';

/** 认知层级(简化版 Bloom,用于目标与题目的对齐校验) */
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze';

export const BLOOM_LABEL: Record<BloomLevel, string> = {
  remember: '记忆',
  understand: '理解',
  apply: '应用',
  analyze: '分析',
};

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  /** 单选题选项(choice 必填) */
  options?: string[];
  /** 正确答案: choice -> 选项索引(字符串),truefalse -> ['T']|['F'],fill -> 可接受答案列表 */
  answer: string[];
  points: number;
  explanation?: string;
  skills?: string[];
  /** 选项级诊断反馈,长度与 options 一致;学生选错时给出"为什么错"而不是只报答案 */
  optionFeedback?: string[];
  /** 该题对应的课程目标 id(见 data/design.ts) */
  objectiveId?: string;
  /** 错误归因标签,用于错题本聚合与教师端误区统计 */
  misconception?: string;
  /** 课内锚点:答案依据出现在正文哪一节 */
  anchor?: string;
  /** 认知层级,用于目标—评价一致性校验 */
  level?: BloomLevel;
  /** 所属课程(概念题按课归属,单元概念卷由此聚合) */
  lessonId?: string;
}

export interface QuestionAnswer {
  qid: string;
  given: string;
  correct: boolean;
  points: number;
  maxPoints: number;
}

/** 单题的错误留痕,用于错题本 */
export interface MistakeRecord {
  qid: string;
  lessonId: string;
  wrongCount: number;
  firstWrongAt: number;
  lastWrongAt: number;
  /** 最近一次的错误选项 / 输入 */
  lastGiven: string;
  /** 最近一次命中的误区标签 */
  misconception?: string;
  /** 重练答对的时间(存在即视为已消除) */
  resolvedAt?: number;
}

export interface Attempt {
  ts: number;
  score: number;
  maxScore: number;
  /** 正确率 0-1(用于掌握度计算) */
  ratio: number;
  answers?: QuestionAnswer[];
  durationSec?: number;
  /** 代码练习是否通过 */
  passed?: boolean;
  /** 关联的技能维度(用于掌握度雷达) */
  skills?: string[];
  /** 关联的课程(概念题作答时写入,便于按课归因) */
  lessonId?: string;
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface LessonProgress {
  status: LessonStatus;
  lastVisitedAt?: number;
  completedAt?: number;
  /** 0-1,由练习得分加权得出 */
  mastery: number;
}

/**
 * 班级花名册元数据(可选)。
 * 默认导出备份不带这些字段 —— 离线汇总时由教师在页面上手工填写;
 * 只有开启阶段 1 云同步后才写入,这样"不开通云端"的学生完全不受影响。
 * 只用匿名学号与班级代号,不收真实姓名/手机号。
 */
export interface RosterMeta {
  studentId?: string;
  classId?: string;
}

export interface LearningData {
  schemaVersion: 2;
  profile: {
    name?: string;
    createdAt: number;
  };
  roster?: RosterMeta;
  lessons: Record<string, LessonProgress>;
  /** key: exercise id */
  exercises: Record<string, Attempt[]>;
  /** key: unit test id */
  unitTests: Record<string, Attempt[]>;
  /** key: practice exercise id */
  practice: Record<string, Attempt[]>;
  /** 概念题作答,key: 题组 id(如 quiz-03-requests-basics / quiz-unit-1) */
  concepts: Record<string, Attempt[]>;
  /** 错题本,key: question id */
  mistakes: Record<string, MistakeRecord>;
}

export type RecordKind = 'exercise' | 'unitTest' | 'practice' | 'concept';

export interface GradeLevel {
  letter: string;
  label: string;
  min: number;
}

export const GRADE_LEVELS: GradeLevel[] = [
  { letter: 'A', label: '优秀', min: 90 },
  { letter: 'B', label: '良好', min: 80 },
  { letter: 'C', label: '中等', min: 65 },
  { letter: 'D', label: '待加强', min: 0 },
];

export function gradeLevel(pct: number): GradeLevel {
  const p = Math.round(pct);
  for (const lv of GRADE_LEVELS) {
    if (p >= lv.min) return lv;
  }
  return GRADE_LEVELS[GRADE_LEVELS.length - 1];
}
