/*
 * spider-c / 爬虫学堂 —— 云数据库 RLS 加固脚本
 *
 * 问题:本平台匿名上下文 auth.uid() 返回字符串 'anon'。原来所有写策略都写成
 *      TO authenticated, anon 且只校验 owner_id = auth.uid(),因此未登录请求
 *      可以直接 INSERT student_profiles / learning_snapshots(owner_id='anon')。
 *      配合 UNIQUE(class_id, student_no),可被用来抢注学号,让真实学生无法绑定档案。
 *
 * 处理:所有写策略追加 auth.uid() 非空且不等于 'anon' 的守卫;判分 RPC 收回
 *      anon 的 EXECUTE,并在函数体内再次校验,形成双保险。
 *
 * 执行方式:每行一条语句,逐条执行;DROP POLICY IF EXISTS + CREATE POLICY
 *      可重复运行,重复执行不会破坏已有数据。只改策略,不删表、不清数据。
 *
 * 执行后验收(匿名、只带 publishableKey):
 *      POST /student_profiles        -> 42501 / RLS 拒绝
 *      POST /learning_snapshots      -> 42501 / RLS 拒绝
 *      POST /rpc/submit_exam         -> 42501 permission denied for function
 *      GET  /exam_keys               -> [] (答案表仍不可见)
 * 真实微信登录后:档案可写、考试可交卷、教师白名单内可组卷与看成绩册。
 */

DROP POLICY IF EXISTS sp_insert ON student_profiles;
CREATE POLICY sp_insert ON student_profiles FOR INSERT TO authenticated, anon WITH CHECK (owner_id = auth.uid() AND auth.uid() IS NOT NULL AND auth.uid() <> '' AND auth.uid() <> 'anon');

DROP POLICY IF EXISTS sp_update ON student_profiles;
CREATE POLICY sp_update ON student_profiles FOR UPDATE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon') WITH CHECK (owner_id = auth.uid() AND auth.uid() <> 'anon');

DROP POLICY IF EXISTS sp_delete ON student_profiles;
CREATE POLICY sp_delete ON student_profiles FOR DELETE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon');

DROP POLICY IF EXISTS ls_insert ON learning_snapshots;
CREATE POLICY ls_insert ON learning_snapshots FOR INSERT TO authenticated, anon WITH CHECK (owner_id = auth.uid() AND auth.uid() IS NOT NULL AND auth.uid() <> '' AND auth.uid() <> 'anon');

DROP POLICY IF EXISTS ls_update ON learning_snapshots;
CREATE POLICY ls_update ON learning_snapshots FOR UPDATE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon') WITH CHECK (owner_id = auth.uid() AND auth.uid() <> 'anon');

DROP POLICY IF EXISTS ls_delete ON learning_snapshots;
CREATE POLICY ls_delete ON learning_snapshots FOR DELETE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon');

DROP POLICY IF EXISTS ex_insert ON exams;
CREATE POLICY ex_insert ON exams FOR INSERT TO authenticated, anon WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS ex_update ON exams;
CREATE POLICY ex_update ON exams FOR UPDATE TO authenticated, anon USING (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())) WITH CHECK (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS ek_insert ON exam_keys;
CREATE POLICY ek_insert ON exam_keys FOR INSERT TO authenticated, anon WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS ek_update ON exam_keys;
CREATE POLICY ek_update ON exam_keys FOR UPDATE TO authenticated, anon USING (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid())) WITH CHECK (auth.uid() <> 'anon' AND EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS es_update ON exam_submissions;
CREATE POLICY es_update ON exam_submissions FOR UPDATE TO authenticated, anon USING (owner_id = auth.uid() AND auth.uid() <> 'anon' AND submitted_at IS NULL) WITH CHECK (owner_id = auth.uid() AND auth.uid() <> 'anon');

REVOKE EXECUTE ON FUNCTION submit_exam(bigint, jsonb, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_exam(bigint, jsonb, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION submit_exam(p_exam_id bigint, p_answers jsonb, p_duration_sec integer, p_focus_loss integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

/* 验收查询:确认所有写策略都带 anon 守卫 */
SELECT tablename, policyname, cmd, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
