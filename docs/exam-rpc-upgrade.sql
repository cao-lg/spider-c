/*
 * spider-c / 爬虫学堂 —— 在线考试判分 RPC 升级脚本(支持多题型)
 *
 * 背景:原 submit_exam 只按「答案集合相等」判分,只适配 choice / truefalse。
 *      为支持考试的 多选(multi) / 填空(fill) / 简答(short) / 编程(code),
 *      判分函数需按 objective 规则里的 mode 字段分派:
 *
 *        mode='set'     (choice / truefalse / multi / code)
 *                       学生答案集合与参考答案集合完全相等,漏选/多选/错选均不得分。
 *        mode='any'     (fill)
 *                       学生提交的单个字符串命中可接受答案的任一项即得分
 *                       (大小写不敏感、忽略首尾空白)。
 *        mode='keyword' (short)
 *                       学生提交的文本包含任一关键词即得分(大小写不敏感)。
 *
 * 兼容性:老卷子 exam_keys.objective 里没有 mode 字段,默认为 'set',行为不变。
 *
 * 执行方式:在云数据库管理工具以 mode=migrate 执行本文件(与 cloud-rls-hardening.sql 相同),
 *      先用下方 CREATE OR REPLACE FUNCTION 覆盖旧函数。函数体末尾 RETURN 结构不变,
 *      学生端与教师端无需改动即可读回新判分结果。
 *
 * 注意:code 题的判分在浏览器端通过 Pyodide 完成,学生按下「运行并判分」后把
 *      ['PASS'] / ['FAIL'] 作为答案提交,服务端按 mode='set' 对 ['PASS'] 判分。
 *      为便于教师复盘,学生同时会把代码以 ['', 'code:<源码>'] 形式提交,
 *      其中第一个元素为空(避免误判得分),代码全文落在 answers 里可查。
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
      -- 填空:学生提交的单个值命中任一可接受答案(大小写不敏感)
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
      -- 简答:学生文本包含任一关键词(大小写不敏感)
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
      -- set:集合相等(choice / truefalse / multi / code),兼容无 mode 的老卷子
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

-- 验收:确认函数存在且授权未变
SELECT p.proname, p.prosecdef::int AS definer FROM pg_proc p WHERE p.proname = 'submit_exam';
