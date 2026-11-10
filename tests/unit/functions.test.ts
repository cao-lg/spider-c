// Pages Functions 后端全链路验证(内存版 D1 / R2,不需要 Cloudflare 账号)
//
// 覆盖:注册鉴权 → 双设备合并上报 → 教师聚合 → 删除权 → R2 归档。
// 最关键的一条是「两台设备先后上报,旧记录不能被整包覆盖丢掉」——
// 这正是「每生一个 JSON 直接写 R2」方案的致命缺陷。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  enroll,
  pushSnapshot,
  pullSnapshot,
  deleteOwn,
  overview,
  classData,
  deleteStudent,
  archiveReport,
  listArchives,
  readArchive,
  type CourseStore,
  type StudentRow,
  type SessionRow,
  type SnapshotRow,
  type ClassRow,
  type ArchiveRow,
  type Env,
  type R2Bucket,
  type R2ObjectBody,
} from '../../functions/_shared/backend.ts';
import { buildClassReport, archivePayload } from '../../src/lib/class-report.ts';
import type { StudentRecord } from '../../src/lib/class-report.ts';
import { defaultData } from '../../src/lib/schema.ts';
import type { LearningData } from '../../src/lib/types.ts';

const T = 1_700_000_001_000;
const TEACHER = 'teacher-secret-123';

class MemoryCourseStore implements CourseStore {
  students = new Map<string, StudentRow>();
  sessions = new Map<string, SessionRow>();
  snapshots = new Map<string, SnapshotRow>();
  archives = new Map<string, ArchiveRow>();

  async getStudent(id: string) { return this.students.get(id) ?? null; }
  async putStudent(r: StudentRow) { this.students.set(r.studentId, r); }
  async getSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async putSession(r: SessionRow) { this.sessions.set(r.tokenHash, r); }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async getSnapshot(id: string) { return this.snapshots.get(id) ?? null; }
  async putSnapshot(r: SnapshotRow) { this.snapshots.set(r.studentId, r); }
  async deleteStudent(id: string) {
    this.snapshots.delete(id);
    this.students.delete(id);
    for (const [k, v] of this.sessions) if (v.studentId === id) this.sessions.delete(k);
  }
  async listClasses(): Promise<ClassRow[]> {
    const m = new Map<string, ClassRow>();
    for (const s of this.snapshots.values()) {
      const c = m.get(s.classId) ?? { classId: s.classId, students: 0, lastSyncAt: 0 };
      c.students += 1;
      c.lastSyncAt = Math.max(c.lastSyncAt, s.syncedAt);
      m.set(s.classId, c);
    }
    return [...m.values()].sort((a, b) => a.classId.localeCompare(b.classId));
  }
  async listStudents(classId?: string): Promise<SnapshotRow[]> {
    return [...this.snapshots.values()]
      .filter((s) => !classId || s.classId === classId)
      .sort((a, b) => a.studentId.localeCompare(b.studentId));
  }
  async putArchive(r: ArchiveRow) { this.archives.set(r.key, r); }
  async listArchives(classId?: string): Promise<ArchiveRow[]> {
    return [...this.archives.values()]
      .filter((a) => !classId || a.classId === classId)
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
  }
}

class MemoryR2 implements R2Bucket {
  objects = new Map<string, string>();
  async put(key: string, value: string) { this.objects.set(key, value); return null; }
  async get(key: string): Promise<R2ObjectBody | null> {
    const v = this.objects.get(key);
    return v ? { text: async () => v, size: v.length } : null;
  }
  async list() { return { objects: [...this.objects.keys()].map((key) => ({ key, size: this.objects.get(key)!.length })) }; }
}

function envWith(r2?: R2Bucket): Env {
  return {
    DB: {} as Env['DB'],
    ARCHIVE: r2,
    TEACHER_TOKEN: TEACHER,
    SYNC_SALT: 'unit-test-salt',
  };
}

const bearer = (token: string) => `Bearer ${token}`;
const teacher = bearer(TEACHER);

function learning(ts: number, score: number): LearningData {
  const d = defaultData();
  d.profile = { name: 'S01', createdAt: ts - 1000 };
  d.practice['ex-01-environment'] = [{ ts, score, maxScore: 10, ratio: score / 10, passed: score >= 6 }];
  d.lessons['01-environment'] = { status: 'completed', mastery: score / 10 };
  return d;
}

