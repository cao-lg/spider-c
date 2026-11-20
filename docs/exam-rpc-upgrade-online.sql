/*
 * 单条版本 —— 直接粘贴进 WorkBuddy 云数据库 SQL 工具,以 mode=migrate 执行。
 * (云数据库每次只接受一条语句;已去掉文件末尾的 SELECT 验收语句,单独另跑即可)
 *
 * 作用:把 submit_exam 判分函数升级为支持 填空(any) / 简答(keyword) / 多选&编程(set)。
 * 老卷子无 mode 字段默认 set,行为不变。仅覆盖同名函数,可重复执行(幂等)。
 */
CREATE OR REPLACE FUNCTION submit_exam(p_exam_id bigint, p_answers jsonb, p_duration_sec integer, p_focus_loss integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text;
  v_exam exams%ROWTYPE;
  v_key exam_keys%ROWTYPE;
  v_profile student_profiles%ROWTYPE;
  v_qid text;
  v_rule jsonb;
  v_mode text;
  v_correct jsonb;
  v_given jsonb;
  v_points numeric;
  v_score numeric := 0;
  v_submission_id bigint;
  v_player text;
  v_g text;
  v_a text;
  v_keyword text;
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
    v_mode := COALESCE(v_rule->>'mode', 'set');
    v_correct := v_rule->'answer';
    v_given := p_answers->v_qid;

    IF v_correct IS NULL OR v_given IS NULL OR jsonb_typeof(v_given) <> 'array' THEN
      CONTINUE;
    END IF;

    IF v_mode = 'any' THEN
      v_player := trim(lower(COALESCE(NULLIF(v_given->>0, ''), '')));
      IF v_player <> '' THEN
        FOR v_a IN SELECT trim(lower(e.value #>> '{}')) FROM jsonb_array_elements(v_correct) e LOOP
          IF v_player = v_a THEN
            v_score := v_score + v_points;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    ELSIF v_mode = 'keyword' THEN
      v_player := lower(COALESCE(NULLIF(v_given->>0, ''), ''));
      IF v_player <> '' THEN
        FOR v_keyword IN SELECT lower(e.value #>> '{}') FROM jsonb_array_elements(v_correct) e LOOP
          IF position(v_keyword in v_player) > 0 THEN
            v_score := v_score + v_points;
            EXIT;
          END IF;
        END LOOP;
      END IF;
    ELSE
      IF jsonb_typeof(v_correct) = 'array'
         AND v_correct @> v_given AND v_given @> v_correct THEN
        v_score := v_score + v_points;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO exam_submissions (exam_id, owner_id, class_id, student_no, answers, score, objective_score, code_score, started_at, submitted_at, duration_sec, focus_loss_count, graded)
  VALUES (p_exam_id, v_uid, v_profile.class_id, v_profile.student_no, p_answers, v_score, v_score, 0, now() - make_interval(secs => COALESCE(p_duration_sec,0)), now(), COALESCE(p_duration_sec,0), COALESCE(p_focus_loss,0), true)
  RETURNING id INTO v_submission_id;
  RETURN jsonb_build_object('submissionId', v_submission_id, 'score', v_score, 'totalScore', v_key.total_score);
END $$;
