// Cloudflare Pages Functions 共享后端
//
// 设计取舍(为什么不是「每生一个 JSON 直接扔 R2」):
//   · 浏览器不能直连 R2 —— 静态站前端是公开的,把 API 密钥写进去等于公开发布。
//   · R2 没有查询、没有事务;整包覆盖写在两台设备同时同步时必然丢记录。
//     本文件在服务端用与 store / 教师端完全相同的 mergeLearningData 合并,再做 UPSERT。
//   · D1 存整包快照,教师端拉回后在浏览器内跑同一套 class-report 引擎。
//     这样阶段 0 离线报告与阶段 1 在线报告口径完全一致,不需要再写一套 SQL 聚合。
//   · R2 只做阶段 2 的周快照归档,见 archiveReport。
//
// 本文件不依赖 @cloudflare/workers-types(避免为了类型装一套本地跑不起来的依赖),
// Env / D1 / R2 的最小接口就地声明;业务逻辑是纯函数式调用 CourseStore,
// 因此 tests/unit/functions.test.ts 可以用内存实现做全链路验证,不需要 Cloudflare 账号。

import { migrate } from '../../src/lib/schema.ts';
import { mergeLearningData, countAttempts } from '../../src/lib/merge.ts';
import type { LearningData } from '../../src/lib/types.ts';

// ── Workers 运行时最小类型 ──────────────────────────────────────

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface R2ObjectBody {
  text(): Promise<string>;
  size: number;
}

export interface R2ObjectInfo {
  key: string;
  size: number;
  uploaded?: Date;
}

export interface R2Bucket {
  put(key: string, value: string, options?: { customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  list(options?: { prefix?: string }): Promise<{ objects: R2ObjectInfo[] }>;
}

export interface Env {
  DB: D1Database;
  /** 阶段 2 才绑定;未绑定时归档接口返回 503,不影响阶段 1 */
  ARCHIVE?: R2Bucket;
  /** 教师口令,wrangler secret put TEACHER_TOKEN */
  TEACHER_TOKEN: string;
  /** 同步码 / 会话 token 的服务端盐,wrangler secret put SYNC_SALT */
  SYNC_SALT: string;
}

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown> = {}): ApiResult => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, error: string): ApiResult => ({ status, body: { ok: false, error } });

// ── 存储接口(生产 D1 / 测试内存,两份实现同一契约) ────────────────

