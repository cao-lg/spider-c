"""L1/L2/L5 · 构建静态、结构导航、靶站一致性。"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from common import Server, open_browser, record, summary, BASE

SERVER = Server()


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        # ---- 页面可访问性 ----
        routes = ["/", "/tutorials/", "/practice/", "/report/"]
        for r in routes:
            resp = page.goto(BASE + r, wait_until="networkidle")
            record(f"T-002 页面 200: {r}", resp.status == 200, f"status={resp.status}")
            title = page.title()
            record(f"T-002b 标题含站点名: {r}", "爬虫学堂" in title, title)

        # 课程页 + 单元测页
        lesson_slugs = [
            "01-environment", "02-http-basics", "03-requests-basics", "04-beautifulsoup",
            "05-xpath", "06-single-page", "07-pagination", "08-multi-level",
            "09-json-and-storage", "10-dynamic-pages", "11-anti-crawling", "12-ethics",
            "13-final-project",
        ]
        for s in lesson_slugs:
            page.goto(f"{BASE}/tutorials/{s}/", wait_until="networkidle")
            ok = page.locator("h1").count() == 1
            record(f"T-003 课程页 200: {s}", ok)

        for u in ["unit-1", "unit-2", "unit-3", "unit-4", "unit-5"]:
            page.goto(f"{BASE}/tests/{u}/", wait_until="networkidle")
            n = page.locator("py-code-exercise").count()
            record(f"T-004 单元测 {u} 有 3 道实操题", n == 3, f"count={n}")

        # ---- 导航 ----
        page.goto(BASE + "/report/", wait_until="networkidle")
        nav_items = page.locator(".main-nav a").count()
        record("T-005 导航 4 项", nav_items == 4, f"count={nav_items}")
        active = page.locator(".main-nav a.active").inner_text()
        record("T-005b 学习中心高亮", active == "学习中心", active)

        page.goto(BASE + "/", wait_until="networkidle")
        record("T-006 首页统计含课程数 13", "13" in page.locator(".stat-num").first.inner_text())
        page.goto(BASE + "/tutorials/", wait_until="networkidle")
        record("T-007 课程目录 5 单元卡片", page.locator(".unit-card").count() >= 5)
        page.goto(BASE + "/practice/", wait_until="networkidle")
        record("T-008 靶站索引 Level 卡片", page.locator(".unit-card").count() >= 5)

        # ---- 靶站一致性 ----
        page.goto(BASE + "/practice/level1-books/", wait_until="networkidle")
        rows = page.locator("tbody tr").count()
        first_price = page.locator("tbody tr").first.locator("td.price").inner_text()
        record("T-022 Level1 24 行", rows == 24, f"rows={rows}")
        record("T-022b Level1 价格含¥", first_price.startswith("¥"), first_price)

        page.goto(BASE + "/practice/level2-pagination/page/10.html", wait_until="networkidle")
        titles = page.evaluate("() => document.querySelectorAll('tbody tr td:nth-child(2)').length")
        record("T-023 Level2 每页 10 行", titles == 10, f"rows={titles}")

        page.goto(BASE + "/practice/level3-detail/books.html", wait_until="networkidle")
        links = page.locator("tbody tr td:first-child a").count()
        record("T-024 Level3 列表 20 链接", links == 20, f"links={links}")

        resp = page.request.get(BASE + "/practice/level4-json-api/api/books/page-1.json")
        j = resp.json()
        record("T-025 Level4 JSON total 200/10 页",
               j["data"]["total"] == 200 and j["data"]["totalPages"] == 10,
               f"total={j['data']['total']}")

        raw = page.request.get(BASE + "/practice/level5-dynamic/").text()
        between = raw.split('id="book-list"')[1].split("</ul>")[0]
        in_html = between.count("<li")
        resp = page.request.get(BASE + "/practice/level5-dynamic/api/books.json")
        n56 = len(resp.json()["data"])
        record("T-026 Level5 源码空/接口 56", in_html == 0 and n56 == 56, f"html={in_html} api={n56}")

        resp = page.request.get(BASE + "/robots.txt")
        text = resp.text()
        record("T-027 robots.txt 允许practice/禁private",
               "Disallow: /private/" in text, "robots ok")

        record("T-033 无 pageerror(静态页)", len(errors) == 0, " | ".join(errors[:3]))
    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main()
