// 学习中心客户端逻辑:汇总 store 数据并渲染统计、进度、图表与数据管理

import { store } from '../lib/store';
import { units, lessons, unitTests, skillDomains, totalLessons } from '../data/course';
import { pct as pctOf } from '../lib/scoring';
import { gradeLevel } from '../lib/types';
import type { Attempt, LearningData, RecordKind } from '../lib/types';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function allAttempts(d: LearningData): { kind: RecordKind; id: string; attempt: Attempt }[] {
  const out: { kind: RecordKind; id: string; attempt: Attempt }[] = [];
  const maps: Record<RecordKind, Record<string, Attempt[]>> = {
    exercise: d.exercises,
    practice: d.practice,
    unitTest: d.unitTests,
  };
  for (const kind of Object.keys(maps) as RecordKind[]) {
    for (const [id, list] of Object.entries(maps[kind] ?? {})) {
      for (const attempt of list ?? []) out.push({ kind, id, attempt });
    }
  }
  return out;
}

function resolveTitle(kind: RecordKind, id: string): string {
  if (kind === 'unitTest') {
    const t = unitTests.find((x) => id === x.id || id.startsWith(x.id + '-'));
    if (t) {
      const suffix = id.replace(t.id + '-', '');
      return suffix ? `${t.title} · 实操${suffix.replace(/^t/, '#')}` : t.title;
    }
    return id;
  }
  if (kind === 'exercise') {
    const slug = id.replace(/^quiz-/, '');
    const lesson = lessons.find((l) => l.id === slug);
    if (lesson) return `${lesson.title} · 小测`;
  }
  if (kind === 'practice') {
    for (const lesson of lessons) {
      const prefix = `ex-${lesson.order.toString().padStart(2, '0')}`;
      if (id.startsWith(prefix)) return `${lesson.title} · 代码实战`;
    }
  }
  return id;
}

function skillValues(d: LearningData): number[] {
  return skillDomains.map((skill) => {
    const ls = lessons.filter((l) => (l.skills ?? []).includes(skill));
    if (ls.length === 0) return 0;
    return Math.max(...ls.map((l) => d.lessons[l.id]?.mastery ?? 0));
  });
}

function renderProfile(d: LearningData) {
  const input = el<HTMLInputElement>('profile-name');
  input.value = d.profile.name ?? '';
  el('profile-save').addEventListener('click', () => {
    store.setProfile(input.value.trim());
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      store.setProfile(input.value.trim());
      input.blur();
    }
  });
}

function renderStats(d: LearningData) {
  const completed = lessons.filter((l) => d.lessons[l.id]?.status === 'completed').length;
  const attempts = allAttempts(d);
  const ratios = attempts.map((a) => a.attempt.ratio ?? 0);
  const avg = ratios.length ? Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100) : 0;

  let unitBestSum = 0;
  let unitBestN = 0;
  for (const t of unitTests) {
    const lists: Attempt[][] = [];
    for (const [key, list] of Object.entries(d.unitTests ?? {})) {
      if (key === t.id || key.startsWith(t.id + '-')) lists.push(list);
    }
    const all = lists.flat();
    if (all.length === 0) continue;
    const best = [...all].sort((a, b) => b.ratio - a.ratio)[0];
    unitBestSum += best.ratio ?? 0;
    unitBestN += 1;
  }
  const unitBest = unitBestN ? Math.round((unitBestSum / unitBestN) * 100) : 0;

  el('stat-lessons').textContent = `${completed} / ${totalLessons}`;
  el('stat-attempts').textContent = String(attempts.length);
  el('stat-avg').textContent = `${avg}%`;
  el('stat-unit').textContent = unitBestN ? `${unitBest}%` : '—';

  const empty = attempts.length === 0 && completed === 0;
  el('report-empty').hidden = !empty;
}

