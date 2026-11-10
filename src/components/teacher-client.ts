// 教师端学情报告交互
//
// 三种数据源,共用 src/lib/class-report.ts 的同一套计算:
//   · 离线文件(阶段 0):File API 在浏览器内解析,零网络请求
//   · 示例数据:只存在于内存,不写 localStorage
//   · 云端 D1(阶段 1):/api/* 由 Cloudflare Pages Functions 提供,R2 归档在阶段 2
//
// 安全约定:教师口令只在内存里,不写 localStorage / 不写 URL;前端不持有任何云凭证。

import {
  buildClassReport,
  collapseByStudent,
  parseBackup,
  objectivesCsv,
  misconceptionsCsv,
  studentsCsv,
  archivePayload,
  type ClassReport,
  type StudentRecord,
  type ObjectiveStat,
} from '../lib/class-report';
import { demoRecords } from '../lib/demo-data';
import { migrate } from '../lib/schema';
import { countAttempts } from '../lib/merge';
import { getLessonById } from '../data/course';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少元素 #${id}`);
  return node as T;
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

function download(fileName: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STATUS_LABEL: Record<ObjectiveStat['status'], string> = {
  good: '已达成',
  watch: '观察',
  critical: '需重讲',
  nodata: '无数据',
};

// ── 阶段 0:离线汇总 ────────────────────────────────────────────

let records: StudentRecord[] = [];
let classFilter = '';
let report: ClassReport | null = null;

function setMsg(text: string) {
  el('teacher-msg').textContent = text;
}

function renderFileList() {
  const tbody = el('file-list');
  tbody.innerHTML = records
    .map((r, i) => {
      const done = Object.values(r.data.lessons ?? {}).filter((p) => p.status === 'completed').length;
      return `<tr>
        <td class="teacher-file-name" title="${esc(r.sourceLabel)}">${esc(r.sourceLabel)}</td>
        <td><input class="teacher-inline js-sid" data-i="${i}" value="${esc(r.studentId)}" aria-label="第 ${i + 1} 份备份的学号" maxlength="24" /></td>
        <td><input class="teacher-inline js-cid" data-i="${i}" value="${esc(r.classId)}" aria-label="第 ${i + 1} 份备份的班级" maxlength="16" /></td>
        <td>${countAttempts(r.data)}</td>
        <td>${done}</td>
        <td><button class="btn-link js-remove" data-i="${i}" aria-label="移除 ${esc(r.sourceLabel)}">移除</button></td>
      </tr>`;
    })
    .join('');
  el('file-card').hidden = records.length === 0;

  tbody.querySelectorAll<HTMLInputElement>('.js-sid').forEach((input) => {
    input.addEventListener('change', () => {
      const i = Number(input.dataset.i);
      if (!records[i]) return;
      records[i] = { ...records[i], studentId: input.value.trim() || records[i].studentId };
      render();
    });
  });
  tbody.querySelectorAll<HTMLInputElement>('.js-cid').forEach((input) => {
    input.addEventListener('change', () => {
      const i = Number(input.dataset.i);
      if (!records[i]) return;
      records[i] = { ...records[i], classId: input.value.trim() || '未分班' };
      render();
    });
  });
  tbody.querySelectorAll<HTMLButtonElement>('.js-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      records.splice(i, 1);
      render();
      setMsg(`已移除 1 份备份,当前 ${records.length} 份。`);
    });
  });
}

function kpiCard(value: string, label: string, hint = ''): string {
  return `<div class="report-card stat teacher-kpi">
    <div class="stat-value">${esc(value)}</div>
    <div class="stat-label">${esc(label)}</div>
    ${hint ? `<div class="teacher-kpi-hint">${esc(hint)}</div>` : ''}
  </div>`;
}

function renderKpis(r: ClassReport) {
  el('kpi-grid').innerHTML = [
    kpiCard(String(r.studentCount), '纳入学生', r.classId ? `筛选:${r.classId}` : `${r.classes.length} 个班`),
    kpiCard(r.totals.avgCompleted.toFixed(1), '人均完成课数', `共 ${r.lessonStats.length} 课`),
    kpiCard(fmtPct(r.totals.conceptAccuracy), '概念题正确率', '旧备份为卷面估算值'),
    kpiCard(String(r.totals.unresolvedMistakes), '未消除错题', '全班累计'),
    kpiCard(String(r.totals.attempts), '累计作答', '含练习与单元测'),
  ].join('');
}

