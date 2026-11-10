/*
 * Cloudflare D1 表结构 —— 阶段 1 主库
 *
 * 用法:
 *   Dashboard: 进入 D1 数据库 → Console → 粘贴本文件全文 → Execute
 *   CLI 远端:  npx wrangler d1 execute spider-c-learning --remote --file=./schema.sql
 *   CLI 本地:  npx wrangler d1 execute spider-c-learning --local  --file=./schema.sql
 *
 * 重要: 这里刻意不使用 "--" 行注释。把 SQL 复制进网页 Console 时,换行有时会被压平;
 * 一旦压平,行内 "--" 会把它后面的所有内容(包括闭合括号和分号)一起注释掉,
 * 报 "incomplete input: SQLITE_ERROR"。块注释即使被压成一行也能正确闭合。
 *
 * 只存匿名学号、班级代号与学习记录快照,不存姓名/手机号/邮箱。
 * snapshots 存整包 LearningData(JSON),教师端拉回后用 class-report.ts 聚合,
 * 这样不会出现「SQL 口径」与「前端口径」不一致。
 * code_hash = SHA-256(SYNC_SALT + ':' + 同步口令),服务端不存明文;
 * sessions.token_hash 同理,令牌本身只留在学生浏览器里。
 */

CREATE TABLE IF NOT EXISTS students (
  student_id  TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);

CREATE TABLE IF NOT EXISTS snapshots (
  student_id  TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL,
  payload     TEXT NOT NULL,
  synced_at   INTEGER NOT NULL,
  revision    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_snapshots_class ON snapshots(class_id);

CREATE TABLE IF NOT EXISTS archives (
  key         TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  size        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archives_class ON archives(class_id, uploaded_at DESC);
