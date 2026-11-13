"""在线考试 · 登录态全流程回归(仿真云数据面,不写真实数据)。

为什么需要仿真:微信 OAuth 只能由真人在已发布域名上扫码,自动化环境拿不到
有效会话。这里向 localStorage 注入 SDK 会话结构(workbuddy-cloud.session.<key>),
并用 Playwright route 拦截 /.cloud/database/rest/*,在浏览器里复现 PostgREST
响应与服务端判分逻辑,从而端到端驱动真实前端 UI。

用法:
    python tests/e2e/e2e_exam_flow.py                         # 线上分享链接
    E2E_BASE=http://localhost:4321 E2E_SHARE= python ...      # 本地 astro preview

注意:本脚本验证前端行为与前后端数据契约,不替代真实登录后的 RLS 放行验证。
"""

from playwright.sync_api import sync_playwright
from urllib.parse import urlparse, parse_qs
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get('E2E_BASE', 'https://crawler-course.app.workbuddy.host').rstrip('/')
SHARE = os.environ.get('E2E_SHARE', 'LIT7NR26I5')
LAND = BASE + ('/?sharecode=' + SHARE if SHARE else '/')
CHROME = os.environ.get('CHROME_PATH', r'C:\Program Files\Google\Chrome\Application\chrome.exe')
UID = 'wu:oYQVK6jHoX2iVYk4OQ9AW0MgQ2ew'
NOW = '2026-11-13T12:00:00.000Z'

publishable_key = None
for bundle in (ROOT / 'dist' / '_astro').glob('*.js'):
    hit = re.search(r'wbpk_[A-Za-z0-9_]{20,}', bundle.read_text(encoding='utf-8', errors='replace'))
    if hit:
        publishable_key = hit.group(0)
        break
if not publishable_key:
    sys.exit('缺少 publishableKey:请先 npm run build')

SESSION = {
    'accessToken': 'probe-token',
    'refreshToken': 'probe-refresh',
    'expiresAt': 9999999999999,
    'user': {'id': UID, 'name': '联调教师', 'avatarUrl': '', 'isAnonymous': False, 'raw': {'sub': UID}},
}

state = {'profile': None, 'snapshot': None, 'exams': [], 'keys': {}, 'subs': [], 'next_id': 1}
results = []


def record(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('[PASS] ' if ok else '[FAIL] ') + name + ((' -- ' + str(detail)[:160]) if detail else ''))


def eq_value(query, key):
    raw = query.get(key, [''])[0]
    return raw.split('eq.', 1)[1] if raw.startswith('eq.') else None


