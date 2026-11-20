/*
 * 在线考试 · 监考 RPC 集合（每条单语句,mode=migrate 执行）
 * 所有函数 SECURITY DEFINER;教师类函数内部强制校验 teacher_roles 白名单。
 * 判分口径与 submit_exam 完全一致(set/any/keyword)。
 */

-- ① 公共判分函数:按答案算分(强交复用) ---------------------------------------
CREATE OR REPLACE FUNCTION exam_score_answers(p_exam_id bigint, p_answers jsonb)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key exam_keys%ROWTYPE;
  v_qid text; v_rule jsonb; v_mode text; v_correct jsonb; v_given jsonb;
  v_points numeric; v_score numeric := 0; v_player text; v_a text; v_keyword text;
BEGIN
  SELECT * INTO v_key FROM exam_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND OR p_answers IS NULL THEN RETURN 0; END IF;
  FOR v_qid, v_rule IN SELECT key, value FROM jsonb_each(v_key.objective) LOOP
    v_points := COALESCE(NULLIF(v_rule->>'points','')::numeric, 0);
    v_mode := COALESCE(v_rule->>'mode', 'set');
    v_correct := v_rule->'answer';
    v_given := p_answers -> v_qid;
    IF v_correct IS NULL OR v_given IS NULL OR jsonb_typeof(v_given) <> 'array' THEN CONTINUE; END IF;
    IF v_mode = 'any' THEN
      v_player := trim(lower(COALESCE(NULLIF(v_given->>0,''),'')));
      IF v_player <> '' THEN
        FOR v_a IN SELECT trim(lower(e.value #>> '{}')) FROM jsonb_array_elements(v_correct) e LOOP
          IF v_player = v_a THEN v_score := v_score + v_points; EXIT; END IF;
        END LOOP;
      END IF;
    ELSIF v_mode = 'keyword' THEN
      v_player := lower(COALESCE(NULLIF(v_given->>0,''),''));
      IF v_player <> '' THEN
        FOR v_keyword IN SELECT lower(e.value #>> '{}') FROM jsonb_array_elements(v_correct) e LOOP
          IF position(v_keyword in v_player) > 0 THEN v_score := v_score + v_points; EXIT; END IF;
        END LOOP;
      END IF;
    ELSE
      IF jsonb_typeof(v_correct) = 'array' AND v_correct @> v_given AND v_given @> v_correct THEN
        v_score := v_score + v_points;
      END IF;
    END IF;
  END LOOP;
  RETURN v_score;
END $$;

-- ② 学生开始考试(含重开) -----------------------------------------------------
CREATE OR REPLACE FUNCTION exam_start(p_exam_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text; v_exam exams%ROWTYPE; v_profile student_profiles%ROWTYPE;
  v_sess exam_sessions%ROWTYPE; v_ends timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR v_uid = '' OR v_uid = 'anon' OR v_uid = 'anonymous' THEN
    RAISE EXCEPTION '请先登录后再开始考试';
  END IF;
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND published = true;
  IF NOT FOUND THEN RAISE EXCEPTION '考试不存在或尚未发布'; END IF;
  SELECT * INTO v_profile FROM student_profiles WHERE owner_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION '请先在「我的档案」填写班级、学号和姓名'; END IF;
  IF v_exam.class_id IS NOT NULL AND v_exam.class_id <> v_profile.class_id THEN
    RAISE EXCEPTION '本场考试不适用于你的班级';
  END IF;
  IF v_exam.opens_at IS NOT NULL AND now() < v_exam.opens_at THEN RAISE EXCEPTION '考试尚未开始'; END IF;
  IF v_exam.closes_at IS NOT NULL AND now() > v_exam.closes_at THEN RAISE EXCEPTION '考试已结束'; END IF;
  IF EXISTS (SELECT 1 FROM exam_submissions WHERE exam_id = p_exam_id AND owner_id = v_uid) THEN
    RAISE EXCEPTION '你已交卷,不能再次作答';
  END IF;

  SELECT * INTO v_sess FROM exam_sessions WHERE exam_id = p_exam_id AND owner_id = v_uid;
  IF FOUND AND v_sess.status IN ('force_submitted','submitted') THEN
    RAISE EXCEPTION '本场考试已结束';
  ELSIF FOUND AND v_sess.status = 'in_progress' THEN
    NULL;  -- 刷新页面重进:沿用原计时
  ELSIF FOUND AND v_sess.status = 'reset' THEN
    -- 教师已允许重做:重置计时与作答(attempts 保留,已在 reset 时+1)
    UPDATE exam_sessions SET status='in_progress', answers='{}'::jsonb, answer_count=0,
      focus_loss=0, started_at=now(), last_seen_at=now(), extended_sec=0,
      broadcast_msg=NULL, broadcast_at=NULL, submitted_at=NULL
     WHERE exam_id=p_exam_id AND owner_id=v_uid;
  ELSE
    INSERT INTO exam_sessions (exam_id, owner_id, class_id, student_no, real_name, status)
    VALUES (p_exam_id, v_uid, v_profile.class_id, v_profile.student_no, v_profile.real_name, 'in_progress');
  END IF;

  SELECT * INTO v_sess FROM exam_sessions WHERE exam_id=p_exam_id AND owner_id=v_uid;
  v_ends := LEAST(
    COALESCE(v_exam.closes_at, 'infinity'::timestamptz),
    v_sess.started_at + make_interval(mins => GREATEST(1,v_exam.duration_min)) + make_interval(secs => v_sess.extended_sec)
  );
  RETURN jsonb_build_object('status','in_progress','endsAt',v_ends,'serverNow',now(),
    'attempts',v_sess.attempts,'broadcastMsg',v_sess.broadcast_msg,'broadcastAt',v_sess.broadcast_at);
END $$;

-- ③ 学生心跳/上报作答 --------------------------------------------------------
CREATE OR REPLACE FUNCTION exam_heartbeat(p_exam_id bigint, p_answers jsonb, p_answer_count integer, p_focus_loss integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text; v_exam exams%ROWTYPE; v_sess exam_sessions%ROWTYPE; v_ends timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR v_uid = '' OR v_uid = 'anon' OR v_uid = 'anonymous' THEN
    RAISE EXCEPTION '请先登录';
  END IF;
  SELECT * INTO v_sess FROM exam_sessions WHERE exam_id=p_exam_id AND owner_id=v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','none','message','尚未开始考试');
  END IF;
  -- 非进行中:只回传服务器指令,不再接受作答
  IF v_sess.status <> 'in_progress' THEN
    RETURN jsonb_build_object('status', v_sess.status, 'message',
      CASE v_sess.status WHEN 'force_submitted' THEN '教师已强制交卷'
                         WHEN 'reset' THEN '教师已允许重做,请返回列表重新开始'
                         ELSE '本场考试已结束' END,
      'broadcastMsg', v_sess.broadcast_msg, 'broadcastAt', v_sess.broadcast_at, 'serverNow', now());
  END IF;

  UPDATE exam_sessions
     SET last_seen_at=now(),
         answers=COALESCE(p_answers,'{}'::jsonb),
         answer_count=GREATEST(0,COALESCE(p_answer_count,0)),
         focus_loss=GREATEST(v_sess.focus_loss,COALESCE(p_focus_loss,0))
   WHERE exam_id=p_exam_id AND owner_id=v_uid;
  SELECT * INTO v_sess FROM exam_sessions WHERE exam_id=p_exam_id AND owner_id=v_uid;
  SELECT * INTO v_exam FROM exams WHERE id=p_exam_id;
  v_ends := LEAST(
    COALESCE(v_exam.closes_at,'infinity'::timestamptz),
    v_sess.started_at + make_interval(mins=>GREATEST(1,v_exam.duration_min)) + make_interval(secs=>v_sess.extended_sec)
  );
  RETURN jsonb_build_object('status','in_progress','endsAt',v_ends,'serverNow',now(),
    'broadcastMsg',v_sess.broadcast_msg,'broadcastAt',v_sess.broadcast_at,'attempts',v_sess.attempts);
END $$;

-- ④ 教师拉取监考名单 ---------------------------------------------------------
CREATE OR REPLACE FUNCTION exam_monitor(p_exam_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid text; v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id=v_uid) THEN
    RAISE EXCEPTION '无权访问监考数据';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'ownerId', s.owner_id, 'classId', s.class_id, 'studentNo', s.student_no,
    'realName', s.real_name, 'status', s.status, 'answerCount', s.answer_count,
    'focusLoss', s.focus_loss, 'attempts', s.attempts, 'extendedSec', s.extended_sec,
    'startedAt', s.started_at, 'lastSeenAt', s.last_seen_at,
    'online', (s.last_seen_at > now() - interval '45 seconds'),
    'submitted', EXISTS(SELECT 1 FROM exam_submissions x WHERE x.exam_id=s.exam_id AND x.owner_id=s.owner_id),
    'score', (SELECT x.score FROM exam_submissions x WHERE x.exam_id=s.exam_id AND x.owner_id=s.owner_id)
  ) ORDER BY s.last_seen_at DESC), '[]'::jsonb)
  INTO v_result FROM exam_sessions s WHERE s.exam_id = p_exam_id;
  RETURN v_result;
END $$;

-- ⑤ 教师强制交卷(按已答判分) -------------------------------------------------
CREATE OR REPLACE FUNCTION exam_force_submit(p_exam_id bigint, p_owner_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text; v_sess exam_sessions%ROWTYPE; v_score numeric; v_total numeric;
  v_started timestamptz; v_dur integer;
BEGIN
  v_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id=v_uid) THEN
    RAISE EXCEPTION '无权执行强制交卷';
  END IF;
  SELECT * INTO v_sess FROM exam_sessions WHERE exam_id=p_exam_id AND owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION '该学生没有考试会话'; END IF;
  IF v_sess.status <> 'in_progress' THEN RAISE EXCEPTION '该学生已不在作答状态'; END IF;

  v_score := exam_score_answers(p_exam_id, v_sess.answers);
  SELECT total_score INTO v_total FROM exam_keys WHERE exam_id=p_exam_id;
  v_started := COALESCE(v_sess.started_at, now());
  v_dur := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_started))::integer);

  INSERT INTO exam_submissions (exam_id, owner_id, class_id, student_no, answers, score, objective_score, code_score,
    started_at, submitted_at, duration_sec, focus_loss_count, graded)
  VALUES (p_exam_id, p_owner_id, v_sess.class_id, v_sess.student_no, v_sess.answers, v_score, v_score, 0,
    v_started, now(), v_dur, v_sess.focus_loss, true)
  ON CONFLICT (exam_id, owner_id) DO UPDATE SET
    score=EXCLUDED.score, objective_score=EXCLUDED.score, answers=EXCLUDED.answers, submitted_at=now();

  UPDATE exam_sessions SET status='force_submitted', submitted_at=now(), broadcast_msg=NULL
   WHERE exam_id=p_exam_id AND owner_id=p_owner_id;
  RETURN jsonb_build_object('score', v_score, 'totalScore', v_total);