function renderUnitProgress(d: LearningData) {
  const wrap = el('unit-progress');
  wrap.innerHTML = '';
  for (const unit of units) {
    const ls = lessons.filter((l) => l.unitId === unit.id);
    const done = ls.filter((l) => d.lessons[l.id]?.status === 'completed').length;
    const ratio = ls.length ? done / ls.length : 0;

    const card = document.createElement('div');
    card.className = 'report-card unit-progress';

    const head = document.createElement('div');
    head.className = 'unit-progress-head';
    const title = document.createElement('span');
    title.className = 'unit-progress-title';
    title.textContent = `单元 ${unit.number} · ${unit.title}`;
    head.appendChild(title);
    const num = document.createElement('span');
    num.className = 'unit-progress-num';
    num.textContent = `${done} / ${ls.length} 课`;
    head.appendChild(num);
    card.appendChild(head);

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${Math.round(ratio * 100)}%`;
    track.appendChild(fill);
    card.appendChild(track);

    const chips = document.createElement('div');
    chips.className = 'lesson-chips';
    for (const l of ls) {
      const chip = document.createElement('a');
      const p = d.lessons[l.id];
      const status = p?.status ?? 'not_started';
      chip.className = `lesson-chip status-${status}`;
      chip.href = `/tutorials/${l.slug}/`;
      chip.textContent = `${l.order}. ${l.title}`;
      chip.title = status === 'completed' ? '已完成' : status === 'in_progress' ? '学习中' : '未开始';
      chips.appendChild(chip);
    }
    card.appendChild(chips);
    wrap.appendChild(card);
  }
}

function renderRadar(d: LearningData) {
  const values = skillValues(d);
  const cx = 180;
  const cy = 150;
  const R = 105;
  const n = skillDomains.length;
  const pt = (i: number, v: number) => {
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    const r = R * v;
    return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  };

  let svg = `<svg viewBox="0 0 360 300" role="img" aria-label="技能掌握度雷达图">`;
  // 背景同心环
  for (const frac of [0.25, 0.5, 0.75, 1]) {
    const pts = skillDomains.map((_, i) => pt(i, frac));
    svg += `<polygon points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="var(--border)" stroke-width="1"${frac === 1 ? ' stroke-dasharray="none"' : ''}/>`;
  }
  // 轴线 + 标签
  for (let i = 0; i < n; i++) {
    const outer = pt(i, 1);
    const label = pt(i, 1.28);
    svg += `<line x1="${cx}" y1="${cy}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
    svg += `<text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="var(--text-2)">${esc(skillDomains[i])}</text>`;
  }
  // 数据多边形
  const hasData = values.some((v) => v > 0.01);
  if (hasData) {
    const dataPts = values.map((v, i) => pt(i, Math.min(1, Math.max(0, v))));
    svg += `<polygon points="${dataPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="var(--primary)" fill-opacity="0.22" stroke="var(--primary)" stroke-width="2"/>`;
    for (const p of dataPts) {
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--primary)"/>`;
    }
  } else {
    svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="var(--text-3)">暂无数据</text>`;
  }
  svg += '</svg>';
  el('radar-chart').innerHTML = svg;
  el('radar-hint').textContent = hasData
    ? '掌握度由各课程练习得分加权得出(指数滑动平均)。'
    : '完成课程练习后,这里会绘制你的技能分布。';
}

function renderTrend(d: LearningData) {
  const pts = allAttempts(d)
    .map((x) => x.attempt)
    .sort((a, b) => a.ts - b.ts);
  const wrap = el('trend-chart');
  if (pts.length === 0) {
    wrap.innerHTML = `<p class="report-empty-text">完成作答后,这里会展示得分率随时间的变化曲线。</p>`;
    return;
  }

  const W = 560;
  const H = 210;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, pts.length - 1);
  const y = (r: number) => padT + (1 - r) * (H - padT - padB);

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="成绩趋势图">`;
  for (const frac of [0, 0.5, 1]) {
    const yy = y(frac);
    svg += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--border)" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--text-3)">${Math.round(frac * 100)}%</text>`;
  }
  // 折线
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.ratio ?? 0).toFixed(1)}`).join(' ');
  svg += `<polyline points="${line}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  // 数据点 + 日期标签
  const step = Math.max(1, Math.ceil(pts.length / 8));
  pts.forEach((p, i) => {
    svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.ratio ?? 0).toFixed(1)}" r="3" fill="var(--surface)" stroke="var(--primary)" stroke-width="2"/>`;
    if (i % step === 0 || i === pts.length - 1) {
      svg += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--text-3)">${new Date(p.ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</text>`;
    }
  });
  svg += '</svg>';
  wrap.innerHTML = svg;
}

