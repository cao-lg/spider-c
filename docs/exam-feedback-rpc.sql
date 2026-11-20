/*
 * 在线考试 · 逐题回看 RPC（mode=migrate 单条执行）
 *
 * 目的：学生交卷后可查看每题「对/错 + 得分 + 自己的作答」，但服务端
 *       绝不返回正确答案（exam_keys 对学生 RLS 不可见），与既有
 *       「正确答案不公开」约定一致。
 *
 * 判分逻辑与 submit_exam 一字不差（set / any / keyword 三种 mode），
 * 只是把结果由「总分」改为「逐题明细」。仅能查看本人已提交的答卷。
 */
CREATE OR REPLACE FUNCTION exam_feedback(p_exam_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      text;
  v_key      exam_keys%ROWTYPE;
  v_sub      exam_submissions%ROWTYPE;
  v_qid      text;
  v_rule     jsonb;
  v_mode     text;
  v_correct  jsonb;
  v_given    jsonb;
  v_points   numeric;
  v_earned   numeric;
  v_player   text;
  v_a        text;
  v_keyword  text;
  v_items    jsonb := '[]'::jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR v_uid = '' OR v_uid = 'anon' OR v_uid = 'anonymous' THEN
    RAISE EXCEPTION '请先登录后再查看成绩';
  END IF;

  -- 只能看自己已提交的答卷
  SELECT * INTO v_sub
    FROM exam_submissions
   WHERE exam_id = p_exam_id AND owner_id = v_uid AND submitted_at IS NOT NULL
   ORDER BY id DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION '你还没有该场考试的作答记录';
  END IF;

  SELECT * INTO v_key FROM exam_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '本场考试尚未配置答案';
  END IF;

  FOR v_qid, v_rule IN SELECT key, value FROM jsonb_each(v_key.objective) LOOP
    v_points  := COALESCE(NULLIF(v_rule->>'points','')::numeric, 0);
    v_mode    := COALESCE(v_rule->>'mode', 'set');
    v_correct := v_rule->'answer';
    v_given   := v_sub.answers -> v_qid;
    v_earned  := 0;

    IF v_correct IS NOT NULL AND v_given IS NOT NULL AND jsonb_typeof(v_given) = 'array' THEN
      IF v_mode = 'any' THEN
        v_player := trim(lower(COALESCE(NULLIF(v_given->>0, ''), '')));
        IF v_player <> '' THEN
          FOR v_a IN SELECT trim(lower(e.value #>> '{}')) FROM jsonb_array_elements(v_correct) e LOOP
            IF v_player = v_a THEN v_earned := v_points; EXIT; END IF;
          END LOOP;
        END IF;
      ELSIF v_mode = 'keyword' THEN
        v_player := lower(COALESCE(NULLIF(v_given->>0, ''), ''));
        IF v_player <> '' THEN
          FOR v_keyword IN SELECT lower(e.value #>> '{}') FROM jsonb_array_elements(v_correct) e LOOP
            IF position(v_keyword in v_player) > 0 THEN v_earned := v_points; EXIT; END IF;
          END LOOP;
        END IF;
      ELSE
        IF jsonb_typeof(v_correct) = 'array'
           AND v_correct @> v_given AND v_given @> v_correct THEN
          v_earned := v_points;
        END IF;
      END IF;
    END IF;

    v_items := v_items || jsonb_build_object(
      'id', v_qid,
      'correct', v_earned >= v_points AND v_points > 0,
      'points', v_points,
      'earned', v_earned
    );
  END LOOP;

  RETURN jsonb_build_object(
    'score', v_sub.score,
    'totalScore', v_key.total_score,
    'items', v_items
  );
END $$;

REVOKE EXECUTE ON FUNCTION exam_feedback(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exam_feedback(bigint) TO anon, authenticated, service_role;
