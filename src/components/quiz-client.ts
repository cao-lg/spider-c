// 概念题判分与诊断反馈
//
// 职责划分:
//   组件(Quiz.astro)负责"呈现",本文件负责"判定 + 诊断 + 留痕"。
//   诊断文本来自每个选项的 data-fb —— 学生看到的是"你为什么错",而不是"答案是 B"。
//
// 留痕策略:
//   一次提交 = 一条 Attempt(ratio 用于掌握度滑动平均);
//   同时把答错的题写入错题本,答对的题标记为已消除。

import { answersMatch, buildAttempt, pct } from '../lib/scoring';
import { store } from '../lib/store';

interface QState {
  el: HTMLFieldSetElement;
  id: string;
  type: string;
  points: number;
  answers: string[];
  lessonId: string;
  misconception: string;
  explanation: string;
  anchor: string;
  skills: string[];
}

function readQuestions(root: HTMLElement): QState[] {
  return Array.from(root.querySelectorAll<HTMLFieldSetElement>('.quiz-q')).map((el) => {
    let answers: string[] = [];
    try {
      const parsed = JSON.parse(el.dataset.answers ?? '[]');
      if (Array.isArray(parsed)) answers = parsed.map(String);
    } catch {
      answers = [];
    }
    return {
      el,
      id: el.dataset.qid ?? '',
      type: el.dataset.type ?? 'choice',
      points: Number(el.dataset.points ?? 0),
      answers,
      lessonId: el.dataset.lesson ?? '',
      misconception: el.dataset.misconception ?? '',
      explanation: el.dataset.expl ?? '',
      anchor: el.dataset.anchor ?? '',
      skills: (el.dataset.skills ?? '').split(',').filter(Boolean),
    };
  });
}

function givenValue(q: QState): string {
  if (q.type === 'fill') {
    const input = q.el.querySelector<HTMLInputElement>('.quiz-fill input');
    return input?.value ?? '';
  }
  const checked = q.el.querySelector<HTMLInputElement>('input[type="radio"]:checked');
  return checked?.value ?? '';
}

function isCorrect(q: QState, given: string): boolean {
  if (!given) return false;
  if (q.type === 'choice') return q.answers[0] === given;
  return answersMatch(given, q.answers);
}

/** 取所选选项上的诊断文本(仅单选/判断题有) */
function pickedFeedback(q: QState, given: string): string {
  if (q.type !== 'choice') return '';
  const label = q.el.querySelector<HTMLElement>(`.quiz-opt[data-opt="${given}"]`);
  return label?.dataset.fb?.trim() ?? '';
}

/** 从 DOM 里取正确选项的可见文本(选项内容只在服务端渲染的 HTML 里) */function correctText(q: QState): string {
  if (q.type === 'choice') {
    const label = q.el.querySelector<HTMLElement>(`.quiz-opt[data-opt="${q.answers[0]}"] .quiz-opt-text`);
    return label?.textContent?.trim() || '—';
  }
  if (q.type === 'truefalse') {
    return q.answers[0] === 'T' ? '正确' : '错误';
  }
  return q.answers[0] ?? '—';
}

function renderFeedback(q: QState, given: string, correct: boolean) {
  const box = q.el.querySelector<HTMLElement>('[data-quiz-fb]');
  if (!box) return;
  box.hidden = false;
  box.className = `quiz-fb ${correct ? 'ok' : 'bad'}`;
  box.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'quiz-fb-head';
  head.textContent = correct ? '✔ 正确' : '✘ 再想想';
  box.appendChild(head);

  if (!correct) {
    const picked = pickedFeedback(q, given);
    if (picked) {
      const diag = document.createElement('p');
      diag.className = 'quiz-fb-diag';
      diag.innerHTML = `<strong>诊断:</strong>${picked}`;
      box.appendChild(diag);
    } else if (!given) {
      const skip = document.createElement('p');
      skip.className = 'quiz-fb-diag';
      skip.textContent = '还没有作答。先凭理解选一个,错了比空着更有价值。';
      box.appendChild(skip);
    }

    const ans = document.createElement('p');
    ans.className = 'quiz-fb-answer';
    ans.textContent = `正确答案:${correctText(q)}`;
    box.appendChild(ans);
  }

  if (q.explanation) {
    const ex = document.createElement('p');
    ex.className = 'quiz-fb-expl';
    ex.innerHTML = `<strong>解析:</strong>${q.explanation}`;
    box.appendChild(ex);
  }

  if (!correct && q.anchor) {
    const a = document.createElement('p');
    a.className = 'quiz-fb-anchor';
    a.textContent = `↩ 回看本课「${q.anchor}」`;
    box.appendChild(a);
  }
}

