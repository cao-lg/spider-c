"""L3 · 运行器 + 13 门课程实操题 + 自动完成 + 掌握度。"""
import sys
import os
import time
sys.path.insert(0, os.path.dirname(__file__))
from common import Server, open_browser, run_runner, store_data, record, summary, BASE

SERVER = Server()
LESSONS = [
    "01-environment", "02-http-basics", "03-requests-basics", "04-beautifulsoup",
    "05-xpath", "06-single-page", "07-pagination", "08-multi-level",
    "09-json-and-storage", "10-dynamic-pages", "11-anti-crawling", "12-ethics",
    "13-final-project",
]

# 每道题的"参考答案",用于注入到编辑器中模拟学生已完成 TODO 后提交。
# 设计意图:starter 含 TODO 占位符,运行会 FAIL;只有填入答案才能 PASS。
LESSON_ANSWERS = {
    "01-environment": """import requests
from bs4 import BeautifulSoup

print("requests 版本:", requests.__version__)
print("BeautifulSoup 就绪:", bool(BeautifulSoup))
print("环境验证 OK")
""",
    "02-http-basics": """import requests

URL = SITE_BASE + "/practice/level1-books/"
r = requests.get(URL, timeout=10)
status = r.status_code
""",
    "03-requests-basics": """import requests
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (study crawler)"}
r = requests.get(SITE_BASE + "/practice/level1-books/", headers=headers, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")
""",
    "04-beautifulsoup": """import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
titles = [td.get_text().strip() for td in soup.select("tbody tr td:nth-child(2)")]
""",
    "05-xpath": """import requests
from lxml import html

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
doc = html.fromstring(r.text)
titles = [t.strip() for t in doc.xpath("//tbody/tr/td[2]/text()")]
""",
    "06-single-page": """import requests
from bs4 import BeautifulSoup

url = SITE_BASE + "/practice/level1-books/"
r = requests.get(url, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")
""",
    "07-pagination": """import requests
from bs4 import BeautifulSoup

all_titles = []
total = 0
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"
    r = requests.get(url, timeout=10)
    r.encoding = "utf-8"
    rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
    total += len(rows)
    for row in rows:
        all_titles.append(row.select("td")[1].get_text().strip())
""",
    "08-multi-level": """import requests
from bs4 import BeautifulSoup

base = SITE_BASE + "/practice/level3-detail/"
r = requests.get(base + "books.html", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
links = [a.get("href") for a in soup.select("tbody tr td:first-child a")]

details = []
for href in links:
    r2 = requests.get(base + href, timeout=10)
    r2.encoding = "utf-8"
    doc = BeautifulSoup(r2.text, "html.parser")
    title = doc.select_one("h2").get_text().strip()
    price = doc.select_one("td.price").get_text().strip()
    details.append({"书名": title, "价格": price})
""",
    "09-json-and-storage": """import requests

books = []
total = 0
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level4-json-api/api/books/page-{page}.json"
    data = requests.get(url, timeout=10).json()
    items = data["data"]["list"]
    total += len(items)
    books.extend(items)
""",
    "10-dynamic-pages": """import requests
from bs4 import BeautifulSoup

html_text = requests.get(SITE_BASE + "/practice/level5-dynamic/", timeout=10).text
in_html = len(BeautifulSoup(html_text, "html.parser").select("#book-list li"))
api = requests.get(SITE_BASE + "/practice/level5-dynamic/api/books.json", timeout=10).json()
books = api["data"]
""",
    "11-anti-crawling": """import requests

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}
r = requests.get(SITE_BASE + "/practice/level1-books/", headers=headers, timeout=10)
""",
    "12-ethics": """import requests
from urllib.robotparser import RobotFileParser

text = requests.get(SITE_BASE + "/robots.txt", timeout=10).text
rp = RobotFileParser()
rp.parse(text.splitlines())
can_practice = rp.can_fetch("Crawler", SITE_BASE + "/practice/level1-books/")
can_private = rp.can_fetch("Crawler", SITE_BASE + "/private/")
""",
    "13-final-project": """import requests
import csv
import io
from bs4 import BeautifulSoup

records = []
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"
    r = requests.get(url, timeout=10)
    r.encoding = "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")
    for row in soup.select("tbody tr"):
        tds = row.select("td")
        records.append({
            "编号": tds[0].get_text().strip(),
            "书名": tds[1].get_text().strip(),
            "价格": tds[5].get_text().strip(),
        })

out = io.StringIO()
w = csv.DictWriter(out, fieldnames=["编号", "书名", "价格"])
w.writeheader()
w.writerows(records)
csv_text = out.getvalue()
""",
}


def inject_code(ex, code):
    editor = ex.locator(".py-runner-editor").first
    editor.evaluate("(el, ans) => { el.textContent = ans; }", code)


