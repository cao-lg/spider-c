"""云登录 / 我的档案 / 在线考试:页面结构与降级行为回归。

不依赖真实云会话(微信 OAuth 只能在已发布的 HTTPS 域名验证),
重点守护:登录条全站存在、未登录时正确降级、云 SDK 在本地预览不抛未捕获异常。
"""
import os
import sys
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import (  # noqa: E402
    BASE,
    Server,
    open_browser,
    record,
    summary,
)

SERVER = Server()


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        record("T-200 全站登录条与微信登录入口存在",
               page.locator("#auth-bar").count() == 1
               and page.locator("#auth-login").count() == 1)
        record("T-201 提供 uid 复制入口(教师登记用)",
               page.locator("#auth-copy").count() == 1
               and page.locator("#auth-uid").count() == 1)
        page.goto(BASE + "/tutorials/", wait_until="domcontentloaded")
        record("T-202 课程目录页同样带登录条", page.locator("#auth-bar").count() == 1)

        page.goto(BASE + "/account/", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        record("T-203 档案页未登录时显示提示并隐藏表单",
               page.locator("#account-locked").is_visible()
               and not page.locator("#account-panel").is_visible())
        record("T-204 档案页含班级/学号/姓名与 uid 复制",
               all(page.locator(sel).count() == 1 for sel in
                   ["#profile-class", "#profile-no", "#profile-name", "#account-copy"]))
        privacy = page.locator(".account-list").text_content() or ""
        record("T-205 隐私说明列出采集范围与删除方式",
               "采集:" in privacy and "删除:" in privacy)

        page.goto(BASE + "/exam/", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        record("T-206 考试页双 tab,教师 tab 默认隐藏",
               page.locator('[data-exam-tab="student"]').count() == 1
               and page.locator('[data-exam-tab="teacher"]').count() == 1
               and not page.locator('[data-exam-tab="teacher"]').is_visible())
        record("T-207 学生端未登录提示与列表/答题容器齐备",
               page.locator("#exam-locked").is_visible()
               and all(page.locator(sel).count() == 1 for sel in
                       ["#exam-list", "#exam-form", "#exam-timer", "#exam-submit"]))
        record("T-208 教师端组卷与成绩册容器齐备",
               all(page.locator(sel).count() == 1 for sel in
                   ["#exam-create", "#exam-new-unit", "#exam-grade-select", "#exam-grade-csv"]))
        # ── 免登录学习链路:不登录也能上课、记录状态、带上身份导出备份 ──
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        record("T-215 未登录状态条说明本机记录可用",
               page.locator("#identity-banner").is_visible()
               and "未登录也能完整上课" in (page.locator("#identity-banner-text").text_content() or ""))
        record("T-216 首页明确不登录可完整学习",
               "不用登录就能完整学习" in (page.locator(".hero").text_content() or ""))

        page.goto(BASE + "/report/", wait_until="domcontentloaded")
        page.wait_for_timeout(700)
        record("T-217 学习中心提供免登录的本机班级/学号",
               all(page.locator(sel).count() == 1 for sel in
                   ["#local-class", "#local-no", "#local-roster-save", "#local-roster-clear"]))
        record("T-218 学习中心说明本机/微信/口令三种用法",
               "三种用法" in (page.locator(".callout.info").first.text_content() or ""))
        page.locator("#local-class").select_option(label="2班")
        page.locator("#local-no").fill("S88")
        page.locator("#local-roster-save").click()
        roster = page.evaluate("() => JSON.parse(localStorage.getItem('crawler-course:v2') || '{}').roster || {}")
        record("T-219 免登录身份写进本机学习数据(导出备份自带)",
               roster.get("studentId") == "S88" and roster.get("classId") == "2班", roster)
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(600)
        record("T-220 刷新后本机身份自动回填",
               page.locator("#local-no").input_value() == "S88"
               and page.locator("#local-class").input_value() == "2班")
        page.locator("#local-roster-clear").click()
        roster2 = page.evaluate("() => JSON.parse(localStorage.getItem('crawler-course:v2') || '{}').roster || {}")
        record("T-221 共用电脑可一键清除本机身份", not roster2.get("studentId"), roster2)

        record("T-222 免登录链路无未捕获异常", len(errors) == 0, str(errors[:2]))

        def wait_params_gone(key, timeout=12000):
            try:
                page.wait_for_function(
                    "k => !new URL(location.href).searchParams.has(k)",
                    arg=key, timeout=timeout)
            except Exception:
                pass
            return parse_qs(urlparse(page.url).query)

        page.goto(BASE + "/?sharecode=KEEP&error=access_denied"
                 "&error_description=TEST_DENIED&code=FAKE_CODE",
                 wait_until="domcontentloaded")
        q1 = wait_params_gone("code")
        record("T-210 授权失败时清理一次性 code/error 参数",
               not any(k in q1 for k in ["code", "error", "error_description"]), q1)
        record("T-211 清理回调参数时保留业务参数 sharecode",
               q1.get("sharecode") == ["KEEP"], q1)
        record("T-212 授权失败提示不被「未登录」覆盖",
               "登录未完成" in (page.locator("#auth-status").text_content() or ""),
               page.locator("#auth-status").text_content())

        page.goto(BASE + "/?sharecode=KEEP&code=FAKE_CODE&state=FAKE_STATE&provider=wechat",
                  wait_until="domcontentloaded")
        q2 = wait_params_gone("code")
        record("T-213 回调异常路径同样清理 code/state/provider",
               not any(k in q2 for k in ["code", "state", "provider"]), q2)
        record("T-214 sharecode 在异常路径仍保留",
               q2.get("sharecode") == ["KEEP"], q2)
    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    return 0 if summary() else 1


if __name__ == "__main__":
    sys.exit(main())