export interface StudentRow {
  studentId: string;
  classId: string;
  codeHash: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionRow {
  tokenHash: string;
  studentId: string;
  expiresAt: number;
  createdAt: number;
}

export interface SnapshotRow {
  studentId: string;
  classId: string;
  payload: string;
  syncedAt: number;
  revision: number;
}

export interface ClassRow {
  classId: string;
  students: number;
  lastSyncAt: number;
}

export interface ArchiveRow {
  key: string;
  classId: string;
  uploadedAt: number;
  size: number;
}

export interface CourseStore {
  getStudent(studentId: string): Promise<StudentRow | null>;
  putStudent(row: StudentRow): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRow | null>;
  putSession(row: SessionRow): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  getSnapshot(studentId: string): Promise<SnapshotRow | null>;
  putSnapshot(row: SnapshotRow): Promise<void>;
  deleteStudent(studentId: string): Promise<void>;
  listClasses(): Promise<ClassRow[]>;
  listStudents(classId?: string): Promise<SnapshotRow[]>;
  putArchive(row: ArchiveRow): Promise<void>;
  listArchives(classId?: string): Promise<ArchiveRow[]>;
}

export class D1CourseStore implements CourseStore {
  // 不用 constructor(private db: ...) 参数属性:
  // Node 22 的 strip-only 类型剥离不支持该语法,单测无法直接 import 后端。
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getStudent(studentId: string): Promise<StudentRow | null> {
    const row = await this.db
      .prepare('SELECT student_id, class_id, code_hash, created_at, updated_at FROM students WHERE student_id = ?')
      .bind(studentId)
      .first<{
        student_id: string; class_id: string; code_hash: string; created_at: number; updated_at: number;
      }>();
    return row
      ? {
          studentId: row.student_id,
          classId: row.class_id,
          codeHash: row.code_hash,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : null;
  }

  async putStudent(r: StudentRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO students (student_id, class_id, code_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET class_id = excluded.class_id, updated_at = excluded.updated_at`,
      )
      .bind(r.studentId, r.classId, r.codeHash, r.createdAt, r.updatedAt)
      .run();
  }

  async getSession(tokenHash: string): Promise<SessionRow | null> {
    const row = await this.db
      .prepare('SELECT token_hash, student_id, expires_at, created_at FROM sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .first<{ token_hash: string; student_id: string; expires_at: number; created_at: number }>();
    return row
      ? {
          tokenHash: row.token_hash,
          studentId: row.student_id,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
        }
      : null;
  }

  async putSession(r: SessionRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO sessions (token_hash, student_id, expires_at, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET expires_at = excluded.expires_at`,
      )
      .bind(r.tokenHash, r.studentId, r.expiresAt, r.createdAt)
      .run();
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  async getSnapshot(studentId: string): Promise<SnapshotRow | null> {
    const row = await this.db
      .prepare('SELECT student_id, class_id, payload, synced_at, revision FROM snapshots WHERE student_id = ?')
      .bind(studentId)
      .first<{
        student_id: string; class_id: string; payload: string; synced_at: number; revision: number;
      }>();
    return row
      ? {
          studentId: row.student_id,
          classId: row.class_id,
          payload: row.payload,
          syncedAt: row.synced_at,
          revision: row.revision,
        }
      : null;
  }

  async putSnapshot(r: SnapshotRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO snapshots (student_id, class_id, payload, synced_at, revision) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(student_id) DO UPDATE SET
           class_id = excluded.class_id, payload = excluded.payload,
           synced_at = excluded.synced_at, revision = snapshots.revision + 1`,
      )
      .bind(r.studentId, r.classId, r.payload, r.syncedAt, r.revision)
      .run();
  }

  async deleteStudent(studentId: string): Promise<void> {
    const db = this.db;
    await db.prepare('DELETE FROM snapshots WHERE student_id = ?').bind(studentId).run();
    await db.prepare('DELETE FROM sessions WHERE student_id = ?').bind(studentId).run();
    await db.prepare('DELETE FROM students WHERE student_id = ?').bind(studentId).run();
  }

  async listClasses(): Promise<ClassRow[]> {
    const res = await this.db
      .prepare(
        `SELECT class_id, COUNT(*) AS students, MAX(synced_at) AS last_sync_at
         FROM snapshots GROUP BY class_id ORDER BY class_id`,
      )
      .all<{ class_id: string; students: number; last_sync_at: number }>();
    return res.results.map((r) => ({
      classId: r.class_id,
      students: Number(r.students),
      lastSyncAt: Number(r.last_sync_at ?? 0),
    }));
  }

  async listStudents(classId?: string): Promise<SnapshotRow[]> {
    const stmt = classId
      ? this.db
          .prepare('SELECT student_id, class_id, payload, synced_at, revision FROM snapshots WHERE class_id = ? ORDER BY student_id')
          .bind(classId)
      : this.db.prepare('SELECT student_id, class_id, payload, synced_at, revision FROM snapshots ORDER BY student_id');
    const res = await stmt.all<{
      student_id: string; class_id: string; payload: string; synced_at: number; revision: number;
    }>();
    return res.results.map((r) => ({
      studentId: r.student_id,
      classId: r.class_id,
      payload: r.payload,
      syncedAt: Number(r.synced_at),
      revision: Number(r.revision),
    }));
  }

  async putArchive(r: ArchiveRow): Promise<void> {
    await this.db
      .prepare('INSERT INTO archives (key, class_id, uploaded_at, size) VALUES (?, ?, ?, ?)')
      .bind(r.key, r.classId, r.uploadedAt, r.size)
      .run();
  }

  async listArchives(classId?: string): Promise<ArchiveRow[]> {
    const stmt = classId
      ? this.db
          .prepare('SELECT key, class_id, uploaded_at, size FROM archives WHERE class_id = ? ORDER BY uploaded_at DESC LIMIT 100')
          .bind(classId)
      : this.db.prepare('SELECT key, class_id, uploaded_at, size FROM archives ORDER BY uploaded_at DESC LIMIT 100');
    const res = await stmt.all<{ key: string; class_id: string; uploaded_at: number; size: number }>();
    return res.results.map((r) => ({
      key: r.key,
      classId: r.class_id,
      uploadedAt: Number(r.uploaded_at),
      size: Number(r.size),
    }));
  }
}

// ── 安全工具 ────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 常量时间比较,避免用 === 比较口令时泄露前缀 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearer(header: string | null): string {
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function isTeacher(env: Env, header: string | null): boolean {
  const expected = env.TEACHER_TOKEN ?? '';
  const given = bearer(header);
  // 未配置口令时一律拒绝,绝不因为空字符串而放行
  return expected.length >= 8 && given.length > 0 && safeEqual(given, expected);
}

async function requireSession(
  store: CourseStore,
  env: Env,
  header: string | null,
  now: number,
): Promise<StudentRow | null> {
  const token = bearer(header);
  if (!token) return null;
  const hash = await sha256(`${env.SYNC_SALT}:token:${token}`);
  const session = await store.getSession(hash);
  if (!session || session.expiresAt <= now) return null;
  return store.getStudent(session.studentId);
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const ID_RE = /^[A-Za-z0-9_-]{2,24}$/;
const CLASS_RE = /^[\p{L}\p{N}_-]{1,16}$/u;
export const MAX_PAYLOAD = 262_144; // 256 KB,120 人规模绰绰有余

// ── 学生端业务 ──────────────────────────────────────────────────

/** 注册 / 登录:同一学号 + 同一同步码可换设备登录,口令不一致则拒绝 */
export async function enroll(
  store: CourseStore,
  env: Env,
  body: Record<string, unknown>,
  now = Date.now(),
): Promise<ApiResult> {
  const studentId = String(body.studentId ?? '').trim();
  const classId = String(body.classId ?? '').trim();
  const code = String(body.code ?? '');
  if (!ID_RE.test(studentId)) return fail(400, '学号只能是 2–24 位字母、数字、下划线或短横线,请勿填写真实姓名。');
  if (!CLASS_RE.test(classId)) return fail(400, '班级代号不超过 16 个字符。');
  if (code.length < 6) return fail(400, '同步口令至少 6 位。');

  const codeHash = await sha256(`${env.SYNC_SALT}:code:${code}`);
  const existing = await store.getStudent(studentId);
  if (existing && !safeEqual(existing.codeHash, codeHash)) {
    return fail(401, '该学号已被注册,同步口令不匹配。请联系教师重置。');
  }
  await store.putStudent({
    studentId,
    classId,
    codeHash,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  const token = randomToken();
  const tokenHash = await sha256(`${env.SYNC_SALT}:token:${token}`);
  await store.putSession({ tokenHash, studentId, expiresAt: now + 180 * 86400000, createdAt: now });
  return ok({ token, studentId, classId, expiresAt: now + 180 * 86400000 });
}

/** 上报:服务端合并已有快照,绝不整包覆盖 */
export async function pushSnapshot(
  store: CourseStore,
  env: Env,
  header: string | null,
  body: Record<string, unknown>,
  now = Date.now(),
): Promise<ApiResult> {
  const student = await requireSession(store, env, header, now);
  if (!student) return fail(401, '同步会话无效或已过期,请重新启用云同步。');
  const incoming = migrate(body.data);
  if (!incoming) return fail(400, '学习数据结构无法识别,请确认来自本课程的备份。');
  if (JSON.stringify(incoming).length > MAX_PAYLOAD) return fail(413, '数据量超过单次上限。');

  const current = await store.getSnapshot(student.studentId);
  let merged: LearningData = incoming;
  let revision = 1;
  if (current) {
    try {
      const prior = migrate(JSON.parse(current.payload));
      if (prior) {
        merged = mergeLearningData(prior, incoming);
        revision = current.revision + 1;
      }
    } catch {
      // 云端旧快照损坏:以本次上报为准,但保留 revision 递增
      revision = current.revision + 1;
    }
  }
  // 名册以服务端为准,防止客户端冒用别人的学号
  merged.roster = { studentId: student.studentId, classId: student.classId };
  await store.putSnapshot({
    studentId: student.studentId,
    classId: student.classId,
    payload: JSON.stringify(merged),
    syncedAt: now,
    revision,
  });
  return ok({ syncedAt: now, revision, attempts: countAttempts(merged) });
}

export async function pullSnapshot(
  store: CourseStore,
  env: Env,
  header: string | null,
  now = Date.now(),
): Promise<ApiResult> {
  const student = await requireSession(store, env, header, now);
  if (!student) return fail(401, '同步会话无效或已过期,请重新启用云同步。');
  const snap = await store.getSnapshot(student.studentId);
  return ok({
    studentId: student.studentId,
    classId: student.classId,
    syncedAt: snap?.syncedAt ?? 0,
    data: snap ? JSON.parse(snap.payload) : null,
  });
}

/** 学生行使删除权:连同快照与会话一起清除 */
export async function deleteOwn(
  store: CourseStore,
  env: Env,
  header: string | null,
  now = Date.now(),
): Promise<ApiResult> {
  const student = await requireSession(store, env, header, now);
  if (!student) return fail(401, '同步会话无效或已过期。');
  await store.deleteStudent(student.studentId);
  return ok({ deleted: student.studentId });
}

// ── 教师端业务 ──────────────────────────────────────────────────

export async function overview(
  store: CourseStore,
  env: Env,
  header: string | null,
): Promise<ApiResult> {
  if (!isTeacher(env, header)) return fail(401, '教师口令不正确。');
  return ok({ classes: await store.listClasses() });
}

export async function classData(
  store: CourseStore,
  env: Env,
  header: string | null,
  classId: string,
): Promise<ApiResult> {
  if (!isTeacher(env, header)) return fail(401, '教师口令不正确。');
  const rows = await store.listStudents(classId || undefined);
  const students = rows.map((r) => {
    let data: unknown = null;
    try {
      data = JSON.parse(r.payload);
    } catch {
      /* 单条损坏不影响整班 */
    }
    return {
      studentId: r.studentId,
      classId: r.classId,
      syncedAt: r.syncedAt,
      revision: r.revision,
      data,
    };
  });
  return ok({ students });
}

export async function deleteStudent(
  store: CourseStore,
  env: Env,
  header: string | null,
  studentId: string,
): Promise<ApiResult> {
  if (!isTeacher(env, header)) return fail(401, '教师口令不正确。');
  if (!ID_RE.test(studentId)) return fail(400, '学号格式不正确。');
  await store.deleteStudent(studentId);
  return ok({ deleted: studentId });
}

// ── 阶段 2:R2 归档 ──────────────────────────────────────────────

function isoWeek(now: number): string {
  const d = new Date(now);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function archiveReport(
  store: CourseStore,
  env: Env,
  header: string | null,
  body: Record<string, unknown>,
  now = Date.now(),
): Promise<ApiResult> {
  if (!isTeacher(env, header)) return fail(401, '教师口令不正确。');
  if (!env.ARCHIVE) return fail(503, '尚未绑定 R2 归档桶,请先在 Pages 设置里添加 ARCHIVE 绑定。');
  const classId = String(body.classId ?? 'all').slice(0, 16);
  const report = String(body.report ?? '');
  const csv = String(body.csv ?? '');
  if (!report || report.length > MAX_PAYLOAD) return fail(400, '归档内容为空或超出上限。');
  // 归档只接受聚合报告,不接受学生原始学习记录
  let parsed: unknown;
  try {
    parsed = JSON.parse(report);
  } catch {
    return fail(400, '归档内容不是合法 JSON。');
  }
  if (!parsed || typeof parsed !== 'object' || (parsed as { kind?: string }).kind !== 'class-report-snapshot') {
    return fail(400, '只允许归档教师端生成的聚合快照。');
  }

  const key = `snapshots/${isoWeek(now)}/${classId}/${now}.json`;
  const content = JSON.stringify({ report: parsed, csv, uploadedAt: now, classId });
  await env.ARCHIVE.put(key, content, { customMetadata: { classId, kind: 'class-report-snapshot' } });
  await store.putArchive({ key, classId, uploadedAt: now, size: content.length });
  return ok({ key, size: content.length });
}

export async function listArchives(
  store: CourseStore,
  env: Env,
  header: string | null,
  classId: string,
): Promise<ApiResult> {
  if (!isTeacher(env, header)) return fail(401, '教师口令不正确。');
  return ok({ items: await store.listArchives(classId || undefined) });
}

export async function readArchive(
  store: CourseStore,
  env: Env,
  header: string | null,
  key: string,
): Promise<ApiResult> {
  if (!isTeacher(env, header)) return fail(401, '教师口令不正确。');
  if (!env.ARCHIVE) return fail(503, '尚未绑定 R2 归档桶。');
  if (!key.startsWith('snapshots/') || key.includes('..')) return fail(400, '归档键不合法。');
  const obj = await env.ARCHIVE.get(key);
  if (!obj) return fail(404, '归档不存在。');
  return ok({ key, size: obj.size, content: await obj.text() });
}
