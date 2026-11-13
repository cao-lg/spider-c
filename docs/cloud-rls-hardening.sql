/*
 * spider-c / 爬虫学堂 —— 云数据库 RLS 加固脚本(已于 2026-11-13 在线上执行并验收)
 *
 * 问题:本平台匿名上下文 auth.uid() 返回字符串 'anon'(不是标准 PostgREST 的 NULL)。
 *      原策略写成 TO authenticated, anon 且只校验 owner_id = auth.uid(),
 *      因此未登录请求能直接 INSERT student_profiles / learning_snapshots
 *      (owner_id='anon')。配合 UNIQUE(class_id, student_no),可被用来抢注全班学号,
 *      使真实学生无法绑定档案。
 *
 * 处理:① 全部 17 条 SELECT/INSERT/UPDATE/DELETE 策略加 auth.uid() 非空且
 *      不等于 'anon' 的守卫;② 判分 RPC 函数体内二次拒绝 anon/anonymous。
 *
 * 关键决策:策略与函数 EXECUTE 都保留 anon 角色,不改成 TO authenticated only。
 *      因为网关可能对所有请求使用同一个数据库角色、仅靠 JWT claims 区分身份
 *      (auth.uid() 返回 'anon' 正是这种实现的迹象)。若只授权 authenticated,
 *      已登录学生反而可能交不了卷。改为「允许进入 + 入口处拒绝」更兼容也更安全。
 *
 * 执行方式:本文件为归档/复现用。DDL 通过云数据库管理工具以 mode=migrate 执行,
 *      用 DO $do$ ... EXECUTE $q$...$q$ ... END $do$; 包成单条语句可一次完成;
 *      CREATE OR REPLACE FUNCTION 需单独一条。DROP + CREATE 幂等,重复执行安全。
 *      只改策略与函数,不删表、不清数据。
 *
 * 执行后验收(匿名,只带 publishableKey + 伪造 Origin),2026-11-13 实测:
 *      GET  6 张业务表                  -> 200 [] (零泄露)
 *      POST student_profiles           -> 401 DATABASE_42501 RLS 拒绝
 *      POST learning_snapshots         -> 401 DATABASE_42501 RLS 拒绝
 *      POST exam_submissions(伪造成绩) -> 401 DATABASE_42501 RLS 拒绝
 *      POST teacher_roles / exams / exam_keys -> 401 拒绝
 *      POST rpc/submit_exam            -> 400 DATABASE_P0001「请先登录后再交卷」
 *      库内 owner_id='anon' 残留行数    -> 0 / 0 / 0
 *
 * 尚需人工验证:微信登录后的正向路径(写档案、交卷、教师白名单组卷看成绩册)。
 */

