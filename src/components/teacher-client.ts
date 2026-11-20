// 教师端学情报告交互
//
// 两种数据源,共用 src/lib/class-report.ts 的同一套计算:
//   · 离线文件(阶段 0):File API 在浏览器内解析,零网络请求
//   · 示例数据:只存在于内存,不写 localStorage
//   · WorkBuddy 云(阶段 1):教师微信登录后,RLS 允许读全班 learning_snapshots
//     + student_profiles,在浏览器内跑同一个 class-report 引擎,口径与离线一致。
//     不再依赖 Cloudflare Pages Functions / D1 / TEACHER_TOKEN。
//
// 安全约定:教师身份由服务端 RLS + teacher_roles 白名单判定,前端不持有任何云凭证、
// 不写教师口令;未登录或非教师账号读不到任何学生数据。

import {
  buildClassReport,
  collapseByStudent,
  parseBackup,
  objectivesCsv,
  misconceptionsCsv,
  studentsCsv,
  type ClassReport,
  type StudentRecord,
  type ObjectiveStat,
} from '../lib/class-report';
import { demoRecords } from '../lib/demo-data';
import { migrate } from '../lib/schema';
import { countAttempts } from '../lib/merge';
import { cloud, currentSession, onAuthChange, isTeacher, errorMessage, realUid } from '../lib/cloud';
import type { CloudSessionData } from '../lib/cloud';
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
let cloudSession: CloudSessionData = null;
let cloudIsTeacher = false;

function cloudMsg(text: string, kind: 'info' | 'error' = 'info') {
  const node = el('cloud-msg');
  node.textContent = text;
  node.dataset.kind = kind;
}

/** 根据登录/教师身份刷新云端面板提示与按钮状态 */
async function refreshCloudAuth() {
  cloudSession = await currentSession();
  cloudIsTeacher = cloudSession ? await isTeacher(cloudSession) : false;
  const loadBtn = el<HTMLButtonElement>('btn-cloud-load');
  const identity = el('cloud-identity');
  if (!realUid(cloudSession)) {
    loadBtn.disabled = true;
    identity.textContent = '尚未登录。请点击页面右上角的「微信登录」,使用教师账号登录。';
    identity.dataset.kind = 'warn';
    cloudMsg('教师账号登录后才能拉取全班数据;离线汇总模式不受影响。');
  } else if (!cloudIsTeacher) {
    loadBtn.disabled = true;
    identity.textContent = `当前账号(${realUid(cloudSession)?.slice(0, 8)}…)未开通教师权限,请联系管理员在 teacher_roles 中添加。`;
    identity.dataset.kind = 'warn';
    cloudMsg('该账号不是教师,无法读取全班数据。');
  } else {
    loadBtn.disabled = false;
    identity.textContent = `已验证教师身份(${realUid(cloudSession)?.slice(0, 8)}…),可拉取全班快照。`;
    identity.dataset.kind = 'ok';
  }
}

function cloudUnavailable(e: unknown) {
  const reason = e instanceof Error ? e.message : String(e);
  cloudMsg(`云端读取失败(${reason})。离线汇总模式不受影响。`, 'error');
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
    `数据源:WorkBuddy 云快照(与离线报告同一套计算口径)`;
}

/**
 * 从 WorkBuddy 云读取全班快照。RLS 的 ls_read / sp_read 策略允许 teacher_roles
 * 中的教师读到全部行;非教师只能读自己的,前端已用 isTeacher 提前拦截。
 * student_profiles 提供权威的学号/班级,payload.roster 作为回退。
 */
