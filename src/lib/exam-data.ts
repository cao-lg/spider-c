/**
 * 考试试卷生成(教师端组卷时一次性执行)。
 *
 * 与形成性诊断题的区别:试卷是**题目快照**,写进 exams.paper 后不再引用可变题库;
 * 正确答案单独写进 exam_keys(仅教师可读),学生端拿到的 paper 里绝不出现答案/解析。
 * 只选 choice / truefalse 客观题,避免开放式答案的归一化争议。
 */
import { conceptQuestions } from '../data/questions';
import { units } from '../data/course';

export interface ExamQuestion {
  id: string;
  type: 'choice' | 'truefalse';
  prompt: string;
  options?: string[];
  points: number;
}

export interface ObjectiveRule {
  answer: string[];
  points: number;
}

export interface BuiltPaper {
  paper: ExamQuestion[];
  objective: Record<string, ObjectiveRule>;
  total: number;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function unitOptions(): { id: string; label: string }[] {
  return [
    { id: '', label: '全部单元' },
    ...units.map((u) => ({ id: u.id, label: `单元${u.number} · ${u.title}` })),
  ];
}

/** 从课程概念题库抽题,返回可直接写入 exams.paper / exam_keys.objective 的两份数据。 */
export function buildPaper(unitId: string, count: number, pointsPerQuestion: number): BuiltPaper {
  const pool = conceptQuestions.filter(
    (q) => (q.type === 'choice' || q.type === 'truefalse') && (!unitId || q.unitId === unitId),
  );
  const picked = shuffle(pool).slice(0, Math.max(1, Math.min(count, pool.length)));

  const paper: ExamQuestion[] = picked.map((q) => ({
    id: q.id,
    type: q.type as 'choice' | 'truefalse',
    prompt: q.prompt,
    ...(q.options ? { options: q.options } : {}),
    points: pointsPerQuestion,
  }));

  const objective: Record<string, ObjectiveRule> = {};
  for (const q of picked) objective[q.id] = { answer: [...q.answer], points: pointsPerQuestion };

  return { paper, objective, total: paper.length * pointsPerQuestion };
}

/** 渲染题目选项:题干来自课程题库,含少量 <code> 标签,按站点既有方式插入。 */
export function trueFalseOptions(): string[] {
  return ['正确', '错误'];
}

export function answerValuesFor(type: ExamQuestion['type'], questionId: string, form: HTMLFormElement): string[] {
  if (type === 'truefalse') {
    const checked = form.querySelector<HTMLInputElement>(`input[name="${questionId}"]:checked`);
    return checked ? [checked.value] : [];
  }
  return Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${questionId}"]:checked`)).map((n) => n.value);
}