END $$;

-- ⑥ 教师允许重做(删旧答卷+重置会话) -----------------------------------------
CREATE OR REPLACE FUNCTION exam_reset_attempt(p_exam_id bigint, p_owner_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid text;
BEGIN
  v_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id=v_uid) THEN
    RAISE EXCEPTION '无权执行重做重置';
  END IF;
  DELETE FROM exam_submissions WHERE exam_id=p_exam_id AND owner_id=p_owner_id;
  UPDATE exam_sessions
     SET status='reset', answers='{}'::jsonb, answer_count=0, focus_loss=0,
         attempts=attempts+1, extended_sec=0, broadcast_msg='教师已允许你重新作答,请返回列表重新开始',
         broadcast_at=now(), submitted_at=NULL, last_seen_at=now()
   WHERE exam_id=p_exam_id AND owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION '该学生没有考试会话'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ⑦ 教师延长时长(p_owner_id 为空=全体) ---------------------------------------
CREATE OR REPLACE FUNCTION exam_extend(p_exam_id bigint, p_owner_id text, p_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid text; v_n integer;
BEGIN
  v_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id=v_uid) THEN
    RAISE EXCEPTION '无权延长时间';
  END IF;
  IF p_owner_id IS NULL THEN
    UPDATE exam_sessions SET extended_sec=extended_sec+GREATEST(0,p_seconds),
      broadcast_msg='教师已调整考试时长', broadcast_at=now()
     WHERE exam_id=p_exam_id AND status='in_progress';
  ELSE
    UPDATE exam_sessions SET extended_sec=extended_sec+GREATEST(0,p_seconds),
      broadcast_msg='教师已为你延长答题时间', broadcast_at=now()
     WHERE exam_id=p_exam_id AND owner_id=p_owner_id AND status='in_progress';
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('affected', v_n);
END $$;

-- ⑧ 教师广播提示 -------------------------------------------------------------
CREATE OR REPLACE FUNCTION exam_broadcast(p_exam_id bigint, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid text; v_n integer;
BEGIN
  v_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id=v_uid) THEN
    RAISE EXCEPTION '无权广播';
  END IF;
  UPDATE exam_sessions SET broadcast_msg=left(COALESCE(p_message,''),200), broadcast_at=now()
   WHERE exam_id=p_exam_id AND status='in_progress';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('affected', v_n);
END $$;

-- ⑨ 教师结束考试(设截止为现在) -----------------------------------------------
CREATE OR REPLACE FUNCTION exam_end(p_exam_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid text;
BEGIN
  v_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM teacher_roles WHERE owner_id=v_uid) THEN
    RAISE EXCEPTION '无权结束考试';
  END IF;
  UPDATE exams SET closes_at=now() WHERE id=p_exam_id;
  RETURN jsonb_build_object('ok', true);
END $$;