async function loadCloudRecords(): Promise<StudentRecord[]> {
  const [{ data: snaps, error: snapErr }, { data: profiles, error: profErr }] = await Promise.all([
    cloud.database.from('learning_snapshots').select('owner_id, payload, updated_at'),
    cloud.database.from('student_profiles').select('owner_id, class_id, student_no, real_name'),
  ]);
  if (snapErr) throw new Error(errorMessage(snapErr, '读取学习快照失败'));
  if (profErr) throw new Error(errorMessage(profErr, '读取学生档案失败'));

  // owner_id -> profile
  const byOwner = new Map<string, { class_id: string; student_no: string; real_name?: string }>();
  for (const p of (profiles ?? []) as { owner_id: string; class_id: string; student_no: string; real_name?: string }[]) {
    byOwner.set(p.owner_id, p);
  }

  const records: StudentRecord[] = [];
  for (const s of (snaps ?? []) as { owner_id: string; payload: unknown; updated_at: string }[]) {
    if (!s.payload) continue;
    const data = migrate(s.payload);
    if (!data) continue;
    const profile = byOwner.get(s.owner_id);
    const roster = data.roster ?? {};
    const studentId = profile?.student_no || roster.studentId || s.owner_id.slice(0, 8);
    const classId = profile?.class_id || roster.classId || '';
    const syncedAt = s.updated_at ? new Date(s.updated_at).getTime() : 0;
    records.push({
      studentId,
      classId,
      sourceLabel: `云端同步 · ${syncedAt ? new Date(syncedAt).toLocaleDateString('zh-CN') : '时间未知'}`,
      source: 'cloud' as const,
      syncedAt,
      data,
    });
  }
  return records;
}

function bindCloud() {
  el('btn-cloud-load').addEventListener('click', async () => {
    cloudMsg('正在从 WorkBuddy 云拉取班级数据…');
    try {
      if (!cloudIsTeacher) {
        cloudMsg('请先用教师账号登录(页面右上角「微信登录」)。', 'error');
        return;
      }
      const all = await loadCloudRecords();

      // 班级下拉：从实际记录汇总
      const classes = Array.from(new Set(all.map((r) => r.classId).filter(Boolean))).sort();
      const select = el<HTMLSelectElement>('cloud-classes');
      const keep = select.value;
      select.innerHTML =
        '<option value="">全部班级</option>' +
        classes.map((c) => `<option value="${esc(c)}">${esc(c)} · ${all.filter((r) => r.classId === c).length} 人</option>`).join('');
      if (classes.includes(keep)) select.value = keep;

      const classId = select.value;
      const scoped = classId ? all.filter((r) => r.classId === classId) : all;
      cloudReport = buildClassReport(scoped, { classId: classId || null });
      renderCloudReport(cloudReport);
      cloudMsg(
        `已拉取 ${scoped.length} 名学生的云端快照。` +
          (scoped.length === 0
            ? '还没有学生上传快照,请学生在「我的档案 → 云端同步」点「上传」,且已完成微信登录。'
            : ''),
      );
    } catch (e) {
      cloudUnavailable(e);
    }
  });

  // 班级下拉切换后,基于已拉取的数据即时重算,无需再次联网
  el<HTMLSelectElement>('cloud-classes').addEventListener('change', () => {
    const classId = el<HTMLSelectElement>('cloud-classes').value;
    // 重新读取一次保证数据最新;失败时保留原报告
    void loadCloudRecords()
      .then((all) => {
        const scoped = classId ? all.filter((r) => r.classId === classId) : all;
        cloudReport = buildClassReport(scoped, { classId: classId || null });
        renderCloudReport(cloudReport);
        cloudMsg(`已切换到${classId ? ` ${esc(classId)}` : '全部班级'},共 ${scoped.length} 人。`);
      })
      .catch(cloudUnavailable);
  });

  el('btn-cloud-csv').addEventListener('click', () => {
    if (!cloudReport) return;
    download('云端目标达成矩阵.csv', objectivesCsv(cloudReport));
    cloudMsg('已导出目标达成 CSV。');
  });
  el('btn-cloud-print').addEventListener('click', () => window.print());

  // 登录态变化(登录/退出/会话恢复)时刷新云端面板；同页面的审计页等也监听该事件
  onAuthChange(() => void refreshCloudAuth());
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
void refreshCloudAuth();
