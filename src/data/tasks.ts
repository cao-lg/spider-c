// 实操题题库 —— 每课一个代码实战,每个单元测试一组自动判定的实操题
// 全部在浏览器运行器(Pyodide)里真写代码、真打靶站,由 check 自动判定。

export interface TaskDef {
  id: string;
  title: string;
  starter: string;
  check: string;
  hint?: string;
  explanation?: string;
  skills: string[];
  maxScore: number;
}

/** 课程代码实战(完整参考代码,学生运行/修改/提交) */
export const lessonTasks: Record<string, TaskDef> = {
  '01-environment': {
    id: 'ex-01-environment',
    title: '实战:验证环境',
    skills: [],
    maxScore: 5,
    starter: `import requests
from bs4 import BeautifulSoup

print("requests 版本:", requests.__version__)
print("BeautifulSoup 就绪:", bool(BeautifulSoup))
print("环境验证 OK")`,
    check: `assert requests.__version__, "requests 未正确导入"
assert 'BeautifulSoup' in globals() and BeautifulSoup, "bs4 未正确导入"
print("环境验证通过")`,
    explanation: 'requests 与 BeautifulSoup 是整门课的基础库,环境就绪后即可开始实操。',
  },
  '02-http-basics': {
    id: 'ex-02-http',
    title: '实战:发起第一个请求',
    skills: ['请求'],
    maxScore: 10,
    starter: `import requests

url = SITE_BASE + "/practice/level1-books/"
r = requests.get(url, timeout=10)
status = r.status_code
print("状态码:", status)
print("响应体字节数:", len(r.content))`,
    check: `assert 'status' in globals() and status == 200, f"状态码应为 200,实际 {status}"
assert len(r.text) > 0, "响应体为空"`,
    explanation: 'HTTP 状态码 200 表示请求成功。这是所有爬虫的第一步。',
  },
  '03-requests-basics': {
    id: 'ex-03-requests',
    title: '实战:requests 完整请求',
    skills: ['请求'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (study crawler)"}
r = requests.get(SITE_BASE + "/practice/level1-books/", headers=headers, timeout=10)
r.encoding = "utf-8"
rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
print("状态码:", r.status_code)
print("抓到图书行数:", len(rows))`,
    check: `assert r.status_code == 200, "请求失败"
assert 'python-requests' not in r.request.headers.get('User-Agent', ''), "请设置自定义 User-Agent"
assert 'rows' in globals() and len(rows) == 24, f"应抓到 24 行,实际 {len(rows)}"`,
    explanation: '带自定义请求头 + 修正编码 + 设置超时,是生产级爬虫的基本功。',
  },
  '04-beautifulsoup': {
    id: 'ex-04-level1',
    title: '实战:BeautifulSoup 提取书名',
    skills: ['解析'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
titles = [td.get_text().strip() for td in soup.select("tbody tr td:nth-child(2)")]
print("书名数量:", len(titles))
print("前 3 本:", titles[:3])`,
    check: `assert 'titles' in globals() and len(titles) == 24, f"应提取 24 个书名,实际 {len(titles)}"
assert titles[0].startswith("Java"), "第 1 个书名提取有误"`,
    explanation: 'CSS 选择器 tbody tr td:nth-child(2) 定位到每行的书名列。',
  },
  '05-xpath': {
    id: 'ex-05-xpath',
    title: '实战:XPath 提取书名',
    skills: ['解析'],
    maxScore: 10,
    starter: `import requests
from lxml import html

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
doc = html.fromstring(r.text)
titles = doc.xpath("//tbody/tr/td[2]/text()")
print("书名数量:", len(titles))
print("前 3 本:", titles[:3])`,
    check: `assert 'titles' in globals() and len(titles) == 24, f"XPath 应提取 24 个书名,实际 {len(titles)}"
assert all(t.strip() for t in titles), "存在空白书名"`,
    explanation: 'XPath //tbody/tr/td[2]/text() 直接取第 2 列文本,与 CSS 选择器殊途同归。',
  },
  '06-single-page': {
    id: 'ex-06-level1',
    title: '实战:抓取 Level 1 图书榜',
    skills: ['解析'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

url = SITE_BASE + "/practice/level1-books/"
r = requests.get(url, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# 解析表格,把每一行数据保存到变量 rows
rows = soup.select("tbody tr")
print("抓到图书数:", len(rows))
for row in rows[:3]:
    tds = row.select("td")
    print(tds[1].get_text(), "|", tds[5].get_text())`,
    check: `assert isinstance(rows, list), "未找到变量 rows,请先把表格行存入 rows"
assert len(rows) == 24, f"应抓到 24 本书,实际 {len(rows)} 本"
first = rows[0].select("td")
assert len(first) == 7, "每行应有 7 个单元格(编号/书名/作者/出版社/日期/价格/评分)"
title = first[1].get_text().strip()
price = first[5].get_text().strip()
assert title.startswith("Java"), "第一本书应为 Java 相关图书,请检查选择器"
assert price.startswith("¥"), "价格列提取有误,请确认第 6 个 td(价格)"`,
    explanation: '你已掌握单页爬取的完整流程:requests 请求 → r.encoding 修正编码 → BeautifulSoup 定位 → 提取字段。',
  },
  '07-pagination': {
    id: 'ex-07-level2',
    title: '实战:翻遍 10 页榜单',
    skills: ['分页'],
    maxScore: 10,
    starter: `import requests
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
print("累计图书数:", total)`,
    check: `assert 'total' in globals() and total == 100, f"应累计 100 本,实际 {total}"
assert len(all_titles) == 100, "书名收集不完整"
assert len(set(all_titles)) == 100, "书名存在重复"`,
    explanation: '循环拼接 page/N.html 翻页是分页爬取的核心套路。',
  },
  '08-multi-level': {
    id: 'ex-08-level3',
    title: '实战:列表页 + 详情页',
    skills: ['分页', '请求'],
    maxScore: 15,
    starter: `import requests
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
print("详情页数量:", len(details))
print("样例:", details[0] if details else None)`,
    check: `assert 'links' in globals() and len(links) == 20, f"应提取 20 个详情链接,实际 {len(links)}"
assert 'details' in globals() and len(details) == 20, f"应抓取 20 个详情页,实际 {len(details)}"
assert all(d["书名"] and d["价格"].startswith("¥") for d in details), "详情字段提取有误"`,
    explanation: '两级爬取:先抓列表页的全部详情链接,再逐个请求并解析详情页。',
  },
  '09-json-and-storage': {
    id: 'ex-09-level4',
    title: '实战:直连 JSON 接口',
    skills: ['存储', '请求'],
    maxScore: 15,
    starter: `import requests

books = []
total = 0
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level4-json-api/api/books/page-{page}.json"
    data = requests.get(url, timeout=10).json()
    items = data["data"]["list"]
    total += len(items)
    books.extend(items)
print("累计图书数:", total)
print("接口声明总数:", data["data"]["total"])`,
    check: `assert 'books' in globals() and len(books) == 200, f"应收集 200 本,实际 {len(books)}"
assert 'title' in books[0], "JSON 结构解析有误"`,
    explanation: '直接请求 JSON 接口比解析 HTML 高效得多,返回结构 data.list 逐层取出即可。',
  },
  '10-dynamic-pages': {
    id: 'ex-10-level5',
    title: '实战:看穿动态页面',
    skills: ['反爬', '请求'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

html_text = requests.get(SITE_BASE + "/practice/level5-dynamic/", timeout=10).text
in_html = len(BeautifulSoup(html_text, "html.parser").select("#book-list li"))

api = requests.get(SITE_BASE + "/practice/level5-dynamic/api/books.json", timeout=10).json()
books = api["data"]
print("HTML 中书籍数:", in_html, "| 接口返回:", len(books))`,
    check: `assert in_html == 0, "页面源码里不应直接包含书籍数据(动态渲染)"
assert 'books' in globals() and len(books) == 56, f"接口应返回 56 本,实际 {len(books)}"`,
    explanation: '源码里抓不到数据?八成是 JS 动态渲染。找到底层 JSON 接口直接请求,效率最高。',
  },
  '11-anti-crawling': {
    id: 'ex-11-anti',
    title: '实战:伪装浏览器 UA',
    skills: ['反爬'],
    maxScore: 10,
    starter: `import requests

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}
r = requests.get(SITE_BASE + "/practice/level1-books/", headers=headers, timeout=10)
print("状态码:", r.status_code)
print("实际发送的 UA:", r.request.headers.get("User-Agent"))`,
    check: `assert r.status_code == 200, "请求失败"
ua = r.request.headers.get("User-Agent", "")
assert 'python-requests' not in ua, "仍在用默认 UA,请伪装成浏览器"
assert 'Mozilla' in ua, "UA 应形如浏览器(包含 Mozilla)"`,
    explanation: 'requests 默认 UA 含 python-requests,容易被识别。设置浏览器风格的 UA 是基础伪装。',
  },
  '12-ethics': {
    id: 'ex-12-robots',
    title: '实战:读懂 robots.txt',
    skills: [],
    maxScore: 10,
    starter: `import requests
from urllib.robotparser import RobotFileParser

text = requests.get(SITE_BASE + "/robots.txt", timeout=10).text
rp = RobotFileParser()
rp.parse(text.splitlines())
print("robots.txt 内容:")
print(text)
print("可以抓取 /practice/?", rp.can_fetch("Crawler", SITE_BASE + "/practice/level1-books/"))
print("可以抓取 /private/?", rp.can_fetch("Crawler", SITE_BASE + "/private/"))`,
    check: `assert 'text' in globals() and 'Disallow' in text, "未读到 robots.txt 或缺少 Disallow 规则"
assert rp.can_fetch("Crawler", SITE_BASE + "/practice/level1-books/"), "应允许抓取 /practice/"
assert not rp.can_fetch("Crawler", SITE_BASE + "/private/"), "应禁止抓取 /private/"`,
    explanation: 'robots.txt 是站点的访问声明,用 RobotFileParser 判断某路径是否允许抓取,是合规爬虫的第一步。',
  },
  '13-final-project': {
    id: 'ex-13-project',
    title: '综合实战:全量抓取并导出 CSV',
    skills: ['请求', '解析', '分页', '反爬', '存储'],
    maxScore: 20,
    starter: `import requests
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
print("写入记录数:", len(records))
print("文件行数(含表头):", len(csv_text.strip().splitlines()))`,
    check: `assert 'records' in globals() and len(records) == 100, f"应抓取 100 条记录,实际 {len(records)}"
assert 'csv_text' in globals() and csv_text.startswith("编号"), "CSV 缺少表头"
assert len(csv_text.strip().splitlines()) == 101, "CSV 应为 1 行表头 + 100 行数据"`,
    explanation: '请求 → 解析 → 存储,完整串联整门课的核心技能,并用 csv 模块导出标准表格。',
  },
};

/** 单元测试 · 实操题(带 TODO,需学生补全代码) */
export const unitTestTasks: Record<string, TaskDef[]> = {
  'unit-test-1': [
    {
      id: 'unit-test-1-t1',
      title: '实操题 1:记录状态码与行数',
      skills: ['请求'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
# === TODO 补全 ===`,
      check: `assert 'status' in globals() and status == 200, f"状态码应为 200,实际 {status}"
assert len(rows) == 24, f"应抓到 24 行,实际 {len(rows)}"`,
      hint: '把 r.status_code 保存到变量 status,再 print 出来。',
      explanation: '单元一实操 1 完成:请求 + 状态码 + 行数统计。',
    },
    {
      id: 'unit-test-1-t2',
      title: '实操题 2:自定义请求头提取书名',
      skills: ['请求', '解析'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (test exam)"}
r = requests.get(SITE_BASE + "/practice/level1-books/", headers=headers, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
# === TODO 补全 ===`,
      check: `assert len(titles) == 24, f"应提取 24 个书名,实际 {len(titles)}"
assert 'python-requests' not in r.request.headers.get('User-Agent', ''), "请设置自定义 User-Agent"`,
      hint: '用 soup.select("tbody tr td:nth-child(2)") 提取书名存入变量 titles。',
      explanation: '单元一实操 2 完成:请求头 + CSS 选择器提取。',
    },
    {
      id: 'unit-test-1-t3',
      title: '实操题 3:提取价格列',
      skills: ['解析'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
# === TODO 补全 ===`,
      check: `assert len(prices) == 5 and all(p.startswith("¥") for p in prices), "价格列提取有误(应为第 6 个 td)"`,
      hint: '价格是每行第 6 个 td(下标 5),取前 5 行存入变量 prices。',
      explanation: '单元一实操 3 完成:单元格定位与切片。',
    },
  ],
  'unit-test-2': [
    {
      id: 'unit-test-2-t1',
      title: '实操题 1:书名与价格成对提取',
      skills: ['解析'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
# === TODO 补全 ===`,
      check: `assert len(books) == 24, f"应提取 24 条,实际 {len(books)}"
assert all(t and p.startswith("¥") for t, p in books), "书名或价格提取有误"`,
      hint: '遍历 tbody tr,每行取 td[1] 书名与 td[5] 价格组成元组,全部存入变量 books。',
      explanation: '单元二实操 1 完成:字段成对提取。',
    },
    {
      id: 'unit-test-2-t2',
      title: '实操题 2:XPath 取书名',
      skills: ['解析'],
      maxScore: 10,
      starter: `import requests
from lxml import html

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
doc = html.fromstring(r.text)
# === TODO 补全 ===`,
      check: `assert len(titles) == 24, f"XPath 应提取 24 个书名,实际 {len(titles)}"
assert all(t.strip() for t in titles), "存在空白书名"`,
      hint: '用 doc.xpath("//tbody/tr/td[2]/text()") 提取书名存入变量 titles。',
      explanation: '单元二实操 2 完成:XPath 表达式。',
    },
    {
      id: 'unit-test-2-t3',
      title: '实操题 3:提取详情页链接',
      skills: ['解析'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level3-detail/books.html", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
# === TODO 补全 ===`,
      check: `assert len(links) == 20, f"应提取 20 个详情链接,实际 {len(links)}"
assert all(h and h.endswith(".html") for h in links), "链接提取有误"`,
      hint: '链接在 tbody tr td:first-child a 的 href 属性里,用 get("href") 提取并存入 links。',
      explanation: '单元二实操 3 完成:属性提取。',
    },
  ],
  'unit-test-3': [
    {
      id: 'unit-test-3-t1',
      title: '实操题 1:翻页累计 100 本',
      skills: ['分页'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

total = 0
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"
    r = requests.get(url, timeout=10)
    r.encoding = "utf-8"
    total += len(BeautifulSoup(r.text, "html.parser").select("tbody tr"))
# === TODO 补全 ===`,
      check: `assert total == 100, f"应累计 100 本,实际 {total}"`,
      hint: '把 total 打印出来即可(循环已统计每页行数)。',
      explanation: '单元三实操 1 完成:分页遍历。',
    },
    {
      id: 'unit-test-3-t2',
      title: '实操题 2:两级页面抓取',
      skills: ['分页', '请求'],
      maxScore: 15,
      starter: `import requests
from bs4 import BeautifulSoup

base = SITE_BASE + "/practice/level3-detail/"
r = requests.get(base + "books.html", timeout=10)
r.encoding = "utf-8"
links = [a.get("href") for a in BeautifulSoup(r.text, "html.parser").select("tbody tr td:first-child a")]
details = []
for href in links:
    r2 = requests.get(base + href, timeout=10)
    r2.encoding = "utf-8"
    doc = BeautifulSoup(r2.text, "html.parser")
    details.append(doc.select_one("h2").get_text().strip())
# === TODO 补全 ===`,
      check: `assert len(details) == 20, f"应抓取 20 个详情页,实际 {len(details)}"
assert all(d for d in details), "存在空标题"`,
      hint: '把 details 打印出来即可(循环已抓取全部详情页标题)。',
      explanation: '单元三实操 2 完成:列表 + 详情两级爬取。',
    },
    {
      id: 'unit-test-3-t3',
      title: '实操题 3:JSON 接口全量',
      skills: ['存储', '请求'],
      maxScore: 15,
      starter: `import requests

books = []
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level4-json-api/api/books/page-{page}.json"
    books.extend(requests.get(url, timeout=10).json()["data"]["list"])
# === TODO 补全 ===`,
      check: `assert len(books) == 200, f"JSON 接口应返回 200 本,实际 {len(books)}"
assert 'title' in books[0], "JSON 结构解析有误"`,
      hint: '把 len(books) 打印出来即可(循环已从 10 页接口取回全部图书)。',
      explanation: '单元三实操 3 完成:JSON 接口分页全量获取。',
    },
  ],
  'unit-test-4': [
    {
      id: 'unit-test-4-t1',
      title: '实操题 1:识别动态渲染',
      skills: ['反爬', '请求'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

html_text = requests.get(SITE_BASE + "/practice/level5-dynamic/", timeout=10).text
in_html = len(BeautifulSoup(html_text, "html.parser").select("#book-list li"))
# === TODO 补全 ===`,
      check: `assert in_html == 0, "HTML 源码中不应直接包含数据(动态渲染)"
assert len(books) == 56, f"接口应返回 56 本,实际 {len(books)}"`,
      hint: '请求 /practice/level5-dynamic/api/books.json,取 data 存入变量 books。',
      explanation: '单元四实操 1 完成:看穿动态页面、直连底层接口。',
    },
    {
      id: 'unit-test-4-t2',
      title: '实操题 2:UA 伪装',
      skills: ['反爬'],
      maxScore: 10,
      starter: `import requests

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}
r = requests.get(SITE_BASE + "/practice/level1-books/", headers=headers, timeout=10)
# === TODO 补全 ===`,
      check: `assert r.status_code == 200, "请求失败"
ua = r.request.headers.get("User-Agent", "")
assert 'python-requests' not in ua, "请伪装浏览器 UA"
assert 'Mozilla' in ua, "UA 应包含 Mozilla"`,
      hint: '把状态码与 r.request.headers 里的 User-Agent 打印出来。',
      explanation: '单元四实操 2 完成:请求头伪装。',
    },
    {
      id: 'unit-test-4-t3',
      title: '实操题 3:异常与状态码',
      skills: ['请求'],
      maxScore: 10,
      starter: `import requests

try:
    r = requests.get(SITE_BASE + "/practice/nonexistent/", timeout=10)
    not_found = r.status_code
except requests.exceptions.RequestException as e:
    not_found = -1
# === TODO 补全 ===`,
      check: `assert not_found == 404, f"访问不存在页面应返回 404,实际 {not_found}"`,
      hint: '把 not_found 打印出来即可(不存在的路径应返回 404)。',
      explanation: '单元四实操 3 完成:异常处理与状态码判断。',
    },
  ],
  'unit-test-5': [
    {
      id: 'unit-test-5-t1',
      title: '实操题 1:解析 robots.txt',
      skills: [],
      maxScore: 10,
      starter: `import requests
from urllib.robotparser import RobotFileParser

text = requests.get(SITE_BASE + "/robots.txt", timeout=10).text
rp = RobotFileParser()
rp.parse(text.splitlines())
# === TODO 补全 ===`,
      check: `assert 'Disallow' in text, "缺少 Disallow 规则"
assert rp.can_fetch("Crawler", SITE_BASE + "/practice/level1-books/"), "应允许 /practice/"
assert not rp.can_fetch("Crawler", SITE_BASE + "/private/"), "应禁止 /private/"`,
      hint: '用 rp.can_fetch(ua, url) 分别判断 /practice/ 与 /private/ 并打印。',
      explanation: '单元五实操 1 完成:合规爬虫的第一步。',
    },
    {
      id: 'unit-test-5-t2',
      title: '实操题 2:全量抓取与去重',
      skills: ['请求', '解析', '分页'],
      maxScore: 15,
      starter: `import requests
from bs4 import BeautifulSoup

books = []
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"
    r = requests.get(url, timeout=10)
    r.encoding = "utf-8"
    for row in BeautifulSoup(r.text, "html.parser").select("tbody tr"):
        books.append(row.select("td")[1].get_text().strip())
# === TODO 补全 ===`,
      check: `assert len(books) == 100, f"应抓取 100 本,实际 {len(books)}"
assert len(set(books)) == 100, "书名存在重复,需要去重"`,
      hint: '用 set(books) 去重并打印总数与去重后的数量。',
      explanation: '单元五实操 2 完成:分页全量 + 去重。',
    },
    {
      id: 'unit-test-5-t3',
      title: '实操题 3:JSON 全量导出 CSV',
      skills: ['请求', '存储'],
      maxScore: 15,
      starter: `import requests
import csv
import io

books = []
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level4-json-api/api/books/page-{page}.json"
    books.extend(requests.get(url, timeout=10).json()["data"]["list"])

out = io.StringIO()
w = csv.DictWriter(out, fieldnames=["title", "price"])
w.writeheader()
w.writerows([{"title": b["title"], "price": b["price"]} for b in books])
csv_text = out.getvalue()
# === TODO 补全 ===`,
      check: `assert len(books) == 200, f"应抓取 200 本,实际 {len(books)}"
assert csv_text.startswith("title"), "CSV 缺少表头"
assert len(csv_text.strip().splitlines()) == 201, "CSV 应为 1 行表头 + 200 行数据"`,
      hint: '把 CSV 的文本行数打印出来即可(应为 201 行:表头 + 200 条)。',
      explanation: '单元五实操 3 完成:JSON 全量 + CSV 持久化,综合大结局。',
    },
  ],
};