def main():
    SERVER.start()
    p, browser, ctx, page = open_browser()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    try:
        # T-036 课程实操 starter 必须含 TODO 占位符(数据层校验)
        page.goto(BASE + "/tutorials/01-environment/", wait_until="networkidle")
        ex0 = page.locator("py-code-exercise").first
        starter_text = ex0.evaluate("(el) => el.textContent || ''")
        record("T-036 starter 含 # TODO 占位符", "# TODO" in starter_text,
               f"len={len(starter_text)}")

        # T-038 不填答案直接运行 starter 必须 FAIL(验证刻意练习设计)
        # 仅抽测一道题(ex-01)避免时间过长
        page.goto(BASE + "/tutorials/01-environment/", wait_until="networkidle")
        ex = page.locator("py-code-exercise").first
        # 重置以确保 starter 是原始状态
        ex.locator(".py-runner-reset").first.click()
        time.sleep(0.5)
        run_runner(ex)  # 直接运行 starter(starter 中 print 完整,这条会 PASS,所以 ex-01 不适用)
        # 改测 ex-06:starter 含 # TODO,直接运行应 FAIL
        page.goto(BASE + "/tutorials/06-single-page/", wait_until="networkidle")
        ex = page.locator("py-code-exercise").first
        ex.locator(".py-runner-reset").first.click()
        time.sleep(0.5)
        st_raw = run_runner(ex)
        # run_runner 返回的是 feedback 区域文本(st 含"通过"/"未通过"/"出错"等),
        # 但也可能因 NameError 走到 error 分支
        page.wait_for_timeout(1500)
        feedback_text = ex.locator(".code-exercise-feedback").first.inner_text() if ex.locator(".code-exercise-feedback").count() > 0 else ""
        st_status = ex.locator(".py-runner-status").first.inner_text()
        failed = ("未通过" in feedback_text) or ("未通过" in st_status) or ("出错" in st_status) or ("NameError" in feedback_text)
        record("T-038 starter 直接运行不应 PASS", failed, f"status={st_status}")

        # T-010 就地练习运行器(靶站挑战模式,需先展开代码才能运行)
        page.goto(BASE + "/practice/", wait_until="networkidle")
        page.wait_for_function("() => !!customElements.get('py-runner')", timeout=10_000)
        page.wait_for_timeout(500)
        runner = page.locator("py-runner").first
        # 诊断:实际 innerHTML
        if runner.locator("details").count() == 0:
            inner = runner.evaluate("(el) => el.innerHTML.slice(0, 400)")
            cls = runner.evaluate("(el) => el.className")
            record("T-037 challenge variant 默认折叠", False,
                   f"details=0,class={cls!r},inner={inner!r}")
        else:
            is_open = runner.locator("details").first.evaluate("(el) => el.open")
            record("T-037 challenge variant 默认折叠", is_open is False, f"open={is_open}")
        # 不展开代码直接点运行,应提示先展开
        runner.locator(".py-runner-run").click()
        page.wait_for_timeout(500)
        st_status_chal = runner.locator(".py-runner-status").inner_text()
        record("T-037b 未展开代码运行被拦截",
               "请先展开代码" in st_status_chal or "先自己尝试" in st_status_chal,
               f"status={st_status_chal}")
        # 展开代码后再运行(注入完整实现,验证运行器能力)
        runner.evaluate("(el) => { const d = el.querySelector('details'); if (d) d.open = true; }")
        page.wait_for_timeout(300)
        # 注入完整实现(challenge starter 含 TODO,需先填写)
        runner.evaluate(
            "(el) => { const ed = el.querySelector('.py-runner-editor'); if (ed) ed.textContent = `import requests\nfrom bs4 import BeautifulSoup\n\nurl = SITE_BASE + \"/practice/level1-books/\"\nr = requests.get(url, timeout=10)\nr.encoding = \"utf-8\"\nsoup = BeautifulSoup(r.text, \"html.parser\")\nrows = soup.select(\"tbody tr\")\nprint(\"状态码:\", r.status_code)\nprint(\"抓到图书数:\", len(rows))`; }"
        )
        page.wait_for_timeout(300)
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

        # T-011 课程实操(注入答案后 PASS)
        scores = {}
        for slug in LESSONS:
            page.goto(f"{BASE}/tutorials/{slug}/", wait_until="networkidle")
            q = page.locator("py-code-exercise").count()
            if q == 0:
                record(f"T-011 课程实操 {slug}", False, "未找到实操题")
                continue
            ex = page.locator("py-code-exercise").first
            # 注入参考答案(starter 含 TODO,直接运行会 FAIL,这里模拟学生填好后)
            inject_code(ex, LESSON_ANSWERS[slug])
            st = run_runner(ex)
            if "通过" not in st:
                record(f"T-011 课程实操 {slug} 通过", False, st)
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

        # T-039 PASS 后展示 explanation
        page.goto(BASE + "/tutorials/01-environment/", wait_until="networkidle")
        ex = page.locator("py-code-exercise").first
        inject_code(ex, LESSON_ANSWERS["01-environment"])
        run_runner(ex)
        page.wait_for_timeout(1000)
        explanation_visible = ex.locator(".ce-explanation").count() > 0
        record("T-039 PASS 后展示解题思路", explanation_visible)

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