def dispatch(table, method, query, body):
    row = body if isinstance(body, dict) else (body[0] if isinstance(body, list) and body else {})

    if table == 'rpc/submit_exam':
        exam_id = int(row.get('p_exam_id', 0))
        answers = row.get('p_answers') or {}
        key = state['keys'].get(exam_id, {})
        score = 0
        for question_id, rule in (key.get('objective') or {}).items():
            correct = rule.get('answer') or []
            given = answers.get(question_id) or []
            if isinstance(correct, list) and isinstance(given, list) and sorted(map(str, correct)) == sorted(map(str, given)):
                score += float(rule.get('points') or 0)
        state['subs'].append({
            'exam_id': exam_id, 'owner_id': UID,
            'class_id': state['profile']['class_id'], 'student_no': state['profile']['student_no'],
            'score': score, 'submitted_at': NOW,
            'duration_sec': int(row.get('p_duration_sec') or 0),
            'focus_loss_count': int(row.get('p_focus_loss') or 0),
        })
        return 200, {'submissionId': len(state['subs']), 'score': score, 'totalScore': key.get('total_score', 0)}

    if table == 'teacher_roles':
        return 200, [{'owner_id': UID}]

    if table == 'student_profiles':
        if method == 'GET':
            return 200, [dict(state['profile'])] if state['profile'] else []
        if method == 'DELETE':
            state['profile'] = None
            return 200, [{'id': 1}]
        state['profile'] = {
            'id': 1, 'owner_id': UID,
            'class_id': row.get('class_id') or (state['profile'] or {}).get('class_id', '1班'),
            'student_no': row.get('student_no', 'T001'),
            'real_name': row.get('real_name', '联调测试'),
        }
        return 201, [{'id': 1}]

    if table == 'learning_snapshots':
        if method == 'GET':
            return 200, [{'payload': state['snapshot'], 'updated_at': NOW}] if state['snapshot'] else []
        if method == 'DELETE':
            state['snapshot'] = None
            return 200, [{'id': 1}]
        state['snapshot'] = row.get('payload') or {'schema': 2, 'courses': {}}
        return 201, [{'id': 1}]

    if table == 'exams':
        if method == 'GET':
            rows = list(state['exams'])
            if eq_value(query, 'published') == 'true':
                rows = [r for r in rows if r['published']]
            return 200, rows
        if method == 'PATCH':
            exam_id = int(eq_value(query, 'id') or 0)
            for item in state['exams']:
                if item['id'] == exam_id:
                    item.update(row)
            return 200, [{'id': exam_id}]
        exam_id = state['next_id']
        state['next_id'] += 1
        created = dict(row)
        created.update({'id': exam_id, 'created_at': NOW, 'published': False})
        state['exams'].append(created)
        return 201, [{'id': exam_id}]

    if table == 'exam_keys':
        if method == 'POST':
            state['keys'][int(row.get('exam_id', 0))] = dict(row)
            return 201, []
        return 200, []

    if table == 'exam_submissions':
        return 200, list(state['subs']) if method == 'GET' else []

    return 200, []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROME, args=['--no-sandbox'])
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page_errors, console_errors = [], []
        page.on('pageerror', lambda e: page_errors.append(str(e)))
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
        page.on('dialog', lambda d: d.accept())

        def handle(route):
            request = route.request
            url = urlparse(request.url)
            query = parse_qs(url.query)
            table = url.path.split('/rest/', 1)[-1]
            body = {}
            if request.post_data:
                try:
                    body = json.loads(request.post_data)
                except ValueError:
                    body = {}
            status, payload = dispatch(table, request.method, query, body)
            route.fulfill(status=status, body=json.dumps(payload, ensure_ascii=False),
                          headers={'content-type': 'application/json', 'access-control-allow-origin': BASE})

        page.route('**/.cloud/**', handle)
        page.goto(LAND, wait_until='domcontentloaded', timeout=60000)
        page.evaluate('([k,v])=>localStorage.setItem(k,JSON.stringify(v))',
                      ['workbuddy-cloud.session.' + publishable_key, SESSION])

        print('=== A. 我的档案 ===')
        page.goto(BASE + '/account/', wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(1200)
        record('档案面板可见', page.locator('#account-panel').is_visible())
        page.locator('#profile-class').select_option(label='1班')
        page.locator('#profile-no').fill('T001')
        page.locator('#profile-name').fill('联调测试')
        page.locator('#profile-save').click()
        page.wait_for_timeout(800)
        record('保存档案成功', '已保存到云端' in page.locator('#profile-msg').inner_text())
        page.locator('#snap-push').click()
        page.wait_for_timeout(600)
        record('上传学习记录成功', '已上传' in page.locator('#snap-msg').inner_text())
        page.locator('#snap-pull').click()
        page.wait_for_timeout(600)
        record('从云端恢复成功', '已从云端恢复' in page.locator('#snap-msg').inner_text())
        page.goto(BASE + '/account/', wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(900)
        record('刷新后档案回填', page.locator('#profile-no').input_value() == 'T001'
               and page.locator('#profile-name').input_value() == '联调测试')

        print('=== B. 教师组卷 ===')
        page.goto(BASE + '/exam/', wait_until='domcontentloaded', timeout=60000)
        page.wait_for_timeout(1400)
        teacher_tab = page.locator('[data-exam-tab="teacher"]')
        record('教师 tab 可见(白名单生效)', teacher_tab.is_visible())
        record('刷新列表按钮存在', page.locator('#exam-refresh').count() == 1)
        teacher_tab.click()
        page.wait_for_timeout(700)
        record('教师面板可见', page.locator('#exam-admin-body').is_visible())
        units = [o.get_attribute('value') for o in page.locator('#exam-new-unit option').all()]
        page.locator('#exam-new-title').fill('联调测试卷')
        page.locator('#exam-new-code').fill('e2e-probe-01')
        try:
            page.locator('#exam-new-class').select_option(label='1班')
        except Exception:
            page.locator('#exam-new-class').select_option(index=1)
        page.locator('#exam-new-unit').select_option(value=next(u for u in units if u))
        page.locator('#exam-new-count').fill('3')
        page.locator('#exam-new-points').fill('10')
        page.locator('#exam-new-duration').fill('30')
        page.locator('#exam-create').click()
        page.wait_for_timeout(1100)
        record('创建并发布成功', '已发布' in page.locator('#exam-create-msg').inner_text(),
               page.locator('#exam-create-msg').inner_text())
        record('试卷出现在管理列表', '联调测试卷' in page.locator('#exam-admin-list').inner_text())
        record('试卷快照有 3 题', len(state['exams'][0]['paper']) == 3 if state['exams'] else False)
        record('答案表已写入', bool(state['keys']))
        record('发布后学生端自动同步(无需 F5)',
               '开始考试' in (page.locator('#exam-list').text_content() or ''))

        print('=== C. 学生答题交卷 ===')
        page.locator('[data-exam-tab="student"]').click()
        page.wait_for_timeout(700)
        record('学生端看到已发布试卷', '开始考试' in page.locator('#exam-list').inner_text())
        record('档案警告消失', not page.locator('#exam-profile-warn').is_visible())
        page.locator('[data-exam-start]').first.click()
        page.wait_for_timeout(500)
        record('答题界面可见', page.locator('#exam-runner').is_visible())
        record('渲染题目数正确', page.locator('#exam-form fieldset').count() == 3)
        # 按服务端答案表逐题勾选,锁死「前端 radio value ↔ exam_keys.objective.answer」契约。
        objective = state['keys'].get(1, {}).get('objective', {})
        for fieldset in page.locator('#exam-form fieldset').all():
            name = fieldset.locator('input[type=radio]').first.get_attribute('name')
            for value in objective.get(name, {}).get('answer', []):
                fieldset.locator(f'input[type=radio][value="{value}"]').check()
        page.locator('#exam-submit').click()
        page.wait_for_timeout(1100)
        record('交卷出分', '本场得分' in page.locator('#exam-result').inner_text())
        record('判分 RPC 收到答案并记分', bool(state['subs']) and state['subs'][0]['score'] is not None,
               state['subs'][0]['score'] if state['subs'] else None)
        record('按正确答案作答得满分(答案格式契约)', bool(state['subs']) and state['subs'][0]['score'] == 30,
               state['subs'][0]['score'] if state['subs'] else None)

        print('=== D. 教师成绩册 ===')
        page.locator('[data-exam-tab="teacher"]').click()
        page.wait_for_timeout(600)
        options = [o.get_attribute('value') for o in page.locator('#exam-grade-select option').all()]
        page.locator('#exam-grade-select').select_option(value=next(o for o in options if o))
        page.locator('#exam-grade-load').click()
        page.wait_for_timeout(800)
        table = page.locator('#exam-grade-table').inner_text()
        record('成绩册显示学号/姓名/分数', 'T001' in table and '联调测试' in table, table[:120])
        record('成绩条数提示正确', '共 1 条答卷' in page.locator('#exam-grade-msg').inner_text())
        try:
            with page.expect_download(timeout=8000) as info:
                page.locator('#exam-grade-csv').click()
            record('CSV 可导出且文件名正确', '成绩册.csv' in info.value.suggested_filename,
                   info.value.suggested_filename)
        except Exception as error:
            record('CSV 可导出且文件名正确', False, str(error)[:100])

        print('=== E. 稳定性 ===')
        record('无未捕获脚本异常', not page_errors, page_errors[:3])
        serious = [e for e in console_errors if 'favicon' not in e.lower()]
        record('无严重控制台错误', not serious, serious[:3])
        browser.close()

    passed = sum(1 for _, ok in results if ok)
    print()
    print(f'SUMMARY: {passed}/{len(results)}')
    print('FAILED:', [name for name, ok in results if not ok])
    return 0 if passed == len(results) else 1


if __name__ == '__main__':
    sys.exit(main())