function renderRecent(d: LearningData) {
  const list = el('recent-list');
  list.innerHTML = '';
  const recent = allAttempts(d)
    .sort((a, b) => b.attempt.ts - a.attempt.ts)
    .slice(0, 8);
  if (recent.length === 0) {
    const li = document.createElement('li');
    li.className = 'recent-item recent-empty';
    li.textContent = '暂无作答记录。';
    list.appendChild(li);
    return;
  }
  for (const { kind, id, attempt } of recent) {
    const li = document.createElement('li');
    li.className = 'recent-item';
    const per = pctOf(attempt.score, attempt.maxScore);
    const level = gradeLevel(per);
    const tag =
      kind === 'exercise' ? '小测' : kind === 'practice' ? (attempt.passed ? '实战 · 通过' : '实战') : '单元测';
    li.innerHTML =
      `<span class="recent-date">${fmtDate(attempt.ts)}</span>` +
      `<span class="recent-title">${esc(resolveTitle(kind, id))}</span>` +
      `<span class="recent-tag">${tag}</span>` +
      `<span class="recent-score">${attempt.score}/${attempt.maxScore} 分 · ` +
      `<span class="quiz-grade grade-${level.letter}">${level.letter}</span></span>`;
    list.appendChild(li);
  }
}

function bindDataActions() {
  const fileInput = el<HTMLInputElement>('import-file');
  const modeBox = el('import-mode');
  const msg = el('data-msg');
  let pendingText = '';
  let mode: 'merge' | 'replace' = 'merge';

  el('btn-export').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crawler-course-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    msg.textContent = '已导出备份文件。';
  });

  el('btn-import').addEventListener('click', () => {
    fileInput.value = '';
    modeBox.hidden = false;
    msg.textContent = '请选择一个 .json 备份文件,并选择导入方式。';
  });

  el('btn-import-cancel').addEventListener('click', () => {
    modeBox.hidden = true;
    pendingText = '';
    msg.textContent = '已取消导入。';
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    pendingText = await file.text();
    msg.textContent = `已读取 ${file.name},点击「确认导入」完成导入。`;
  });

  document.querySelectorAll<HTMLInputElement>('input[name="import-mode"]').forEach((r) => {
    r.addEventListener('change', () => {
      mode = r.value === 'replace' ? 'replace' : 'merge';
    });
  });

  el('btn-import-go').addEventListener('click', () => {
    if (!pendingText) {
      msg.textContent = '请先选择备份文件。';
      return;
    }
    const res = store.importJSON(pendingText, mode);
    msg.textContent = res.ok
      ? `导入成功(${mode === 'merge' ? '合并' : '覆盖'})。`
      : `导入失败:${res.error ?? '未知错误'}`;
    modeBox.hidden = true;
    pendingText = '';
  });

  el('btn-reset').addEventListener('click', () => {
    if (window.confirm('确定要清空全部学习数据吗?此操作不可撤销。建议先导出备份。')) {
      store.resetAll();
      msg.textContent = '已清空全部学习数据。';
    }
  });
}

function renderAll() {
  const d = store.getData();
  renderStats(d);
  renderUnitProgress(d);
  renderRadar(d);
  renderTrend(d);
  renderRecent(d);
}

renderProfile(store.getData());
bindDataActions();
renderAll();
store.subscribe(renderAll);