function renderCompare(r: ClassReport) {
  const box = el('class-compare');
  if (r.byClass.length < 2) {
    box.innerHTML = '';
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML =
    `<div class="teacher-compare-title">两班对照 <span>只看班级均值,不对学生排名</span></div>` +
    r.byClass
      .map(
        (c) => `<div class="teacher-compare-row">
          <strong>${esc(c.classId)}</strong>
          <span>${c.students} 人</span>
          <span>人均 ${c.avgCompleted.toFixed(1)} 课</span>
          <span>概念 ${fmtPct(c.conceptAccuracy)}</span>
          <span>未消除错题 ${c.openMistakes}</span>
        </div>`,
      )
      .join('');
}

function objectiveRow(o: ObjectiveStat, withBloom: boolean): string {
  const href = `/tutorials/${getLessonById(o.lessonId)?.slug ?? o.lessonId}/`;
  const bloom = withBloom
    ? `<td><span class="teacher-chip">${esc({ remember: '记忆', understand: '理解', apply: '应用', analyze: '分析' }[o.bloom])}</span></td>`
    : '';
  const indirect = o.attempted - o.directCount;
  const source = o.questionIds.length ? '概念题' : '代码实战';
  const kindText = o.directCount
    ? `直接 ${o.directCount}${indirect ? ` · 间接 ${indirect}` : ''}`
    : `间接 ${o.attempted}`;
  const evidence =
    o.attempted === 0
      ? '<span class="teacher-muted">无作答</span>'
      : `${source} · ${kindText}`;
  const rateCell =
    o.rate === null
      ? '<span class="teacher-muted">—</span>'
      : `<div class="teacher-bar"><i style="width:${Math.round(o.rate * 100)}%"></i></div><span class="teacher-rate">${fmtPct(o.rate)}</span>`;
  return `<tr class="teacher-row-${o.status}">
    <td><a href="${href}" target="_blank" rel="noopener">${esc(o.lessonTitle)}</a>
      <div class="teacher-obj">${esc(o.statement)}</div>
      ${o.anchor ? `<div class="teacher-anchor">回看:${esc(o.anchor)}</div>` : ''}</td>
    ${bloom}
    <td>${o.achieved}/${o.attempted}</td>
    <td class="teacher-rate-cell">${rateCell}</td>
    <td class="teacher-muted">${evidence}</td>
    <td><span class="teacher-status teacher-status-${o.status}">${STATUS_LABEL[o.status]}</span></td>
  </tr>`;
}

function renderObjectives(r: ClassReport, bodyId: string, withBloom: boolean) {
  const sorted = [...r.objectives].sort((a, b) => {
    const rank = (s: ObjectiveStat['status']) =>
      ({ critical: 0, watch: 1, nodata: 2, good: 3 })[s];
    return rank(a.status) - rank(b.status) || (a.rate ?? 1) - (b.rate ?? 1);
  });
  el(bodyId).innerHTML = sorted.map((o) => objectiveRow(o, withBloom)).join('');
}

function renderMisconceptions(r: ClassReport) {
  const hit = r.misconceptions.filter((m) => m.students > 0);
  const rest = r.misconceptions.length - hit.length;
  const max = Math.max(1, ...hit.map((m) => m.students));
  el('misconception-list').innerHTML =
    (hit.length === 0
      ? '<p class="report-hint">目前没有命中的误区标签。学生完成概念题并答错后,这里会按标签聚合。</p>'
      : hit
          .slice(0, 12)
          .map(
            (m) => `<div class="teacher-heat-row">
              <div class="teacher-heat-label">${esc(m.label)}</div>
              <div class="teacher-bar teacher-bar-heat"><i style="width:${Math.round((m.students / max) * 100)}%"></i></div>
              <div class="teacher-heat-num">${m.students}/${r.studentCount} 人</div>
              <div class="teacher-heat-detail">错 ${m.occurrences} 次 · 已消除 ${m.resolved} 人 · 未消除 ${m.unresolved}</div>
            </div>`,
          )
          .join('') +
        (rest ? `<p class="report-hint">另有 ${rest} 类误区本班暂未命中。</p>` : ''));
}

function renderSkills(r: ClassReport) {
  el('skill-list').innerHTML = r.skills
    .map(
      (s) => `<div class="teacher-skill-row">
        <span>${esc(s.name)}</span>
        <div class="teacher-bar"><i style="width:${Math.round(s.avgMastery * 100)}%"></i></div>
        <span>${fmtPct(s.avgMastery)}</span>
        <span class="teacher-muted">${s.covered} 人有记录</span>
      </div>`,
    )
    .join('');
}

function renderLessons(r: ClassReport) {
  el('lesson-body').innerHTML = r.lessonStats
    .map(
      (l) => `<tr class="${l.completionRate < 0.5 ? 'teacher-row-critical' : ''}">
        <td><a href="/tutorials/${getLessonById(l.id)?.slug ?? l.id}/" target="_blank" rel="noopener">${esc(l.title)}</a>
          <div class="teacher-anchor">${esc(l.unitTitle)}</div></td>
        <td>${l.completed}</td><td>${l.inProgress}</td><td>${l.notStarted}</td>
        <td class="teacher-rate-cell"><div class="teacher-bar"><i style="width:${Math.round(l.avgMastery * 100)}%"></i></div><span class="teacher-rate">${fmtPct(l.avgMastery)}</span></td>
      </tr>`,
    )
    .join('');
}

function renderDecisions(r: ClassReport, targetId: string) {
  el(targetId).innerHTML =
    r.decisions.length === 0
      ? '<p class="report-hint">当前数据没有触发预警阈值。样本较少时建议先扩大采集,不要据此判定「全班都掌握了」。</p>'
      : r.decisions
          .map(
            (d) => `<div class="teacher-decision teacher-decision-${d.kind}">
              <div class="teacher-decision-title">${esc(d.title)}</div>
              <p>${esc(d.detail)}</p>
              ${d.href ? `<a href="${d.href}" target="_blank" rel="noopener">${esc(d.linkLabel ?? '查看')} →</a>` : ''}
            </div>`,
          )
          .join('');
}

function renderStudents(r: ClassReport) {
  const statusText = { ontrack: '正常', watch: '关注', behind: '需补救' };
  el('student-body').innerHTML = [...r.students]
    .sort((a, b) => a.completed - b.completed || a.studentId.localeCompare(b.studentId))
    .map(
      (s) => `<tr>
        <td class="teacher-mono">${esc(s.studentId)}</td>
        <td>${esc(s.classId)}</td>
        <td>${s.completed}</td>
        <td>${fmtPct(s.avgMastery)}</td>
        <td>${s.openMistakes}</td>
        <td><span class="teacher-status teacher-status-${s.status === 'behind' ? 'critical' : s.status === 'watch' ? 'watch' : 'good'}">${statusText[s.status]}</span></td>
      </tr>`,
    )
    .join('');
}

function renderClassFilter(r: ClassReport) {
  const select = el<HTMLSelectElement>('class-filter');
  const options = ['', ...r.classes];
  select.innerHTML = options
    .map((c) => `<option value="${esc(c)}"${c === classFilter ? ' selected' : ''}>${c ? esc(c) : '全部班级'}</option>`)
    .join('');
  if (!options.includes(classFilter)) classFilter = '';
}

function render() {
  const hasRecords = records.length > 0;
  el('teacher-report').hidden = !hasRecords;
  renderFileList();
  if (!hasRecords) return;

  const merged = collapseByStudent(records);
  const classes = [...new Set(merged.map((x) => x.classId))];
  if (classFilter && !classes.includes(classFilter)) classFilter = '';
  report = buildClassReport(merged, { classId: classFilter || null });
  const r = report;
  renderClassFilter(r);
  renderKpis(r);
  renderCompare(r);
  renderObjectives(r, 'objective-body', true);
  renderMisconceptions(r);
  renderSkills(r);
  renderLessons(r);
  renderDecisions(r, 'decision-list');
  renderStudents(r);

  const indirect = r.objectives.reduce((s, o) => s + (o.attempted - o.directCount), 0);
  el('report-meta').textContent =
    `${r.studentCount} 名学生 · ${r.classes.length} 个班 · ` +
    `生成于 ${new Date(r.generatedAt).toLocaleString('zh-CN')}` +
    (indirect ? ` · 其中 ${indirect} 条目标证据为间接推断` : '') +
    (merged.length < records.length ? ` · ${records.length - merged.length} 份备份按学号合并` : '');
}

async function addFiles(files: FileList | File[]) {
  let added = 0;
  const errors: string[] = [];
  for (const file of Array.from(files)) {
    const res = parseBackup(await file.text(), file.name);
    if (!res.ok) {
      errors.push(res.error);
      continue;
    }
    records.push(res.record);
    added += 1;
  }
  render();
  const parts = [`已加入 ${added} 份备份,当前共 ${records.length} 份。`];
  if (errors.length) parts.push(`${errors.length} 份未加入:${errors.slice(0, 2).join(' ')}`);
  if (added && records.length > collapseByStudent(records).length) {
    parts.push('检测到同一学号的多份备份,报告已自动合并。');
  }
  setMsg(parts.join(' '));
}

function bindOffline() {
  const input = el<HTMLInputElement>('teacher-files');
  el('btn-pick-files').addEventListener('click', () => {
    input.value = '';
    input.click();
  });
  input.addEventListener('change', () => {
    if (input.files?.length) void addFiles(input.files);
  });
  el('btn-demo').addEventListener('click', () => {
    records = demoRecords();
    classFilter = '';
    render();
    setMsg(`已载入 ${records.length} 名示例学生(2 个班)。示例数据只在内存里,不会写入本机或上传。`);
  });
  el('btn-clear').addEventListener('click', () => {
    records = [];
    classFilter = '';
    render();
    setMsg('已清空本机加入的备份(不影响学生自己的浏览器数据)。');
  });
  el<HTMLSelectElement>('class-filter').addEventListener('change', (ev) => {
    classFilter = (ev.target as HTMLSelectElement).value;
    render();
  });

  const csv = (id: string, name: string, fn: (r: ClassReport) => string) => {
    el(id).addEventListener('click', () => {
      if (!report) return;
      download(name, fn(report));
      setMsg(`已导出 ${name}。`);
    });
  };
  csv('btn-csv-objectives', '目标达成矩阵.csv', objectivesCsv);
  csv('btn-csv-misconceptions', '共性误区.csv', misconceptionsCsv);
  csv('btn-csv-students', '学生跟进清单.csv', studentsCsv);
  el('btn-print').addEventListener('click', () => window.print());
}

// ── 阶段 1/2:云端看板与归档 ────────────────────────────────────

let cloudReport: ClassReport | null = null;

function cloudMsg(text: string) {
  el('cloud-msg').textContent = text;
}

function teacherToken(): string {
  return el<HTMLInputElement>('cloud-token').value.trim();
}

async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = teacherToken();
  if (!token) throw new Error('请先填写教师口令。');
  const resp = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await resp.text();
  if (!resp.ok) {
    let detail = text.slice(0, 120);
    try {
      const j = JSON.parse(text);
      detail = j.error ?? detail;
    } catch {
      detail = '当前站点尚未部署 Pages Functions(/api/* 返回了静态 404 页面)';
    }
    throw new Error(`HTTP ${resp.status}:${detail}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      '当前站点尚未部署 Pages Functions(/api/* 不可用)。请按 docs/TEACHER-DATA.md 完成阶段 1 部署。',
    );
  }
}

function cloudUnavailable(e: unknown) {
  const reason = e instanceof Error ? e.message : String(e);
  cloudMsg(
    `云端接口不可用(${reason})。本地静态预览没有 /api/*;` +
      '请按 docs/TEACHER-DATA.md 部署到 Cloudflare Pages 并绑定 D1 后重试。离线模式不受影响。',
  );
}

function renderCloudReport(r: ClassReport) {
  el('cloud-report').hidden = false;
  el('cloud-kpis').innerHTML = [
    kpiCard(String(r.studentCount), '已同步学生', r.classId ? `筛选:${r.classId}` : `${r.classes.length} 个班`),
    kpiCard(r.totals.avgCompleted.toFixed(1), '人均完成课数'),
    kpiCard(fmtPct(r.totals.conceptAccuracy), '概念题正确率'),
    kpiCard(String(r.totals.unresolvedMistakes), '未消除错题'),
    kpiCard(
      r.totals.lastSyncedAt ? new Date(r.totals.lastSyncedAt).toLocaleDateString('zh-CN') : '—',
      '最近同步',
    ),
  ].join('');
  renderObjectives(r, 'cloud-objective-body', false);
  renderDecisions(r, 'cloud-decisions');
  el('cloud-report-meta').textContent =
    `${r.studentCount} 名学生 · 生成于 ${new Date(r.generatedAt).toLocaleString('zh-CN')} · ` +
    `数据源:D1 快照(与离线报告同一套计算口径)`;
}

function bindCloud() {
  el('btn-cloud-load').addEventListener('click', async () => {
    cloudMsg('正在拉取班级数据…');
    try {
      const overview = (await api('/overview')) as {
        classes: { classId: string; students: number; lastSyncAt: number }[];
      };
      const select = el<HTMLSelectElement>('cloud-classes');
      const keep = select.value;
      select.innerHTML =
        '<option value="">全部班级</option>' +
        (overview.classes ?? [])
          .map(
            (c) =>
              `<option value="${esc(c.classId)}">${esc(c.classId)} · ${c.students} 人</option>`,
          )
          .join('');
      if ((overview.classes ?? []).some((c) => c.classId === keep)) select.value = keep;

      const classId = select.value;
      const payload = (await api(`/class${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`)) as {
        students: { studentId: string; classId: string; syncedAt: number; data: unknown }[];
      };
      const cloudRecords: StudentRecord[] = (payload.students ?? []).flatMap((s) => {
        const data = migrate(s.data);
        if (!data) return [];
        return [
          {
            studentId: s.studentId,
            classId: s.classId,
            sourceLabel: 'D1 同步',
            source: 'cloud' as const,
            syncedAt: s.syncedAt,
            data,
          },
        ];
      });
      cloudReport = buildClassReport(cloudRecords, { classId: classId || null });
      renderCloudReport(cloudReport);
      cloudMsg(
        `已拉取 ${cloudRecords.length} 名学生的同步快照。` +
          (cloudRecords.length === 0 ? '该班还没有学生上报,先让学生在「学习中心 → 云同步」启用。' : ''),
      );
    } catch (e) {
      cloudUnavailable(e);
    }
  });

  el('btn-cloud-csv').addEventListener('click', () => {
    if (!cloudReport) return;
    download('云端目标达成矩阵.csv', objectivesCsv(cloudReport));
    cloudMsg('已导出目标达成 CSV。');
  });
  el('btn-cloud-print').addEventListener('click', () => window.print());

  el('btn-cloud-archive').addEventListener('click', async () => {
    if (!cloudReport) {
      cloudMsg('请先拉取班级数据,再归档。');
      return;
    }
    try {
      const res = (await api('/archive', {
        method: 'POST',
        body: JSON.stringify({
          classId: cloudReport.classId ?? 'all',
          csv: objectivesCsv(cloudReport),
          report: archivePayload(cloudReport),
        }),
      })) as { key: string };
      cloudMsg(`已归档到 R2:${res.key}`);
    } catch (e) {
      cloudUnavailable(e);
    }
  });

  el('btn-cloud-archive-list').addEventListener('click', async () => {
    try {
      const classId = el<HTMLSelectElement>('cloud-classes').value;
      const res = (await api(`/archive?classId=${encodeURIComponent(classId)}`)) as {
        items: { key: string; uploadedAt: number; size: number }[];
      };
      el('archive-list').innerHTML =
        (res.items ?? []).length === 0
          ? '<p class="report-hint">还没有归档记录。</p>'
          : `<ul class="teacher-archive-list">${res.items
              .map(
                (i) =>
                  `<li><span class="teacher-mono">${esc(i.key)}</span> · ${new Date(i.uploadedAt).toLocaleString('zh-CN')} · ${i.size} B</li>`,
              )
              .join('')}</ul>`;
      cloudMsg(`共 ${(res.items ?? []).length} 份归档。`);
    } catch (e) {
      cloudUnavailable(e);
    }
  });
}

// ── 数据源切换 ──────────────────────────────────────────────────

function bindTabs() {
  const map: [string, string][] = [
    ['tab-offline', 'panel-offline'],
    ['tab-cloud', 'panel-cloud'],
  ];
  const activate = (which: 'offline' | 'cloud') => {
    for (const [tabId, panelId] of map) {
      const isOn = tabId === `tab-${which}`;
      const tab = el(tabId);
      tab.classList.toggle('active', isOn);
      tab.setAttribute('aria-selected', String(isOn));
      el(panelId).hidden = !isOn;
    }
  };
  el('tab-offline').addEventListener('click', () => activate('offline'));
  el('tab-cloud').addEventListener('click', () => activate('cloud'));
}

bindOffline();
bindCloud();
bindTabs();
render();
