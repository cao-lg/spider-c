"""L3 · 运行器 + 13 门课程实操题 + 自动完成 + 掌握度。"""
import sys
import os
import time
sys.path.insert(0, os.path.dirname(__file__))
from common import Server, open_browser, run_runner, feedback_kind, store_data, record, summary, BASE

SERVER = Server()
LESSONS = [
    "01-environment", "02-http-basics", "03-requests-basics", "04-beautifulsoup",
    "05-xpath", "06-single-page", "07-pagination", "08-multi-level",
    "09-json-and-storage", "10-dynamic-pages", "11-anti-crawling", "12-ethics",
    "13-final-project",
]


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        # T-010 就地运行器演示
        page.goto(BASE + "/practice/", wait_until="networkidle")
        runner = page.locator("py-runner").first
        runner.locator(".py-runner-run").click()
        start = time.time()
        st = ""
        while time.time() - start < 150:
            st = runner.locator(".py-runner-status").inner_text()
            if "运行完成" in st or "运行出错" in st:
                break
            time.sleep(2)
        out = runner.locator(".py-runner-console").inner_text()
        record("T-010 就地运行器运行通过", "运行完成" in st and "状态码: 200" in out and "抓到图书数: 24" in out,
               f"{st} | {out.strip()[:60]}")

        # T-011/T-012/T-017 课程实操
        scores = {}
        for slug in LESSONS:
            page.goto(f"{BASE}/tutorials/{slug}/", wait_until="networkidle")
            q = page.locator("py-code-exercise").count()
            if q == 0:
                record(f"T-011 课程实操 {slug}", False, "未找到实操题")
                continue
            st = run_runner(page.locator("py-code-exercise"))
            if "通过" not in st:
                record(f"T-011 课程实操 {slug}", False, st)
                continue
            fb = page.locator(".code-exercise-score").inner_text()
            scores[slug] = fb
            record(f"T-011 课程实操 {slug} 通过", "通过" in st, fb)

        data = store_data(page)
        lessons = data.get("lessons", {})
        ok_all = all(lessons.get(s, {}).get("status") == "completed" for s in LESSONS)
        record("T-012 全部课程标记完成", ok_all,
               f"完成 {sum(1 for s in LESSONS if lessons.get(s, {}).get('status') == 'completed')}/13")

        total_score = sum(int(str(s).strip().split(" ")[-2] or 0) for s in scores.values()) if scores else 0
        record("T-012b 总分 145", total_score == 145, f"score={total_score}")

        # T-015 课程页无理论 Quiz
        page.goto(BASE + "/tutorials/03-requests-basics/", wait_until="networkidle")
        record("T-015 课程页无 py-quiz", page.locator("py-quiz").count() == 0)

        # T-017 掌握度归因
        m = lessons.get("03-requests-basics", {}).get("mastery", 0)
        record("T-017 课程掌握度>0", float(m) > 0, f"mastery={m}")

        record("T-033 无 pageerror(课程页)", len(errors) == 0, " | ".join(errors[:3]))
    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main()
