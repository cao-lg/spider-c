/*
 * 正式考试系统升级 · ABC 平行卷 + 切屏强交
 * 每条语句单独执行,mode=migrate。已在应用 wbapp_pIWtA1s824YYLh2DRPG7Ck 上线。
 *
 * 设计要点:
 * - exams.variants : jsonb 数组,每套 [{label,paper:[...],questionIds:[...]}]。
 *   exams.paper 仍存 A 卷(列表/成绩册显示题量用),variants=null 的老卷完全向后兼容。
 * - exam_keys.objective 合并所有套卷的判分规则(按题号 key,各套题目 id 不同故不冲突)。
 *   学生只提交自己那套的题号,submit_exam / exam_feedback 遍历 objective 时其余题号
 *   因 v_given IS NULL 自动跳过 —— 判分与逐题回看 RPC 无需改动。
 * - 分卷用 examId+uid 稳定哈希(前端 hashSeed 与服务端 hashtextexended 口径一致为
 *   "按 uid 稳定、可复现";两端算法不同但各自保证同一考生结果不变,判分不依赖卷号)。
 * - 乱序以 examId+uid+题号为种子(前端 seededShuffle),刷新不变,心跳备份与显示一致。
 */

-- ① exams 增加平行卷列 ----------------------------------------------------
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS variants jsonb;

-- ② exams 增加切屏强交阈值(0=仅记录,>0=达阈值服务端自动交卷)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS max_focus_loss integer NOT NULL DEFAULT 0;

-- ③ exam_start:按 uid 稳定分卷,下发该套 paper + 切屏阈值 -------------------
CREATE OR REPLACE FUNCTION exam_start(p_exam_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text; v_exam exams%ROWTYPE; v_profile student_profiles%ROWTYPE;
  v_sess exam_sessions%ROWTYPE; v_ends timestamptz;
  v_variants jsonb; v_vcount int := 0; v_idx int := 0; v_paper jsonb; v_label text := 'A'; v_seed bigint;
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

  v_variants := v_exam.variants;
  IF v_variants IS NOT NULL AND jsonb_typeof(v_variants) = 'array' AND jsonb_array_length(v_variants) > 0 THEN
    v_vcount := jsonb_array_length(v_variants);
    v_seed := abs(hashtextextended(p_exam_id::text || ':' || v_uid, 0));
    v_idx := (v_seed % v_vcount)::int;
    v_paper := v_variants -> v_idx -> 'paper';
    v_label := chr(65 + v_idx);
  ELSE
    v_vcount := 1; v_idx := 0; v_paper := v_exam.paper; v_label := 'A';
  END IF;

  SELECT * INTO v_sess FROM exam_sessions WHERE exam_id = p_exam_id AND owner_id = v_uid;
  IF FOUND AND v_sess.status IN ('force_submitted','submitted') THEN
    RAISE EXCEPTION '本场考试已结束';
  ELSIF FOUND AND v_sess.status = 'in_progress' THEN
    NULL;
  ELSIF FOUND AND v_sess.status = 'reset' THEN
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
    'attempts',v_sess.attempts,'broadcastMsg',v_sess.broadcast_msg,'broadcastAt',v_sess.broadcast_at,
    'paper', COALESCE(v_paper,'[]'::jsonb), 'variant', v_label, 'variantIndex', v_idx, 'variantCount', v_vcount,
    'focusLoss', v_sess.focus_loss, 'maxFocusLoss', v_exam.max_focus_loss);
END $$;

-- ④ exam_heartbeat:切屏达阈值时服务端按已答自动交卷 -----------------------
CREATE OR REPLACE FUNCTION exam_heartbeat(p_exam_id bigint, p_answers jsonb, p_answer_count integer, p_focus_loss integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text; v_exam exams%ROWTYPE; v_sess exam_sessions%ROWTYPE; v_profile student_profiles%ROWTYPE; v_ends timestamptz;
  v_focus int; v_threshold int; v_score numeric; v_final_answers jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR v_uid = '' OR v_uid = 'anon' OR v_uid = 'anonymous' THEN
    RAISE EXCEPTION '请先登录';
  END IF;
  SELECT * INTO v_sess FROM exam_sessions WHERE exam_id=p_exam_id AND owner_id=v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','none','message','尚未开始考试');
  END IF;
  IF v_sess.status <> 'in_progress' THEN
    RETURN jsonb_build_object('status', v_sess.status, 'message',
      CASE v_sess.status WHEN 'force_submitted' THEN '切屏超限或教师已强制交卷'
                         WHEN 'reset' THEN '教师已允许重做,请返回列表重新开始'
                         ELSE '本场考试已结束' END,
      'broadcastMsg', v_sess.broadcast_msg, 'broadcastAt', v_sess.broadcast_at, 'serverNow', now());
  END IF;

  v_focus := GREATEST(v_sess.focus_loss, COALESCE(p_focus_loss,0));
  v_final_answers := COALESCE(p_answers, v_sess.answers, '{}'::jsonb);
  SELECT * INTO v_exam FROM exams WHERE id=p_exam_id;
  SELECT * INTO v_profile FROM student_profiles WHERE owner_id = v_uid;
  v_threshold := COALESCE(v_exam.max_focus_loss, 0);

  UPDATE exam_sessions
     SET last_seen_at=now(), answers=v_final_answers,
         answer_count=GREATEST(0,COALESCE(p_answer_count,0)), focus_loss=v_focus
   WHERE exam_id=p_exam_id AND owner_id=v_uid;

  IF v_threshold > 0 AND v_focus >= v_threshold THEN
    v_score := exam_score_answers(p_exam_id, v_final_answers);
    INSERT INTO exam_submissions (exam_id, owner_id, class_id, student_no, answers, score, objective_score, code_score, started_at, submitted_at, duration_sec, focus_loss_count, graded)
    VALUES (p_exam_id, v_uid, v_profile.class_id, v_profile.student_no, v_final_answers, v_score, v_score, 0, v_sess.started_at, now(), 0, v_focus, true)
    ON CONFLICT (exam_id, owner_id) DO NOTHING;
    UPDATE exam_sessions SET status='force_submitted', submitted_at=now(), broadcast_msg=NULL
     WHERE exam_id=p_exam_id AND owner_id=v_uid;
    RETURN jsonb_build_object('status','force_submitted','message','切屏次数超过限制,系统已按已答部分自动交卷',
      'serverNow', now(), 'focusLoss', v_focus, 'score', v_score);
  END IF;

  SELECT * INTO v_sess FROM exam_sessions WHERE exam_id=p_exam_id AND owner_id=v_uid;
  v_ends := LEAST(
    COALESCE(v_exam.closes_at,'infinity'::timestamptz),
    v_sess.started_at + make_interval(mins=>GREATEST(1,v_exam.duration_min)) + make_interval(secs=>v_sess.extended_sec)
  );
  RETURN jsonb_build_object('status','in_progress','endsAt',v_ends,'serverNow',now(),
    'broadcastMsg',v_sess.broadcast_msg,'broadcastAt',v_sess.broadcast_at,'attempts',v_sess.attempts,
    'focusLoss', v_focus, 'maxFocusLoss', v_threshold);
END $$;
