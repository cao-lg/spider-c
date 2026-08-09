// 生成并插入单元测试新增题(t4/t5)到 tasks.ts
const fs = require('fs');
const path = 'src/data/tasks.ts';
let src = fs.readFileSync(path, 'utf8');

// 单元1-5 新增题定义(t4/t5),与现有题目风格一致(# === TODO 补全 === + hint)
const NEW_TASKS = {
  'unit-test-1': [
    {
      id: 'unit-test-1-t4', title: '实操题 4:筛选价格高于 60 的书',
      skills: ['请求', '解析'], maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")
# === TODO 补全 ===`,
      check: `assert isinstance(expensive, list) and len(expensive) >= 1, "变量 expensive 应为非空列表"
assert all(p > 60 for p in expensive), "expensive 中应全部是高于 60 的价格"`,
      hint: '遍历 rows,取每行第 6 个 td(价格,下标 5)的文本,去掉 ¥ 转 float,把高于 60 的价格存入变量 expensive。',
      explanation: '单元一实操 4 完成:数值清洗与条件筛选。',
    },
    {
      id: 'unit-test-1-t5', title: '实操题 5:提取去重出版社',
      skills: ['请求', '解析'], maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
# === TODO 补全 ===`,
      check: `assert isinstance(pubs, list) and len(pubs) >= 3, "变量 pubs 应为去重后的出版社列表"
assert len(pubs) == len(set(pubs)), "pubs 应无重复"`,
      hint: '出版社是每行第 4 个 td(下标 3),提取文本后用 set() 去重,再转回 list 存入变量 pubs。',
      explanation: '单元一实操 5 完成:字段提取与去重。',
    },
  ],
  'unit-test-2': [
    {
      id: 'unit-test-2-t4', title: '实操题 4:提取作者列表',
      skills: ['请求', '解析'], maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")
# === TODO 补全 ===`,
      check: `assert isinstance(authors, list) and len(authors) == 24, f"应提取 24 个作者,实际 {len(authors)}"
assert all(a.strip() for a in authors), "存在空白作者"`,
      hint: '作者是每行第 3 个 td(下标 2),用 row.select("td")[2].get_text().strip() 提取,存入变量 authors。',
      explanation: '单元二实操 4 完成:多列定位练习。',
    },
    {
      id: 'unit-test-2-t5', title: '实操题 5:三元组综合提取',
      skills: ['请求', '解析'], maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")
# === TODO 补全 ===`,
      check: `assert len(records) == 24, f"应提取 24 条记录,实际 {len(records)}"
t, a, p = records[0]
assert isinstance(t, str) and isinstance(a, str) and p.startswith("¥"), "每条应为 (书名, 作者, 价格) 三元组"`,
      hint: '每条记录 = (书名 td[1], 作者 td[2], 价格 td[5]),遍历 rows 存入变量 records。',
      explanation: '单元二实操 5 完成:多字段组合提取,为后续数据落地打基础。',
    },
  ],
  'unit-test-3': [
    {
      id: 'unit-test-3-t4', title: '实操题 4:详情页书名+评分',
      skills: ['请求', '解析'], maxScore: 15,
      starter: `import requests
from bs4 import BeautifulSoup

base = SITE_BASE + "/practice/level3-detail/"
r = requests.get(base + "books.html", timeout=10)
r.encoding = "utf-8"
links = [a.get("href") for a in BeautifulSoup(r.text, "html.parser").select("tbody tr td:first-child a")]
# === TODO 补全 ===`,
      check: `assert isinstance(scores, list) and len(scores) == 20, f"应抓取 20 条,实际 {len(scores)}"
assert all(s.startswith("B") for s in scores), "评分应取自详情页 rating 单元格"`,
      hint: '遍历 links 请求详情页,用 doc.select_one("td.rating").get_text() 取评分,按 (书名, 评分) 存入变量 scores。',
      explanation: '单元三实操 4 完成:详情页多字段提取。',
    },
    {
      id: 'unit-test-3-t5', title: '实操题 5:翻页收集评分',
      skills: ['请求', '解析', '分页'], maxScore: 15,
      starter: `import requests
from bs4 import BeautifulSoup

ratings = []
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"
    r = requests.get(url, timeout=10)
    r.encoding = "utf-8"
    rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
# === TODO 补全 ===`,
      check: `assert isinstance(ratings, list) and len(ratings) == 100, f"应收集 100 个评分,实际 {len(ratings)}"
assert all(3.0 <= float(x) <= 5.0 for x in ratings), "评分应在 3.0~5.0 之间"`,
      hint: '评分是每行第 7 个 td(下标 6),在循环内把每行评分追加到 ratings 变量(注意缩进)。',
      explanation: '单元三实操 5 完成:分页 + 数值收集,综合进阶。',
    },
  ],
  'unit-test-4': [
    {
      id: 'unit-test-4-t4', title: '实操题 4:JSON 接口取总页数',
      skills: ['请求', '存储'], maxScore: 10,
      starter: `import requests

data = requests.get(SITE_BASE + "/practice/level4-json-api/api/books/page-1.json", timeout=10).json()
# === TODO 补全 ===`,
      check: `assert 'total' in globals() and total == 200, f"total 应为 200,实际 {total}"
assert 'total_pages' in globals() and total_pages == 10, f"totalPages 应为 10,实际 {total_pages}"`,
      hint: 'data["data"]["total"] 与 data["data"]["totalPages"],分别存入变量 total 与 total_pages。',
      explanation: '单元四实操 4 完成:JSON 元数据读取。',
    },
    {
      id: 'unit-test-4-t5', title: '实操题 5:JSON 书名收集',
      skills: ['请求', '存储'], maxScore: 15,
      starter: `import requests

titles = []
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level4-json-api/api/books/page-{page}.json"
    data = requests.get(url, timeout=10).json()
# === TODO 补全 ===`,
      check: `assert isinstance(titles, list) and len(titles) == 200, f"应收集 200 个书名,实际 {len(titles)}"
assert all(t for t in titles), "存在空书名"`,
      hint: 'data["data"]["list"] 是当前页的图书列表,每本 b["title"] 追加到 titles 变量。',
      explanation: '单元四实操 5 完成:JSON 分页全量收集。',
    },
  ],
  'unit-test-5': [
    {
      id: 'unit-test-5-t4', title: '实操题 4:价格区间统计',
      skills: ['请求', '解析'], maxScore: 15,
      starter: `import requests
from bs4 import BeautifulSoup

prices = []
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"
    r = requests.get(url, timeout=10)
    r.encoding = "utf-8"
    rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
# === TODO 补全 ===`,
      check: `assert isinstance(prices, list) and len(prices) == 100, f"应收集 100 个价格,实际 {len(prices)}"
assert all(30 <= float(p) <= 150 for p in prices), "价格应在 30~150 之间"`,
      hint: '价格是每行第 6 个 td(下标 5),文本形如 ¥59,去掉 ¥ 转 float 后追加到 prices。',
      explanation: '单元五实操 4 完成:全量数值收集与范围校验。',
    },
    {
      id: 'unit-test-5-t5', title: '实操题 5:JSON 全量+评分聚合',
      skills: ['请求', '存储'], maxScore: 15,
      starter: `import requests

ratings = []
for page in range(1, 11):
    url = f"{SITE_BASE}/practice/level4-json-api/api/books/page-{page}.json"
    data = requests.get(url, timeout=10).json()
# === TODO 补全 ===`,
      check: `assert isinstance(ratings, list) and len(ratings) == 200, f"应收集 200 个评分,实际 {len(ratings)}"
assert all(3.0 <= r <= 5.0 for r in ratings), "评分应在 3.0~5.0 之间"`,
      hint: 'data["data"]["list"] 每本 b["rating"] 是评分,追加到 ratings 变量,最后打印 len(ratings) 验证。',
      explanation: '单元五实操 5 完成:JSON 全量 + 数值聚合,结课收官。',
    },
  ],
};

// 在每个单元 t3 的闭合对象后插入新增题
for (const [unitId, tasks] of Object.entries(NEW_TASKS)) {
  const marker = `id: '${unitId}-t3'`;
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error(`marker not found: ${marker}`);
  // 找到该对象结束的 "    },\n"
  const closePos = src.indexOf('    },', idx);
  if (closePos < 0) throw new Error(`close not found for ${unitId}`);
  // 在 "    },\n" 之后插入 ", " + 新任务
  const insertPos = closePos + '    },\n'.length;
  const newBlocks = tasks
    .map(
      (t) => `    {
      id: '${t.id}',
      title: '${t.title}',
      skills: [${t.skills.map((s) => `'${s}'`).join(', ')}],
      maxScore: ${t.maxScore},
      starter: \`${t.starter}\`,
      check: \`${t.check}\`,
      hint: '${t.hint}',
      explanation: '${t.explanation}',
    }`
    )
    .join(',\n');
  src = src.slice(0, insertPos) + newBlocks + ',\n' + src.slice(insertPos);
  console.log(`inserted ${tasks.length} tasks after ${unitId}-t3`);
}

fs.writeFileSync(path, src);
console.log('done');