async function register(store: MemoryCourseStore, id = 'S01', classId = '1班', code = 'code-123') {
  const res = await enroll(store, envWith(), { studentId: id, classId, code }, T);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return String(res.body.token);
}

// ── 注册与身份 ──────────────────────────────────────────────────

test('enroll 拒绝真实姓名式学号与过短口令', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  assert.equal((await enroll(s, env, { studentId: '张三', classId: '1班', code: 'code-123' }, T)).status, 400);
  assert.equal((await enroll(s, env, { studentId: 'S01', classId: '1班', code: '123' }, T)).status, 400);
});

test('enroll 不存口令明文,只存加盐哈希', async () => {
  const s = new MemoryCourseStore();
  await register(s);
  const row = s.students.get('S01')!;
  assert.ok(!row.codeHash.includes('code-123'));
  assert.equal(row.codeHash.length, 64);
  assert.equal([...s.sessions.values()][0].studentId, 'S01');
});

test('换设备用同一学号+同一口令可重新登录,口令不对则拒绝', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const first = await enroll(s, env, { studentId: 'S01', classId: '1班', code: 'code-123' }, T);
  const again = await enroll(s, env, { studentId: 'S01', classId: '1班', code: 'code-123' }, T + 10);
  const wrong = await enroll(s, env, { studentId: 'S01', classId: '1班', code: 'other-code' }, T + 20);
  assert.equal(first.status, 200);
  assert.equal(again.status, 200);
  assert.notEqual(first.body.token, again.body.token, '每次登录换发新令牌');
  assert.equal(wrong.status, 401);
});

// ── 同步与合并 ──────────────────────────────────────────────────

test('pushSnapshot 需要有效令牌,且拒绝非法数据结构', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const token = await register(s);
  assert.equal((await pushSnapshot(s, env, null, { data: learning(T, 8) }, T)).status, 401);
  assert.equal((await pushSnapshot(s, env, bearer('bad'), { data: learning(T, 8) }, T)).status, 401);
  assert.equal((await pushSnapshot(s, env, bearer(token), { data: { schemaVersion: 99 } }, T)).status, 400);
});

test('双设备先后上报:服务端合并,旧作答不被整包覆盖', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const token = await register(s);

  // 设备 A:两条作答
  const a = learning(T, 8);
  a.practice['ex-01-environment'].push({ ts: T + 10, score: 9, maxScore: 10, ratio: 0.9, passed: true });
  const r1 = await pushSnapshot(s, env, bearer(token), { data: a }, T + 20);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.attempts, 2);

  // 设备 B:只有一条新作答(没有设备 A 的记录)—— 若整包覆盖就会丢掉前两条
  const b = learning(T + 30, 7);
  const r2 = await pushSnapshot(s, env, bearer(token), { data: b }, T + 40);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.attempts, 3, '三次作答都要在');
  assert.equal(r2.body.revision, 2);

  const pull = await pullSnapshot(s, env, bearer(token), T + 50);
  const data = pull.body.data as LearningData;
  assert.equal(data.practice['ex-01-environment'].length, 3);
  assert.equal(data.roster?.studentId, 'S01', '名册以服务端为准');
  assert.equal(data.roster?.classId, '1班');
});

test('客户端伪造 roster 会被服务端覆盖', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const token = await register(s);
  const forged = learning(T, 8);
  forged.roster = { studentId: 'ADMIN', classId: '9班' };
  await pushSnapshot(s, env, bearer(token), { data: forged }, T);
  const snap = s.snapshots.get('S01')!;
  assert.equal(snap.classId, '1班');
  assert.equal((JSON.parse(snap.payload) as LearningData).roster?.studentId, 'S01');
  assert.equal(s.snapshots.has('ADMIN'), false);
});

test('过期的同步会话被拒绝', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const token = await register(s);
  const future = T + 200 * 86400000;
  assert.equal((await pullSnapshot(s, env, bearer(token), future)).status, 401);
});

// ── 教师聚合 ────────────────────────────────────────────────────

