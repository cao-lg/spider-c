// 每周班级报告归档(阶段 2)—— 可由 cron / GitHub Actions 定时调用。
//
// 用法:
//   SITE_URL=https://spider-c.pages.dev TEACHER_TOKEN=xxx node scripts/archive-weekly.ts
//   (Windows PowerShell: $env:SITE_URL="..."; $env:TEACHER_TOKEN="..."; node ...)
//
// 为什么报告在脚本里算,而不是让服务端算:
//   class-report.ts 是纯函数,离线教师页、D1 在线看板、定时归档三处共用同一套口径。
//   若服务端另写一套 SQL 聚合,归档结果与教师当天看到的报告迟早会不一致。
//
// 归档内容:聚合快照(JSON) + 目标达成 CSV,只含匿名学号,不含原始作答文本。

import { buildClassReport, archivePayload, objectivesCsv } from '../src/lib/class-report.ts';
import type { StudentRecord } from '../src/lib/class-report.ts';
import { migrate } from '../src/lib/schema.ts';
import type { LearningData } from '../src/lib/types.ts';

const SITE = (process.env.SITE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.TEACHER_TOKEN ?? '';

function assertEnv() {
  if (!SITE) throw new Error('缺少 SITE_URL(例如 https://spider-c.pages.dev)');
  if (TOKEN.length < 8) throw new Error('缺少 TEACHER_TOKEN,或口令过短');
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${SITE}/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await resp.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`/api${path} 返回的不是 JSON(HTTP ${resp.status})。请确认 Pages Functions 已部署。`);
  }
  if (!resp.ok) throw new Error(`/api${path} 失败(HTTP ${resp.status}):${String(body.error ?? '')}`);
  return body as T;
}

interface ClassRow { classId: string; students: number }
interface CloudStudent {
  studentId: string;
  classId: string;
  syncedAt: number;
  data: unknown;
}

function toRecords(rows: CloudStudent[]): StudentRecord[] {
  return rows.flatMap((s) => {
    const data = migrate(s.data);
    if (!data) {
      console.warn(`  ! 跳过 ${s.studentId}:快照结构无法识别`);
      return [];
    }
    return [
      {
        studentId: s.studentId,
        classId: s.classId,
        sourceLabel: 'D1 同步',
        source: 'cloud' as const,
        syncedAt: s.syncedAt,
        data: data as LearningData,
      },
    ];
  });
}

async function archive(report: ReturnType<typeof buildClassReport>, label: string) {
  const res = await api<{ key: string; size: number }>('/archive', {
    method: 'POST',
    body: JSON.stringify({
      classId: label,
      report: archivePayload(report),
      csv: objectivesCsv(report),
    }),
  });
  console.log(`  ✓ ${label}:${report.studentCount} 人 → ${res.key}(${res.size} B)`);
}

async function main() {
  assertEnv();
  const ov = await api<{ classes: ClassRow[] }>('/overview');
  if (!ov.classes.length) {
    console.log('当前没有班级快照,无需归档。');
    return;
  }
  console.log(`发现 ${ov.classes.length} 个班级:${ov.classes.map((c) => `${c.classId}(${c.students})`).join('、')}`);

  // 全量一份 + 每班一份,便于既看整体又做两班对比的纵向回看
  const all = await api<{ students: CloudStudent[] }>('/class');
  const records = toRecords(all.students ?? []);
  await archive(buildClassReport(records), 'all');

  for (const c of ov.classes) {
    const one = await api<{ students: CloudStudent[] }>(
      `/class?classId=${encodeURIComponent(c.classId)}`,
    );
    await archive(
      buildClassReport(toRecords(one.students ?? []), { classId: c.classId }),
      c.classId,
    );
  }
  console.log('归档完成。取回:教师端「学情报告 → 云端看板 → 查看归档」。');
}

main().catch((e) => {
  console.error(`归档失败:${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
