"""L5 · 10 套课程综合测试(每套 3 题)判分 + 靶站可达 + 索引页。"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from common import Server, open_browser, run_runner, store_data, record, summary, BASE

SERVER = Server()

# 10 套综合测试 × 3 题的完整答案(整体覆盖 starter,含 imports 与请求)。
# 三题统一模式:
#   t1 列表解析(rows=24) / t2 字段提取(items 名称+价格) / t3 JSON 直连(items=40)
def full_answer(cid, ti):
    base = f'SITE_BASE + "/practice/course-test-{cid}/"'
    if ti == 0:
        return f"""import requests
from bs4 import BeautifulSoup

r = requests.get({base}, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")
print("抓到行数:", len(rows))"""
    if ti == 1:
        return f"""import requests
from bs4 import BeautifulSoup

r = requests.get({base}, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")
items = [(row.select("td")[1].get_text().strip(), row.select("td")[4].get_text().strip()) for row in rows]
print("条目数:", len(items))
print("样例:", items[0] if items else None)"""
    # t3 JSON
    return f"""import requests

data = requests.get(SITE_BASE + "/practice/course-test-{cid}/api/items.json", timeout=10).json()
items = data["data"]
total = data["total"]
print("total:", total)
print("条目数:", len(items))"""


COURSE_IDS = [f"{i:02d}" for i in range(1, 11)]


def inject_code(ex, code):
    editor = ex.locator(".py-runner-editor").first
    editor.evaluate("(el, ans) => { el.textContent = ans; }", code)


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        # T-040 索引页列出 10 套
        page.goto(BASE + "/tests/", wait_until="networkidle")
        cards = page.locator(".unit-card a[href*='/tests/course/']").count()
        record("T-040 索引页含 10 套综合测试入口", cards == 10, f"cards={cards}")

        # 10 套综合测试逐套判分
        for cid in COURSE_IDS:
            page.goto(f"{BASE}/tests/course/{cid}/", wait_until="networkidle")
            q = page.locator("py-code-exercise").count()
            if q < 3:
                record(f"T-041 综合测试 {cid} 题量", False, f"count={q}")
                continue
            ok_all = True
            for ti in range(3):
                ex = page.locator("py-code-exercise").nth(ti)
                inject_code(ex, full_answer(cid, ti))
                st = run_runner(ex)
                if "通过" not in st:
                    ok_all = False
                    record(f"T-041 综合测试 {cid} 题{ti+1}", False, st)
                else:
                    sc = ex.locator(".code-exercise-score").inner_text()
                    record(f"T-041 综合测试 {cid} 题{ti+1}", True, sc)
            record(f"T-041b 综合测试 {cid} 3 题全过", ok_all)

        # 数据层:10 套 × 3 题都记入 unitTests
        data = store_data(page)
        ut = data.get("unitTests", {})
        ids = [f"course-test-{c}-t{t}" for c in COURSE_IDS for t in range(1, 4)]
        missing = [i for i in ids if i not in ut]
        record("T-042 30 个 courseTest 记录齐全", len(missing) == 0, f"missing={missing}")

        # 靶站可达性抽查(每套列表/JSON/详情),用标准库 urllib 避免额外依赖
        import urllib.request as ureq
        bad = []
        for cid in COURSE_IDS:
            for suffix in ("/", "/api/items.json", "/detail/index.html"):
                url = f"{BASE}/practice/course-test-{cid}{suffix}"
                try:
                    with ureq.urlopen(url, timeout=10) as resp:
                        if resp.status != 200:
                            bad.append(f"{cid}{suffix}:{resp.status}")
                except Exception as e:  # noqa: BLE001
                    bad.append(f"{cid}{suffix}:{e}")
        record("T-043 30 个靶站资源可达", len(bad) == 0, " | ".join(bad[:5]))

        record("T-033 无 pageerror(综合测试页)", len(errors) == 0, " | ".join(errors[:3]))
    finally:
        browser.close()
        p.stop()
        SERVER.stop()

    sys.exit(0 if summary() else 1)


if __name__ == "__main__":
    main()