test('overview / classData 必须校验教师口令,且按班级筛选', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const t1 = await register(s, 'S01', '1班');
  const t2 = await register(s, 'S02', '2班');
  await pushSnapshot(s, env, bearer(t1), { data: learning(T, 8) }, T);
  await pushSnapshot(s, env, bearer(t2), { data: learning(T + 1, 5) }, T + 1);

  assert.equal((await overview(s, env, bearer('wrong'))).status, 401);
  const ov = await overview(s, env, teacher);
  assert.deepEqual((ov.body.classes as { classId: string }[]).map((c) => c.classId), ['1班', '2班']);

  const one = await classData(s, env, teacher, '1班');
  assert.equal((one.body.students as unknown[]).length, 1);
  const all = await classData(s, env, teacher, '');
  assert.equal((all.body.students as unknown[]).length, 2);

  // 教师端拿到快照后能直接用同一套报告引擎出结果
  const rows = all.body.students as { studentId: string; classId: string; syncedAt: number; data: unknown }[];
  const records: StudentRecord[] = rows.map((r) => ({
    studentId: r.studentId,
    classId: r.classId,
    sourceLabel: 'D1 同步',
    source: 'cloud',
    syncedAt: r.syncedAt,
    data: r.data as LearningData,
  }));
  const report = buildClassReport(records, { now: T + 2 });
  assert.equal(report.studentCount, 2);
  assert.equal(report.objectives.length, 44);
});

test('未配置教师口令时不放行(空口令不能成为后门)', async () => {
  const s = new MemoryCourseStore();
  const env = { ...envWith(), TEACHER_TOKEN: '' };
  assert.equal((await overview(s, env, bearer(''))).status, 401);
});

// ── 删除权 ──────────────────────────────────────────────────────

test('学生可删除自己的云端数据,且会话随之失效', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const token = await register(s);
  await pushSnapshot(s, env, bearer(token), { data: learning(T, 8) }, T);
  assert.equal(s.snapshots.size, 1);
  assert.equal((await deleteOwn(s, env, bearer(token), T)).status, 200);
  assert.equal(s.snapshots.size, 0);
  assert.equal(s.students.size, 0);
  assert.equal(s.sessions.size, 0);
  assert.equal((await pullSnapshot(s, env, bearer(token), T)).status, 401);
});

test('教师可删除指定学号,口令错误不可删', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const token = await register(s);
  await pushSnapshot(s, env, bearer(token), { data: learning(T, 8) }, T);
  assert.equal((await deleteStudent(s, env, bearer('wrong'), 'S01')).status, 401);
  assert.equal((await deleteStudent(s, env, teacher, 'S01')).status, 200);
  assert.equal(s.snapshots.size, 0);
});

// ── 阶段 2:R2 归档 ─────────────────────────────────────────────

test('未绑定 R2 时归档返回 503,不影响阶段 1', async () => {
  const s = new MemoryCourseStore();
  const env = envWith();
  const payload = archivePayload(buildClassReport([], { now: T }));
  const res = await archiveReport(s, env, teacher, { classId: '1班', report: payload, csv: 'a,b' }, T);
  assert.equal(res.status, 503);
});

test('归档只接受聚合快照,拒绝学生原始学习记录', async () => {
  const r2 = new MemoryR2();
  const s = new MemoryCourseStore();
  const env = envWith(r2);
  const bad = await archiveReport(
    s, env, teacher,
    { classId: '1班', report: JSON.stringify(learning(T, 8)), csv: '' }, T,
  );
  assert.equal(bad.status, 400);
  assert.equal(r2.objects.size, 0);
});

test('归档聚合报告到 R2,索引进 D1,可列出并取回', async () => {
  const r2 = new MemoryR2();
  const s = new MemoryCourseStore();
  const env = envWith(r2);
  const csv = '目标ID,达成率%';
  const payload = archivePayload(buildClassReport([], { now: T }));

  const put = await archiveReport(s, env, teacher, { classId: '1班', report: payload, csv }, T);
  assert.equal(put.status, 200);
  const key = String(put.body.key);
  assert.match(key, /^snapshots\/\d{4}-W\d{2}\/1班\/\d+\.json$/);
  assert.equal(r2.objects.size, 1);
  assert.equal(s.archives.size, 1);

  const list = await listArchives(s, env, teacher, '1班');
  assert.equal((list.body.items as unknown[]).length, 1);
  const read = await readArchive(s, env, teacher, key);
  assert.equal(read.status, 200);
  assert.match(String(read.body.content), /class-report-snapshot/);
  assert.equal((await readArchive(s, env, teacher, '../secret')).status, 400);
});

test('归档内容不含学生原始作答文本', async () => {
  const payload = archivePayload(buildClassReport([], { now: T }));
  const parsed = JSON.parse(payload);
  assert.equal(parsed.kind, 'class-report-snapshot');
  assert.ok(!payload.includes('answers'));
  assert.ok(!payload.includes('profile'));
});
