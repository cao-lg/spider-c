/*
 * 在线考试 · 监考系统表与函数（逐条执行,每条均为单语句）
 *
 * 设计要点:
 * - 乱序(题目/选项)纯前端显示层,不改 answer 值与判分 —— 见 exam-client.ts。
 * - 重做采用「教师重置」模型:保留 exam_submissions 的 UNIQUE(exam_id,owner_id),
 *   教师重置即删除旧答卷,学生重新开考,以最新一次为准。
 * - 所有写入型 RPC 为 SECURITY DEFINER,内部强制校验教师白名单或本人身份。
 */

-- ① 会话/心跳表 -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_sessions (
  exam_id        bigint      NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  owner_id       text        NOT NULL,
  class_id       text,
  student_no     text,
  real_name      text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  answer_count   integer     NOT NULL DEFAULT 0,
  answers        jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- 心跳上报的作答(云端备份+强交判分依据)
  focus_loss     integer     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'in_progress',  -- in_progress/force_submitted/reset/submitted
  attempts       integer     NOT NULL DEFAULT 1,
  extended_sec   integer     NOT NULL DEFAULT 0,
  broadcast_msg  text,
  broadcast_at   timestamptz,
  submitted_at   timestamptz,
  PRIMARY KEY (exam_id, owner_id)
);

-- ② 行级安全 -----------------------------------------------------------------
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

-- 学生读自己的会话;教师可读全部
CREATE POLICY esess_read ON exam_sessions FOR SELECT USING (
  auth.uid() IS NOT NULL AND auth.uid() <> 'anon'
  AND (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()))
);

-- 学生写入自己的会话(心跳/开始);教师可为管理写入
CREATE POLICY esess_insert ON exam_sessions FOR INSERT WITH CHECK (
  owner_id = auth.uid() AND auth.uid() <> 'anon'
);
CREATE POLICY esess_update ON exam_sessions FOR UPDATE USING (
  (owner_id = auth.uid() AND auth.uid() <> 'anon' AND status = 'in_progress')
  OR EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())
);
CREATE POLICY esess_delete ON exam_sessions FOR DELETE USING (
  EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())
);

-- 索引:教师按考试拉在线名单
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam ON exam_sessions (exam_id, last_seen_at DESC);
