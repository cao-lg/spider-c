// 学习系统共享类型定义

export type QuestionType = 'choice' | 'truefalse' | 'fill';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  /** 单选题选项(choice 必填) */
  options?: string[];
  /** 正确答案: choice -> 选项索引,truefalse -> ['T']|['F'],fill -> 可接受答案列表 */
  answer: string[];
  points: number;
  explanation?: string;
  skills?: string[];
}

export interface QuestionAnswer {
  qid: string;
  given: string;
  correct: boolean;
  points: number;
  maxPoints: number;
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
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface LessonProgress {
  status: LessonStatus;
  lastVisitedAt?: number;
  completedAt?: number;
  /** 0-1,由练习得分加权得出 */
  mastery: number;
}

export interface LearningData {
  schemaVersion: 1;
  profile: {
    name?: string;
    createdAt: number;
  };
  lessons: Record<string, LessonProgress>;
  /** key: exercise id */
  exercises: Record<string, Attempt[]>;
  /** key: unit test id */
  unitTests: Record<string, Attempt[]>;
  /** key: practice exercise id */
  practice: Record<string, Attempt[]>;
}

export type RecordKind = 'exercise' | 'unitTest' | 'practice';

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
