// 错题本客户端:聚合、排序、就地重练
//
// 教学逻辑(为什么这么排):
//   1. 先按误区类别聚合 —— 同一标签下堆积多题,说明是概念裂缝而不是粗心。
//   2. 排序用 reviewPriority(错误次数 × 间隔天数),而不是时间倒序。
//   3. 重练只针对单题,答对即消除,给即时正反馈。

import { store } from '../lib/store';
import { conceptQuestions, misconceptionLabel } from '../data/questions';
import { lessons } from '../data/course';
import { reviewPriority, optionDiagnosis } from '../lib/scoring';
import type { ConceptQuestion } from '../data/questions';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function lessonTitle(id: string): string {
  return lessons.find((l) => l.id === id)?.title ?? id;
}

function byId(id: string): ConceptQuestion | undefined {
  return conceptQuestions.find((q) => q.id === id);
}

let activeTag = '';

function renderStats(open: ReturnType<typeof store.getOpenMistakes>) {
  const lessonSet = new Set(open.map((m) => m.lessonId));
  const tagSet = new Set(open.map((m) => m.misconception ?? 'none'));
  const totalWrong = open.reduce((s, m) => s + m.wrongCount, 0);

  el('stat-open').textContent = String(open.length);
  el('stat-lessons').textContent = String(lessonSet.size);
  el('stat-tags').textContent = String(tagSet.size);
  el('stat-total').textContent = String(totalWrong);
  el('mistake-empty').hidden = open.length > 0;
}

function renderTagCloud(open: ReturnType<typeof store.getOpenMistakes>) {
  const wrap = el('tag-cloud');
  wrap.innerHTML = '';
  const counts = new Map<string, number>();
  for (const m of open) {
    const key = m.misconception ?? 'none';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) {
    wrap.innerHTML = '<p class="report-empty-text">暂无误区数据。</p>';
    return;
  }

  const all = document.createElement('button');
  all.type = 'button';
  all.className = `tag-chip${activeTag === '' ? ' active' : ''}`;
  all.textContent = `全部(${open.length})`;
  all.addEventListener('click', () => {
    activeTag = '';
    render();
  });
  wrap.appendChild(all);

  for (const [key, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tag-chip${activeTag === key ? ' active' : ''}`;
    btn.textContent = `${misconceptionLabel(key === 'none' ? undefined : key)}(${n})`;
    btn.addEventListener('click', () => {
      activeTag = activeTag === key ? '' : key;
      render();
    });
    wrap.appendChild(btn);
  }
}

function retryPanel(q: ConceptQuestion, onSolved: () => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'retry-box';

  const tip = document.createElement('p');
  tip.className = 'retry-tip';
  tip.textContent = '不看解析,先自己再选一次:';
  box.appendChild(tip);

  const opts = document.createElement('div');
  opts.className = 'retry-opts';

  const feedback = document.createElement('p');
  feedback.className = 'retry-feedback';
  feedback.setAttribute('role', 'status');

  (q.options ?? []).forEach((opt, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'retry-opt';
    b.innerHTML = `<span class="retry-mark">${String.fromCharCode(65 + i)}</span><span>${opt}</span>`;
    b.addEventListener('click', () => {
      const correct = String(i) === q.answer[0];
      if (correct) {
        feedback.className = 'retry-feedback ok';
        feedback.textContent = '✔ 对了。这道题已从错题本移除。';
        opts.querySelectorAll('button').forEach((x) => {
          (x as HTMLButtonElement).disabled = true;
        });
        // 先让学生看到正反馈,再落库触发重渲染
        window.setTimeout(() => {
          store.recordConceptOutcome(q.lessonId, [
            { qid: q.id, correct: true, given: String(i) },
          ]);
          onSolved();
        }, 750);
      } else {
        store.recordConceptOutcome(q.lessonId, [
          { qid: q.id, correct: false, given: String(i), misconception: q.misconception },
        ]);
        feedback.className = 'retry-feedback bad';
        feedback.textContent = `✘ ${optionDiagnosis(q, String(i)) ?? '再看一眼题干里的关键词。'}`;
        b.classList.add('wrong');
      }
    });
    opts.appendChild(b);
  });

  box.appendChild(opts);
  box.appendChild(feedback);
  return box;
}

function renderList(open: ReturnType<typeof store.getOpenMistakes>) {
  const wrap = el('mistake-list');
  wrap.innerHTML = '';

  const filtered = open.filter((m) => {
    if (!activeTag) return true;
    return (m.misconception ?? 'none') === activeTag;
  });

  if (filtered.length === 0) {
    wrap.innerHTML = '<p class="report-empty-text">该类别下没有待消除的错题。</p>';
    return;
  }

  const now = Date.now();
  const sorted = [...filtered].sort(
    (a, b) =>
      reviewPriority(b.wrongCount, b.lastWrongAt, now) -
      reviewPriority(a.wrongCount, a.lastWrongAt, now),
  );

  for (const m of sorted) {
    const q = byId(m.qid);
    const card = document.createElement('div');
    card.className = 'mistake-card';

    const head = document.createElement('div');
    head.className = 'mistake-head';
    const tag = document.createElement('span');
    tag.className = 'tag-chip static';
    tag.textContent = misconceptionLabel(m.misconception);
    head.appendChild(tag);

    const meta = document.createElement('span');
    meta.className = 'mistake-meta';
    meta.textContent = `${lessonTitle(m.lessonId)} · 错 ${m.wrongCount} 次 · 最近 ${new Date(
      m.lastWrongAt,
    ).toLocaleDateString('zh-CN')}`;
    head.appendChild(meta);
    card.appendChild(head);

    const prompt = document.createElement('p');
    prompt.className = 'mistake-prompt';
    prompt.innerHTML = q ? q.prompt : `(${m.qid})`;
    card.appendChild(prompt);

    const actions = document.createElement('div');
    actions.className = 'mistake-actions';
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn sm primary';
    retryBtn.textContent = '就地重练';
    const backLink = document.createElement('a');
    backLink.className = 'btn sm';
    backLink.href = `/tutorials/${m.lessonId}/`;
    backLink.textContent = '回看本课';

    const holder = document.createElement('div');
    holder.className = 'retry-holder';

    retryBtn.addEventListener('click', () => {
      if (!q) return;
      holder.innerHTML = '';
      holder.appendChild(retryPanel(q, () => render()));
      retryBtn.disabled = true;
    });

    actions.appendChild(retryBtn);
    actions.appendChild(backLink);
    card.appendChild(actions);
    card.appendChild(holder);
    wrap.appendChild(card);
  }
}

function render() {
  const open = store.getOpenMistakes();
  renderStats(open);
  renderTagCloud(open);
  renderList(open);
}

render();
store.subscribe(render);
