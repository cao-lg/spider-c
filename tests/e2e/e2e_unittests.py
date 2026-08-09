"""L3/L4 · 5 个单元 15 道实操题判分 + 数据归因不误标课程。"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from common import Server, open_browser, run_runner, feedback_kind, store_data, record, summary, BASE

SERVER = Server()

# 15 道实操题的补全答案(对应 src/data/tasks.ts 的 check 判定)
ANSWERS = {
    "unit-test-1": [
        'status = r.status_code\nprint("状态码:", status)',
        'titles = [td.get_text().strip() for td in soup.select("tbody tr td:nth-child(2)")]\nprint("书名数:", len(titles))',
        'prices = [row.select("td")[5].get_text().strip() for row in rows[:5]]\nprint("价格:", prices)',
    ],
    "unit-test-2": [
        'books = [(row.select("td")[1].get_text().strip(), row.select("td")[5].get_text().strip()) for row in soup.select("tbody tr")]\nprint("条数:", len(books))',
        'titles = doc.xpath("//tbody/tr/td[2]/text()")\nprint("书名数:", len(titles))',
        'links = [a.get("href") for a in soup.select("tbody tr td:first-child a")]\nprint("详情链接数:", len(links))',
    ],
    "unit-test-3": [
        'print("累计图书:", total)',
        'print("详情页数:", len(details))',
        'print("JSON 图书数:", len(books))',
    ],
    "unit-test-4": [
        'books = requests.get(SITE_BASE + "/practice/level5-dynamic/api/books.json", timeout=10).json()["data"]\nprint("接口返回:", len(books))',
        'print("状态码:", r.status_code, "| UA:", r.request.headers.get("User-Agent"))',
        'print("不存在页面状态码:", not_found)',
    ],
    "unit-test-5": [
        'print("允许 /practice/:", rp.can_fetch("Crawler", SITE_BASE + "/practice/level1-books/"))\nprint("禁止 /private/:", rp.can_fetch("Crawler", SITE_BASE + "/private/"))',
        'print("总数:", len(books), "| 去重后:", len(set(books)))',
        'print("CSV 行数:", len(csv_text.strip().splitlines()))',
    ],
}

UNITS = ["unit-1", "unit-2", "unit-3", "unit-4", "unit-5"]


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        for ui, unit in enumerate(UNITS):
            key = f"unit-test-{ui + 1}"
            page.goto(f"{BASE}/tests/{unit}/", wait_until="networkidle")
            for ti in range(3):
                ex = page.locator("py-code-exercise").nth(ti)
                editor = ex.locator(".py-runner-editor").first
                editor.evaluate(
                    "(el, ans) => { el.textContent = el.textContent.replace('# === TODO 补全 ===', ans); }",
                    ANSWERS[key][ti],
                )
                st = run_runner(ex)
                if "通过" not in st:
                    record(f"T-013 {unit} 实操{ti+1} 判分", False, st)
                else:
                    sc = ex.locator(".code-exercise-score").inner_text()
                    record(f"T-013 {unit} 实操{ti+1} 判分", True, sc)

        # 数据层:单元测只记 unitTest,不标课程
        data = store_data(page)
        ut = data.get("unitTests", {})
        ids = [f"unit-test-{n}-t{t}" for n in range(1, 6) for t in range(1, 4)]
        missing = [i for i in ids if i not in ut]
        record("T-014 15 个 unitTest 记录齐全", len(missing) == 0, f"missing={missing}")

        lessons = data.get("lessons", {})
        completed = sum(1 for v in lessons.values() if v.get("status") == "completed")
        record("T-014b 单元测作答不标课程完成", completed == 0, f"completed={completed}")

        best = max((a.get("score", 0) for a in ut.get("unit-test-1-t1", [])), default=0)
        record("T-014c 最佳得分已记录", best == 10, f"bestScore={best}")

        record("T-033 无 pageerror(单元测页)", len(errors) == 0, " | ".join(errors[:3]))
    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main()
