"""v2 概念题 / 错题本 / 教学设计页 的端到端验证。

覆盖链路:选错 → 诊断反馈 → 学习数据落库 → 错题本聚合 → 就地重练 → 消除。
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import (  # noqa: E402
    BASE,
    Server,
    get_code,
    open_browser,
    record,
    run_runner,
    set_code,
    store_data,
    summary,
)

SERVER = Server()


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        # ── 1. 概念题:选错要有诊断,不是只报答案 ──────────────────
        page.goto(BASE + "/tutorials/02-http-basics/", wait_until="networkidle")
        quiz = page.locator("section[data-quiz]").first
        record("T-101 课内概念检查点存在", quiz.count() > 0)

        q1 = page.locator(".quiz-q").first
        qid = q1.get_attribute("data-qid")
        answers = json.loads(q1.get_attribute("data-answers") or "[]")
        correct_idx = int(answers[0]) if answers else 0
        n_opts = q1.locator(".quiz-opt").count()
        wrong_idx = next(i for i in range(n_opts) if i != correct_idx)

        q1.locator(".quiz-opt").nth(wrong_idx).click()
        page.locator("[data-quiz-submit]").first.click()
        page.wait_for_timeout(300)

        fb_text = q1.locator(".quiz-fb").inner_text()
        record("T-102 错误选项给出诊断(非仅答案)", "诊断" in fb_text, fb_text[:60].replace("\n", " "))
        record("T-102b 同时给出正确答案与解析", "正确答案" in fb_text and "解析" in fb_text)
        record("T-103 正确选项被标出", q1.locator(".quiz-opt.is-answer").count() == 1)

        data = store_data(page)
        record("T-104 概念作答写入 concepts", bool(data and data.get("concepts")), str(list((data or {}).get("concepts", {}).keys())))
        mistakes = (data or {}).get("mistakes", {})
        record("T-105 错题按题落库", len(mistakes) == 1, f"count={len(mistakes)}")
        rec = next(iter(mistakes.values()), {})
        record("T-105b 错题带误区标签", bool(rec.get("misconception")), str(rec.get("misconception")))
        record("T-105c 未作答的题不进入错题本", len(mistakes) == 1, f"count={len(mistakes)}")

        # ── 2. 错题本:聚合、标签、就地重练 ─────────────────────────
        page.goto(BASE + "/mistakes/", wait_until="networkidle")
        page.wait_for_timeout(200)
        cards = page.locator(".mistake-card")
        record("T-106 错题本展示 1 条待消除记录", cards.count() == 1, f"count={cards.count()}")
        record("T-106b 显示误区中文标签", page.locator(".tag-chip.static").count() >= 1)
        record("T-107 统计卡显示待消除数量", page.locator("#stat-open").inner_text().strip() == "1")

        cards.first.locator("button", has_text="就地重练").click()
        page.wait_for_timeout(200)
        retry = page.locator(".retry-opt")
        record("T-108 重练面板展开", retry.count() == n_opts, f"count={retry.count()}")
        retry.nth(correct_idx).click()
        page.wait_for_timeout(1400)
        record("T-109 答对后错题消除", page.locator(".mistake-card").count() == 0,
               f"count={page.locator('.mistake-card').count()}")

        # ── 3. 代码编辑器 + 判题链路 ───────────────────────────────
        page.goto(BASE + "/tutorials/01-environment/", wait_until="networkidle")
        ex = page.locator("py-code-exercise").first
        original = get_code(ex)
        record("T-110 编辑器可读取初始代码", "# TODO" in original, original[:30].replace("\n", " "))
        set_code(ex, "import requests\nfrom bs4 import BeautifulSoup\nprint('环境就绪', requests.__version__)\n")
        record("T-111 编辑器可写入", "环境就绪" in get_code(ex))

        st = run_runner(ex, timeout=180)
        record("T-112 浏览器内判题给出结论", ("通过" in st) or ("未通过" in st) or ("出错" in st), st)
        record("T-113 通过后记录 passed", "通过" in st and "未通过" not in st, st)

        # ── 4. 教学设计页 ─────────────────────────────────────────
        page.goto(BASE + "/design/", wait_until="networkidle")
        record("T-114 13 张设计卡", page.locator(".design-card").count() == 13,
               f"count={page.locator('.design-card').count()}")
        record("T-115 先修关系图渲染", page.locator(".prereq-graph").count() == 1)
        record("T-116 认知层级分布渲染", page.locator(".bloom-bar-row").count() == 4)
        record("T-117 无「未覆盖」目标", page.locator(".design-cov em").count() == 0)

        record("T-118 全流程无 JS 异常", len(errors) == 0, " | ".join(errors[:2]))

    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    ok = summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