-- ① 17 条策略:全部带 anon 守卫。以下为等价的单条 DO 块,可直接执行。
DO $do$
BEGIN
EXECUTE $q$DROP POLICY IF EXISTS tr_read ON teacher_roles$q$;
EXECUTE $q$CREATE POLICY tr_read ON teacher_roles FOR SELECT TO authenticated, anon USING (auth.uid() IS NOT NULL AND auth.uid() <> '' AND auth.uid() <> 'anon')$q$;
EXECUTE $q$DROP POLICY IF EXISTS sp_read ON student_profiles$q$;
EXECUTE $q$CREATE POLICY sp_read ON student_profiles FOR SELECT TO authenticated, anon USING (auth.uid() IS NOT NULL AND auth.uid() <> 'anon' AND (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())))$q$;
EXECUTE $q$DROP POLICY IF EXISTS sp_insert ON student_profiles$q$;
EXECUTE $q$CREATE POLICY sp_insert ON student_profiles FOR INSERT TO authenticated, anon WITH CHECK (owner_id = auth.uid() AND auth.uid() IS NOT NULL AND auth.uid() <> '' AND auth.uid() <> 'anon')$q$;
EXECUTE $q$DROP POLICY IF EXISTS sp_update ON student_profiles$q$;
EXECUTE $q$CREATE POLICY sp_update ON student_profiles FOR UPDATE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon') WITH CHECK (owner_id = auth.uid() AND auth.uid() <> 'anon')$q$;
EXECUTE $q$DROP POLICY IF EXISTS sp_delete ON student_profiles$q$;
EXECUTE $q$CREATE POLICY sp_delete ON student_profiles FOR DELETE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon')$q$;
EXECUTE $q$DROP POLICY IF EXISTS ls_read ON learning_snapshots$q$;
EXECUTE $q$CREATE POLICY ls_read ON learning_snapshots FOR SELECT TO authenticated, anon USING (auth.uid() IS NOT NULL AND auth.uid() <> 'anon' AND (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())))$q$;
EXECUTE $q$DROP POLICY IF EXISTS ls_insert ON learning_snapshots$q$;
EXECUTE $q$CREATE POLICY ls_insert ON learning_snapshots FOR INSERT TO authenticated, anon WITH CHECK (owner_id = auth.uid() AND auth.uid() IS NOT NULL AND auth.uid() <> '' AND auth.uid() <> 'anon')$q$;
EXECUTE $q$DROP POLICY IF EXISTS ls_update ON learning_snapshots$q$;
EXECUTE $q$CREATE POLICY ls_update ON learning_snapshots FOR UPDATE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon') WITH CHECK (owner_id = auth.uid() AND auth.uid() <> 'anon')$q$;
EXECUTE $q$DROP POLICY IF EXISTS ls_delete ON learning_snapshots$q$;
EXECUTE $q$CREATE POLICY ls_delete ON learning_snapshots FOR DELETE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon')$q$;
EXECUTE $q$DROP POLICY IF EXISTS ex_read ON exams$q$;
EXECUTE $q$CREATE POLICY ex_read ON exams FOR SELECT TO authenticated, anon USING (auth.uid() IS NOT NULL AND auth.uid() <> 'anon' AND (published = true OR EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())))$q$;
EXECUTE $q$DROP POLICY IF EXISTS ex_insert ON exams$q$;
EXECUTE $q$CREATE POLICY ex_insert ON exams FOR INSERT TO authenticated, anon WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()))$q$;
EXECUTE $q$DROP POLICY IF EXISTS ex_update ON exams$q$;
EXECUTE $q$CREATE POLICY ex_update ON exams FOR UPDATE TO authenticated, anon USING (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())) WITH CHECK (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()))$q$;
EXECUTE $q$DROP POLICY IF EXISTS ek_read ON exam_keys$q$;
EXECUTE $q$CREATE POLICY ek_read ON exam_keys FOR SELECT TO authenticated, anon USING (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()))$q$;
EXECUTE $q$DROP POLICY IF EXISTS ek_insert ON exam_keys$q$;
EXECUTE $q$CREATE POLICY ek_insert ON exam_keys FOR INSERT TO authenticated, anon WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()))$q$;
EXECUTE $q$DROP POLICY IF EXISTS ek_update ON exam_keys$q$;
EXECUTE $q$CREATE POLICY ek_update ON exam_keys FOR UPDATE TO authenticated, anon USING (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())) WITH CHECK (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()))$q$;
EXECUTE $q$DROP POLICY IF EXISTS es_read ON exam_submissions$q$;
EXECUTE $q$CREATE POLICY es_read ON exam_submissions FOR SELECT TO authenticated, anon USING (auth.uid() <> 'anon' AND (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())))$q$;
EXECUTE $q$DROP POLICY IF EXISTS es_update ON exam_submissions$q$;
EXECUTE $q$CREATE POLICY es_update ON exam_submissions FOR UPDATE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon' AND submitted_at IS NULL) WITH CHECK (owner_id = auth.uid() AND auth.uid() <> 'anon')$q$;
EXECUTE $q$REVOKE EXECUTE ON FUNCTION submit_exam(bigint, jsonb, integer, integer) FROM PUBLIC$q$;
EXECUTE $q$GRANT EXECUTE ON FUNCTION submit_exam(bigint, jsonb, integer, integer) TO anon, authenticated$q$;
END $do$;

