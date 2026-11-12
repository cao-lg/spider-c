"""云登录 / 我的档案 / 在线考试:页面结构与降级行为回归。

不依赖真实云会话(微信 OAuth 只能在已发布的 HTTPS 域名验证),
重点守护:登录条全站存在、未登录时正确降级、云 SDK 在本地预览不抛未捕获异常。
"""
import os
import sys

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
        record("T-209 云 SDK 在本地预览下无未捕获异常", len(errors) == 0, str(errors[:2]))
    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    return 0 if summary() else 1


if __name__ == "__main__":
    sys.exit(main())