function updateProgress(root: HTMLElement, states: QState[], correctIds: Set<string>) {
  const badge = root.querySelector<HTMLElement>('[data-quiz-progress]');
  if (badge) {
    badge.textContent = `${correctIds.size} / ${states.length} 已答对`;
  }
}

function clearFeedback(q: QState) {
  const box = q.el.querySelector<HTMLElement>('[data-quiz-fb]');
  if (box) {
    box.hidden = true;
    box.innerHTML = '';
  }
  q.el.classList.remove('is-correct', 'is-wrong');
  q.el.querySelectorAll('.quiz-opt').forEach((l) => l.classList.remove('picked', 'is-answer'));
}

function initQuiz(root: HTMLElement) {
  const quizId = root.dataset.quizId ?? 'quiz';
  const states = readQuestions(root);
  const form = root.querySelector<HTMLFormElement>('[data-quiz-form]');
  const summary = root.querySelector<HTMLElement>('[data-quiz-summary]');
  const submitBtn = root.querySelector<HTMLButtonElement>('[data-quiz-submit]');
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-quiz-reset]');
  /** 已答对的题(重做单题后仍保留,用于进度显示) */
  const correctIds = new Set<string>();

  updateProgress(root, states, correctIds);

  // 选中态:单选变化时高亮
  root.addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    if (!input || input.type !== 'radio') return;
    const fieldset = input.closest('.quiz-q');
    fieldset?.querySelectorAll('.quiz-opt').forEach((l) => l.classList.remove('picked'));
    input.closest('.quiz-opt')?.classList.add('picked');
  });

  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    let score = 0;
    const maxScore = states.reduce((s, q) => s + q.points, 0);
    const outcomes: { qid: string; correct: boolean; given: string; misconception?: string }[] = [];

    for (const q of states) {
      const given = givenValue(q);
      const ok = isCorrect(q, given);
      if (ok) score += q.points;
      q.el.classList.toggle('is-correct', ok);
      q.el.classList.toggle('is-wrong', !ok);
      if (ok) correctIds.add(q.id);
      else correctIds.delete(q.id);

      // 标出正确选项,便于对照
      q.el.querySelectorAll<HTMLElement>('.quiz-opt').forEach((l) => {
        const val = l.dataset.opt ?? '';
        const isAns = q.type === 'choice' ? val === q.answers[0] : q.answers.includes(val);
        l.classList.toggle('is-answer', isAns);
      });

      renderFeedback(q, given, ok);
      // 未作答不算"错题":空着不等于有错误认知,不该污染错题本
      if (given) {
        outcomes.push({
          qid: q.id,
          correct: ok,
          given,
          misconception: ok ? undefined : q.misconception || undefined,
        });
      }
    }

    updateProgress(root, states, correctIds);

    const ratio = maxScore > 0 ? score / maxScore : 0;
    const attempt = buildAttempt(score, maxScore, {
      skills: [...new Set(states.flatMap((q) => q.skills))],
      lessonId: states.length > 0 && states.every((q) => q.lessonId === states[0].lessonId)
        ? states[0].lessonId
        : undefined,
    });
    store.recordAttempt('concept', quizId, attempt, attempt.skills ?? []);

    // 错题本按"题"留痕,课程归属取题目自身的 lessonId
    for (const q of states) {
      const o = outcomes.find((x) => x.qid === q.id);
      if (!o) continue;
      store.recordConceptOutcome(q.lessonId, [o]);
    }

    if (summary) {
      const level = ratio >= 0.9 ? '很稳' : ratio >= 0.65 ? '基本掌握' : '需要回看';
      summary.textContent = `本次 ${score} / ${maxScore} 分(${pct(score, maxScore)}%)· ${level}`;
      summary.hidden = false;
    }
    if (submitBtn) submitBtn.textContent = '再次提交';

    const firstWrong = root.querySelector<HTMLElement>('.quiz-q.is-wrong');
    if (firstWrong) firstWrong.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  resetBtn?.addEventListener('click', () => {
    for (const q of states) {
      clearFeedback(q);
      q.el.querySelectorAll<HTMLInputElement>('input').forEach((i) => {
        if (i.type === 'radio') i.checked = false;
        else i.value = '';
      });
    }
    correctIds.clear();
    updateProgress(root, states, correctIds);
    if (summary) {
      summary.textContent = '';
      summary.hidden = true;
    }
    if (submitBtn) submitBtn.textContent = '提交作答';
  });
}

for (const root of Array.from(document.querySelectorAll<HTMLElement>('[data-quiz]'))) {
  initQuiz(root);
}
