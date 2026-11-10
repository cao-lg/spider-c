-- Cloudflare D1 表结构 —— 阶段 1 主库
-- 应用: npx wrangler d1 execute spider-c-learning --remote --file=./schema.sql
-- 本地: npx wrangler d1 execute spider-c-learning --local --file=./schema.sql
--
-- 只存匿名学号、班级代号与学习记录快照,不存姓名/手机号/邮箱。
-- snapshots 存整包 LearningData(JSON),教师端拉回后用与离线模式相同的
-- class-report.ts 聚合;这样不会出现「SQL 口径」与「前端口径」不一致。

CREATE TABLE IF NOT EXISTS students (
  student_id  TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL,
  code_hash   TEXT NOT NULL,          -- SHA-256(SYNC_SALT + ':' + 同步口令),服务端不存明文
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,      -- 令牌本身只在学生浏览器里,服务端只留哈希
  student_id  TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,      -- 180 天
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);

CREATE TABLE IF NOT EXISTS snapshots (
  student_id  TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL,
  payload     TEXT NOT NULL,          -- LearningData JSON(服务端合并后写入)
  synced_at   INTEGER NOT NULL,
  revision    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_snapshots_class ON snapshots(class_id);

-- 阶段 2:R2 归档索引。R2 里放内容,D1 里只放 key 与元信息,
-- 列归档时避免 ListObjects(A 类操作)与不必要的 R2 读。
CREATE TABLE IF NOT EXISTS archives (
  key         TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  size        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_archives_class ON archives(class_id, uploaded_at DESC);
