// 目录一致性校验 —— npm run build 前自动执行(prebuild)
//
// 为什么需要它:
//   课程元数据有两处来源 —— src/data/course.ts(全站导航/报告用)与每篇 mdx 的 frontmatter
//   (Astro 内容集合用)。两者一旦漂移,典型症状是"导航写 40 分钟、正文写 45 分钟"、
//   "改了标题但侧边栏没变",而构建仍然通过。这类错误只能靠机器比对。
//
// 运行:node scripts/check-catalog.ts(无需编译,Node 原生剥离类型)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lessons, units, unitTests, courseTests } from '../src/data/course.ts';
import { lessonTasks, unitTestTasks } from '../src/data/tasks.ts';
import { conceptQuestions, misconceptionLabels } from '../src/data/questions.ts';
import { designList } from '../src/data/design.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors: string[] = [];
const warnings: string[] = [];

function fail(msg: string) {
  errors.push(msg);
}

type FrontMatter = Record<string, string | string[]>;

/** 只解析本项目用到的 YAML 子集:key: scalar 与 key:\n  - item */
function parseFrontMatter(text: string, file: string): FrontMatter {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) {
    fail(`${file}: 缺少 frontmatter`);
    return {};
  }
  const out: FrontMatter = {};
  let currentKey = '';
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem) {
      const arr = (out[currentKey] as string[]) ?? [];
      arr.push(stripQuotes(listItem[1]));
      out[currentKey] = arr;
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    const value = kv[2].trim();
    out[currentKey] = value === '' ? [] : stripQuotes(value);
  }
  return out;
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// ── 1. mdx 与 course.ts 的一一对应 ─────────────────────────────
// 元数据已在 v2 收敛到 course.ts,mdx 只保留 id。这里校验:
//   文件存在且命名一致、id 有效、正文非空、不再出现重复的元数据字段。
const tutorialDir = join(root, 'src/content/tutorials');
const files = readdirSync(tutorialDir).filter((f) => f.endsWith('.mdx'));
const seen = new Set<string>();
const METADATA_KEYS = ['title', 'slug', 'unitId', 'order', 'duration', 'summary', 'goals'];

for (const file of files) {
  const text = readFileSync(join(tutorialDir, file), 'utf8');
  const fm = parseFrontMatter(text, file);
  const id = String(fm.id ?? '');
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) {
    fail(`${file}: frontmatter id="${id}" 在 course.ts 中不存在`);
    continue;
  }
  if (seen.has(id)) fail(`${file}: id "${id}" 重复出现`);
  seen.add(id);

  if (file !== `${id}.mdx`) {
    fail(`${file}: 文件名必须与 id 一致(应为 ${id}.mdx)`);
  }

  for (const key of Object.keys(fm)) {
    if (key === 'id') continue;
    if (METADATA_KEYS.includes(key)) {
      fail(`${file}: frontmatter 里不应再写 "${key}" —— 元数据的唯一来源是 course.ts`);
    } else {
      warnings.push(`${file}: 未使用的 frontmatter 字段 "${key}"`);
    }
  }

  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  if (body.trim().length < 200) {
    fail(`${file}: 正文过短(${body.trim().length} 字符),可能内容丢失`);
  }
}

for (const lesson of lessons) {
  if (!seen.has(lesson.id)) fail(`course.ts 中的课程 ${lesson.id} 缺少对应的 mdx 正文`);
}

// ── 2. 任务与题目的引用完整性 ──────────────────────────────────
const lessonIds = new Set(lessons.map((l) => l.id));
const unitIds = new Set(units.map((u) => u.id));

for (const key of Object.keys(lessonTasks)) {
  if (!lessonIds.has(key)) fail(`tasks.ts 中的 lessonTasks['${key}'] 没有对应课程`);
  const t = lessonTasks[key];
  if (!t.starter?.trim()) fail(`任务 ${t.id} 缺少 starter`);
  if (!t.check?.trim()) fail(`任务 ${t.id} 缺少 check 判分逻辑`);
  if (!(t.maxScore > 0)) fail(`任务 ${t.id} 的 maxScore 非法`);
}

for (const key of Object.keys(unitTestTasks)) {
  const testId = unitTests.find((t) => t.id === key);
  if (!testId) fail(`tasks.ts 中的 unitTestTasks['${key}'] 没有对应单元测试`);
  if ((unitTestTasks[key] ?? []).length === 0) fail(`单元测试 ${key} 没有任何实操题`);
}

// ── 3. 概念题与设计层 ─────────────────────────────────────────
const objectiveIds = new Set(designList.flatMap((d) => d.objectives.map((o) => o.id)));

for (const q of conceptQuestions) {
  if (!lessonIds.has(q.lessonId)) fail(`题目 ${q.id} 指向不存在的课程 ${q.lessonId}`);
  if (!unitIds.has(q.unitId)) fail(`题目 ${q.id} 指向不存在的单元 ${q.unitId}`);
  if (q.objectiveId && !objectiveIds.has(q.objectiveId)) {
    fail(`题目 ${q.id} 指向不存在的目标 ${q.objectiveId}`);
  }
  if (q.type === 'choice') {
    const opts = q.options ?? [];
    const idx = Number(q.answer[0]);
    if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) {
      fail(`题目 ${q.id} 答案索引越界`);
    }
    if ((q.optionFeedback ?? []).length !== opts.length) {
      fail(`题目 ${q.id} 诊断反馈数量与选项不一致`);
    }
  }
  if (q.misconception && !misconceptionLabels[q.misconception]) {
    fail(`题目 ${q.id} 使用未登记的误区标签 ${q.misconception}`);
  }
}

// ── 4. 靶站文件是否真实存在 ───────────────────────────────────
const practiceDir = join(root, 'public');
const targets = [
  ...lessons.filter((l) => l.practiceTarget).map((l) => l.practiceTarget as string),
  ...courseTests.map((t) => t.practicePath),
];
for (const target of targets) {
  const path = join(practiceDir, target.replace(/\.html$/, ''), 'index.html');
  const alt = join(practiceDir, target);
  if (!existsSync(path) && !existsSync(alt)) {
    fail(`靶站路径不存在:${target}(找不到 ${path})`);
  }
}

// ── 汇总 ─────────────────────────────────────────────────────
const courseTestTargets = courseTests.length;
const taskCount = Object.values(unitTestTasks).reduce((s, arr) => s + arr.length, 0);

if (warnings.length > 0) {
  console.log('\n⚠ 警告:');
  for (const w of warnings) console.log(`  - ${w}`);
}

if (errors.length > 0) {
  console.error('\n✗ 目录校验失败:');
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n共 ${errors.length} 处问题,已阻止构建。\n`);
  process.exit(1);
}

console.log(
  `✓ 目录校验通过:${lessons.length} 课 / ${units.length} 单元 / ${unitTests.length} 单元测 / ` +
    `${courseTestTargets} 套综合测试 / ${conceptQuestions.length} 道概念题 / ` +
    `${Object.keys(lessonTasks).length + taskCount} 个实操任务 / ${designList.length} 张设计卡`,
);