-- ② 判分函数:函数体第一句拒绝匿名/空 uid,其余逻辑不变(分数只由服务端答案表计算)。
CREATE OR REPLACE FUNCTION submit_exam(p_exam_id bigint, p_answers jsonb, p_duration_sec integer, p_focus_loss integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text;
  v_exam exams%ROWTYPE;
  v_key exam_keys%ROWTYPE;
  v_profile student_profiles%ROWTYPE;
  v_qid text;
  v_rule jsonb;
  v_correct jsonb;
  v_given jsonb;
  v_points numeric;
  v_score numeric := 0;
  v_submission_id bigint;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR v_uid = '' OR v_uid = 'anon' OR v_uid = 'anonymous' THEN RAISE EXCEPTION '请先登录后再交卷'; END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN RAISE EXCEPTION '作答格式不正确'; END IF;
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND published = true;
  IF NOT FOUND THEN RAISE EXCEPTION '考试不存在或尚未发布'; END IF;
  IF v_exam.opens_at IS NOT NULL AND now() < v_exam.opens_at THEN RAISE EXCEPTION '考试尚未开始'; END IF;
  IF v_exam.closes_at IS NOT NULL AND now() > v_exam.closes_at THEN RAISE EXCEPTION '考试已结束'; END IF;
  SELECT * INTO v_profile FROM student_profiles WHERE owner_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION '请先在「我的档案」填写班级、学号和姓名'; END IF;
  IF v_exam.class_id IS NOT NULL AND v_exam.class_id <> v_profile.class_id THEN RAISE EXCEPTION '本场考试不适用于你的班级'; END IF;
  IF EXISTS (SELECT 1 FROM exam_submissions WHERE exam_id = p_exam_id AND owner_id = v_uid) THEN RAISE EXCEPTION '本场考试已提交过,不能重复交卷'; END IF;
  SELECT * INTO v_key FROM exam_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION '本场考试尚未配置答案'; END IF;
  FOR v_qid, v_rule IN SELECT key, value FROM jsonb_each(v_key.objective) LOOP
    v_points := COALESCE(NULLIF(v_rule->>'points','')::numeric, 0);
    v_correct := v_rule->'answer';
    v_given := p_answers->v_qid;
    IF v_correct IS NOT NULL AND v_given IS NOT NULL AND jsonb_typeof(v_correct) = 'array' AND jsonb_typeof(v_given) = 'array' AND v_correct @> v_given AND v_given @> v_correct THEN
      v_score := v_score + v_points;
    END IF;
  END LOOP;
  INSERT INTO exam_submissions (exam_id, owner_id, class_id, student_no, answers, score, objective_score, code_score, started_at, submitted_at, duration_sec, focus_loss_count, graded)
  VALUES (p_exam_id, v_uid, v_profile.class_id, v_profile.student_no, p_answers, v_score, v_score, 0, now() - make_interval(secs => COALESCE(p_duration_sec,0)), now(), COALESCE(p_duration_sec,0), COALESCE(p_focus_loss,0), true)
  RETURNING id INTO v_submission_id;
  RETURN jsonb_build_object('submissionId', v_submission_id, 'score', v_score, 'totalScore', v_key.total_score);
END $$;

-- ③ 验收查询
SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
SELECT p.proname, p.prosecdef, p.proacl::text FROM pg_proc p WHERE p.proname = 'submit_exam';
SELECT 'student_profiles' AS t, count(*) AS anon_rows FROM student_profiles WHERE owner_id = 'anon'
UNION ALL SELECT 'learning_snapshots', count(*) FROM learning_snapshots WHERE owner_id = 'anon'
UNION ALL SELECT 'exam_submissions', count(*) FROM exam_submissions WHERE owner_id = 'anon';
