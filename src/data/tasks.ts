// 实操题题库 —— 每课一个代码实战,每个单元测试一组自动判定的实操题
// 全部在浏览器运行器(Pyodide)里真写代码、真打靶站,由 check 自动判定。

export interface TaskDef {
  id: string;
  title: string;
  /** 完整题干(HTML),显示在代码区外,不含参考答案 */
  question?: string;
  starter: string;
  check: string;
  hint?: string;
  /** 分步骤提示(优先于 hint;按顺序思考,避免直接看到完整答案) */
  hintSteps?: string[];
  explanation?: string;
  skills: string[];
  maxScore: number;
}

/** 课程代码实战:刻意练习骨架(每个 starter 都含 # TODO 占位符) */
export const lessonTasks: Record<string, TaskDef> = {
  '01-environment': {
    id: 'ex-01-environment',
      question: `<h4>任务:验证环境就绪</h4><p>确认 <code>requests</code> 与 <code>BeautifulSoup</code> 已经加载到 Pyodide 中。</p><p><strong>要点:</strong></p><ul><li>第三方库通常暴露 <code>__version__</code> 属性</li><li>用 <code>bool()</code> 判断导入名是否可用</li></ul><p class="ce-q-spec">判定标准:两个库都正确导入并通过断言。</p>`,
    title: '实战:验证环境',
    skills: [],
    maxScore: 5,
    starter: `# 本任务:确认 requests 与 bs4 已经加载到 Pyodide 中
import requests
from bs4 import BeautifulSoup

# TODO 1: 打印 requests 库的版本号(库对象通常有 __version__ 属性)
# TODO 2: 用 bool() 检查 BeautifulSoup 是否就绪,打印 "BeautifulSoup 就绪: True"

print("环境验证 OK")`,
    check: `assert requests.__version__, "requests 未正确导入"
assert 'BeautifulSoup' in globals() and BeautifulSoup, "bs4 未正确导入"
print("环境验证通过")`,
    hintSteps: [
      '你打算用哪个属性拿到 requests 的版本?回忆一下第三方库通常如何暴露自身信息。',
      'bool(BeautifulSoup) 总会是 True 吗?在没真正构造对象前,直接看导入名有意义吗?',
      '直接把两个 print() 写出来,再运行看效果。',
    ],
    explanation: 'requests 与 BeautifulSoup 是整门课的基础库,前者负责"去敲门",后者负责"读信"。两个都就绪,后续 12 个实操就能顺利推进。',
  },
  '02-http-basics': {
    id: 'ex-02-http',
      question: `<h4>任务:发起第一个 HTTP 请求</h4><p>向 Level 1 靶站发起 GET 请求,把<strong>状态码</strong>保存到变量 <code>status</code>。</p><p><strong>要点:</strong></p><ul><li><code>requests.get(url, timeout=N)</code> 返回响应对象</li><li>状态码属性是 <code>r.status_code</code></li></ul><p class="ce-q-spec">判定标准:真实请求后状态码为 200,响应体非空。</p>`,
    title: '实战:发起第一个请求',
    skills: ['请求'],
    maxScore: 10,
    starter: `# 本任务:向 Level 1 靶站发起 GET 请求,把状态码保存到变量 status
import requests

URL = SITE_BASE + "/practice/level1-books/"

# TODO 1: 用 requests.get() 发起请求,设置 timeout=10,把响应对象存为 r
# r = ...

# TODO 2: 从响应对象里取出状态码,存入变量 status
# status = ...`,
    check: `assert 'r' in globals(), "未发起请求"
assert 'status' in globals() and status == 200, f"状态码应为 200,实际 {status}"
assert len(r.text) > 0, "响应体为空"`,
    hintSteps: [
      'requests.get(url, timeout=N) 这个签名你记得吗?返回值是什么类型?',
      '响应对象上哪个属性是 HTTP 状态码?(不是 r.text、不是 r.content)',
      '把这两行补上,运行后你应该看到 "状态码: 200"。',
    ],
    explanation: 'HTTP 200 表示"服务器接受了你的敲门"。这是爬虫的第一步——先能进门,才能读到屋里有什么。如果是非 200(404/500),就要先排查为什么请求没到。',
  },
  '03-requests-basics': {
    id: 'ex-03-requests',
      question: `<h4>任务:完整请求(UA + 编码 + 解析)</h4><p>完成一个生产级单页请求:</p><ul><li>设置自定义 <code>User-Agent</code> 请求头</li><li>请求 Level 1 靶站,修正编码 <code>r.encoding = "utf-8"</code></li><li>用 BeautifulSoup 解析,把表格行存入变量 <code>rows</code></li></ul><p class="ce-q-spec">判定标准:判分器会独立重新抓取靶站,比对 rows 是否与真实表格行一致(24 行)。</p>`,
    title: '实战:requests 完整请求',
    skills: ['请求'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

# TODO 1: 构造请求头,User-Agent 设为 "Mozilla/5.0 (study crawler)"
# (提示:headers 是一个 dict,只要一个键值对)
# headers = ...

# TODO 2: 用 requests.get() 请求 URL,带上 headers 与 timeout=10,响应存为 r
# URL = SITE_BASE + "/practice/level1-books/"
# r = ...

# TODO 3: 修正响应编码(站点没声明 charset 时,requests 可能误判)
# r.encoding = ...

# TODO 4: 用 BeautifulSoup 解析 r.text,定位所有 "tbody tr" 存入变量 rows
# soup = ...
# rows = ...`,
    check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level1-books/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert r.status_code == 200, "请求失败"
assert 'python-requests' not in r.request.headers.get('User-Agent', ''), "请设置自定义 User-Agent"
assert 'rows' in globals() and isinstance(rows, list), "请把表格行存入变量 rows"
assert len(rows) == len(_expect), f"应抓到 {len(_expect)} 行,实际 {len(rows)}"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的行与靶站真实数据不一致,请检查解析逻辑" `,
    hintSteps: [
      '为什么要改 User-Agent?某些站点看到 "python-requests" 默认 UA 会直接拒绝。',
      'r.encoding 这个属性的作用是什么?如果响应里没有声明 charset,requests 会按什么猜?',
      'CSS 选择器 "tbody tr" 表示"在 tbody 里所有 tr",你会怎么调用 soup 的方法?',
      '把 4 个 TODO 依次填好,运行后应能看到 24 行数据。',
    ],
    explanation: '完整请求的四步走:伪装 UA(不被轻易识别)→ 修正编码(避免乱码)→ 用 BeautifulSoup 解析(把 HTML 变成可查询对象)→ 用 CSS 选择器定位(精准取行)。这是单页爬取的标准流程,后面所有题都基于此。',
  },
  '04-beautifulsoup': {
    id: 'ex-04-level1',
      question: `<h4>任务:BeautifulSoup 提取书名</h4><p>请求 Level 1 靶站,用 CSS 选择器提取所有书名,存入变量 <code>titles</code>。</p><p><strong>要点:</strong></p><ul><li>组合选择器 <code>tbody tr td:nth-child(2)</code></li><li>用 <code>.get_text().strip()</code> 取文本并去空白</li></ul><p class="ce-q-spec">判定标准:判分器独立抓取靶站,比对 titles 与真实 24 个书名完全一致。</p>`,
    title: '实战:BeautifulSoup 提取书名',
    skills: ['解析'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器提取所有书名(每行第 2 个 td),存入变量 titles
# 提示: 组合选择器 "tbody tr td:nth-child(2)",遍历 .get_text().strip()
# titles = ...`,
    check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level1-books/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入变量 titles"
assert len(titles) == len(_expect), f"应提取 {len(_expect)} 个书名,实际 {len(titles)}"
assert titles == _expect, "书名与靶站真实数据不一致,请检查选择器与去空白" `,
    hintSteps: [
      '列表推导式 [td.get_text() for td in soup.select(...)] 是最干净的写法。',
      'CSS 伪类 :nth-child(2) 表示"作为父元素第 2 个孩子的 td"。每行 tr 的第 2 个 td 是什么字段?',
      '加 .strip() 可以去掉首尾空白,避免书名前后空格干扰比对。',
    ],
    explanation: 'CSS 选择器 tbody tr td:nth-child(2) 一句定位"每行第 2 列",这是 HTML 表格解析的精髓——把页面结构变成选择器字符串,而不是行号硬编码。',
  },
  '05-xpath': {
    id: 'ex-05-xpath',
      question: `<h4>任务:XPath 提取书名</h4><p>请求 Level 1 靶站,用 lxml XPath 提取所有书名,存入变量 <code>titles</code>。</p><p><strong>要点:</strong></p><ul><li><code>doc.xpath("//tbody/tr/td[2]/text()")</code></li><li>XPath 返回字符串列表</li></ul><p class="ce-q-spec">判定标准:与真实 24 个书名一致。</p>`,
    title: '实战:XPath 提取书名',
    skills: ['解析'],
    maxScore: 10,
    starter: `import requests
from lxml import html

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
doc = html.fromstring(r.text)

# TODO: 用 XPath 表达式提取所有书名(每行第 2 个 td),存入变量 titles
# 提示:XPath 中 td[2] 表示"td 且作为父的第 2 个孩子",/text() 拿到文本节点
# titles = ...`,
    check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level1-books/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入变量 titles"
assert len(titles) == len(_expect), f"XPath 应提取 {len(_expect)} 个书名,实际 {len(titles)}"
assert titles == _expect, "XPath 提取的书名与靶站真实数据不一致" `,
    hintSteps: [
      'XPath 里 td[2] 等价于 CSS 里的 td:nth-child(2)。两套语法,同一个语义。',
      'doc.xpath("...") 返回的是文本节点列表,每个元素是 string 而不是 Tag。',
      'XPath 还能做很多 CSS 干不了的事:按属性过滤、取父节点、判断兄弟位置——这是进阶武器。',
    ],
    explanation: 'XPath //tbody/tr/td[2]/text() 与 CSS tbody tr td:nth-child(2) 殊途同归。当 HTML 结构复杂、需要按属性/层级关系筛选时,XPath 比 CSS 更强大;日常简单抓取,CSS 更易读。',
  },
  '06-single-page': {
    id: 'ex-06-level1',
      question: `<h4>任务:单页完整抓取</h4><p>请求 Level 1 图书榜,把表格行存入变量 <code>rows</code>,并验证每行结构与真实数据一致。</p><p><strong>要点:</strong></p><ul><li>每行 7 个 td:编号/书名/作者/出版社/日期/价格/评分</li><li>第一本书应为主题相关图书,价格列含 <code>¥</code></li></ul><p class="ce-q-spec">判定标准:判分器独立抓取,比对行数与首行字段。</p>`,
    title: '实战:抓取 Level 1 图书榜',
    skills: ['解析'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

url = SITE_BASE + "/practice/level1-books/"
r = requests.get(url, timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器提取所有表格行,存入变量 rows
# (提示:这是单页爬取,关键是把"表格"和"行"的概念变成代码)
# rows = ...

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
    hintSteps: [
      '第一步永远是把"页面长什么样"翻译成"代码里是什么结构"。打开靶站 + 检查元素。',
      '看到 <table>→<tbody>→<tr>→<td> 四层,你要取的就是所有 <tr>。',
      '下方 for 循环里写了 row.select("td")——这说明每行有 td 子元素,你只需要把 tr 列表拿出来。',
    ],
    explanation: '单页爬取的核心三步走完:请求(get)→ 解析(BeautifulSoup)→ 提取(select)。下一步就是把同一套路套到多页、详情页、JSON 接口上,变体不会变核心。',
  },
  '07-pagination': {
    id: 'ex-07-level2',
      question: `<h4>任务:翻遍 10 页榜单</h4><p>写循环遍历 <code>page/1.html</code> ~ <code>page/10.html</code>,累计 100 本书。</p><p><strong>要点:</strong></p><ul><li>URL 模板:<code>f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"</code></li><li><code>all_titles</code> 收集全部书名,<code>total</code> 累加行数</li></ul><p class="ce-q-spec">判定标准:判分器独立翻页,比对 total=100 且书名与真实数据一致。</p>`,
    title: '实战:翻遍 10 页榜单',
    skills: ['分页'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

all_titles = []
total = 0

# TODO: 写一个 for 循环,遍历 page=1 到 10
# 每个 page 拼出 URL = f"{SITE_BASE}/practice/level2-pagination/page/{page}.html"
# 请求、解析、统计每页行数累加到 total,所有书名追加到 all_titles
# (提示:之前 ex-04 已经写过单页解析,这里只需套进循环)`,
    check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_expect = []
for _p in range(1, 11):
    _src = _rq.get(f"{SITE_BASE}/practice/level2-pagination/page/{_p}.html", timeout=10)
    _src.encoding = "utf-8"
    for _tr in _bs(_src.text, "html.parser").select("tbody tr"):
        _expect.append(_tr.select("td")[1].get_text().strip())
assert 'total' in globals() and total == 100, f"应累计 100 本,实际 {total}"
assert 'all_titles' in globals() and isinstance(all_titles, list), "请把书名收集到变量 all_titles"
assert len(all_titles) == len(_expect), f"应收集 {len(_expect)} 本,实际 {len(all_titles)}"
assert all_titles == _expect, "书名序列与靶站真实数据不一致"
assert len(set(all_titles)) == 100, "书名存在重复" `,
    hintSteps: [
      'range(1, 11) 还是 range(1, 10)?翻页通常第一页是 1,共 10 页,所以 range(1, 11)。',
      'for 循环里需要 4 行:拼 URL、发请求、解析、累加。建议每行加注释,便于复盘。',
      'all_titles 用 list.append 累加;total 用 += 累加。',
    ],
    explanation: '分页的核心是"循环 + URL 模板"。一旦你识别出页码在 URL 中的位置,就能用 for 循环机械地翻遍全部页。生产中要小心:翻太快会被封——记得加 time.sleep 或遵守站点 robots。',
  },
  '08-multi-level': {
    id: 'ex-08-level3',
      question: `<h4>任务:列表页 + 详情页两级抓取</h4><p>从 Level 3 列表页提取 20 个详情链接,再逐个请求详情页,提取书名与价格。</p><p><strong>要点:</strong></p><ul><li>链接:<code>tbody tr td:first-child a</code> 的 href</li><li>详情页:<code>h2</code> 标题与 <code>td.price</code> 价格</li></ul><p class="ce-q-spec">判定标准:判分器独立抓取,比对 20 条详情与真实数据一致。</p>`,
    title: '实战:列表页 + 详情页',
    skills: ['分页', '请求'],
    maxScore: 15,
    starter: `import requests
from bs4 import BeautifulSoup

base = SITE_BASE + "/practice/level3-detail/"
r = requests.get(base + "books.html", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO 1: 从列表页提取所有详情链接,存入变量 links
# (提示:链接在 tbody tr td:first-child a 的 href 属性里)
# links = ...

details = []
# TODO 2: 遍历 links,逐个请求详情页 base + href
# 在循环内用 BeautifulSoup 解析,提取 h2 标题与 td.price 价格
# 组成 dict {"书名": title, "价格": price} 追加到 details
# (提示:for href in links: ...)

print("详情页数量:", len(details))
print("样例:", details[0] if details else None)`,
    check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level3-detail/" + "books.html", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [a.get("href") for a in _soup.select("tbody tr td:first-child a")]
assert 'links' in globals() and isinstance(links, list), "请把详情链接存入变量 links"
assert len(links) == len(_expect), f"应提取 {len(_expect)} 个详情链接,实际 {len(links)}"
assert links == _expect, "详情链接与靶站真实数据不一致"
assert 'details' in globals() and len(details) == 20, f"应抓取 20 个详情页,实际 {len(details)}"
assert all(d["书名"] and d["价格"].startswith("¥") for d in details), "详情字段提取有误" `,
    hintSteps: [
      '第一个 TODO:列表推导式 [a.get("href") for a in soup.select("tbody tr td:first-child a")]。',
      '第二个 TODO 是循环 + 重复 ex-04 的单页解析套路。注意变量名不要冲突:循环外用 r,循环内建议用 r2。',
      'price 在 <td class="price"> 里,选 td.price 或 td[class=price] 都行;用 .select_one() 取单元素更简洁。',
    ],
    explanation: '两级爬取:先抓列表页的全部详情链接,再逐个请求详情页。这是大多数真实爬虫(豆瓣/京东/知乎)的骨架——列表页只给你索引,详情页才是真实数据。',
  },
  '09-json-and-storage': {
    id: 'ex-09-level4',
      question: `<h4>任务:直连 JSON 接口</h4><p>请求 Level 4 分页 JSON 接口(10 页 × 20 条),收集全部 200 本图书。</p><p><strong>要点:</strong></p><ul><li>URL:<code>api/books/page-{page}.json</code></li><li>结构:<code>data["data"]["list"]</code></li></ul><p class="ce-q-spec">判定标准:判分器独立请求接口,比对 books 与真实 200 条一致。</p>`,
    title: '实战:直连 JSON 接口',
    skills: ['存储', '请求'],
    maxScore: 15,
    starter: `import requests

books = []
total = 0

# TODO: 写一个 for 循环遍历 page=1 到 10
# 每个 page 拼 URL = f"{SITE_BASE}/practice/level4-json-api/api/books/page-{page}.json"
# 请求 → .json() 直接拿到 dict → data["data"]["list"] 是本页的图书列表
# 累加 total,所有图书追加到 books
# (提示:.json() 比 .text + json.loads() 更省事,自动按响应头解析)`,
    check: `import requests as _rq
_expect = []
for _p in range(1, 11):
    _exp = _rq.get(f"{SITE_BASE}/practice/level4-json-api/api/books/page-{_p}.json", timeout=10).json()
    _expect.extend(_exp["data"]["list"])
assert 'books' in globals() and isinstance(books, list), "请把图书列表存入变量 books"
assert len(books) == len(_expect), f"应收集 {len(_expect)} 本,实际 {len(books)}"
assert books == _expect, "图书数据与接口真实返回不一致" `,
    hintSteps: [
      '查看靶站 Network 面板,找带 ?page=N 或 /page-N.json 之类的请求——这就是"接口"。',
      'data = r.json() 自动把 JSON 字符串转 dict,你不需要 import json。',
      '网页里 HTML 看着简单,接口里可能就是 data.data.list 三层字典,层层 .get 或 [] 都行。',
    ],
    explanation: '现代网页几乎都是"前端调接口 + JS 渲染"。直连 JSON 接口比解析 HTML 高效一个数量级,数据也干净。这是爬虫工程师的"抄近路":能在浏览器 Network 面板看到的所有请求,你都能直接复用。',
  },
  '10-dynamic-pages': {
    id: 'ex-10-level5',
      question: `<h4>任务:看穿动态渲染</h4><p>Level 5 页面数据由 JS 加载:验证源码无数据(<code>in_html == 0</code>),并直连底层 JSON 接口拿 56 本。</p><p><strong>要点:</strong></p><ul><li>先请求页面源码统计 <code>#book-list li</code> 数量</li><li>再请求 <code>api/books.json</code>,取 <code>data</code> 存入 <code>books</code></li></ul><p class="ce-q-spec">判定标准:判分器独立请求,比对接口返回 56 条。</p>`,
    title: '实战:看穿动态页面',
    skills: ['反爬', '请求'],
    maxScore: 10,
    starter: `import requests
from bs4 import BeautifulSoup

# TODO 1: 请求 Level 5 页面源码,提取 <li> 数量存入变量 in_html
# (提示:页面 JS 渲染,源码里大概率没有图书数据,所以 in_html 应为 0)
# html_text = ...
# in_html = ...

# TODO 2: 直接请求底层 JSON 接口 /practice/level5-dynamic/api/books.json
# 拿到 data 字段存入变量 books
# (提示:用 .json() 解析,接口声明的 total 数量就在里面)
# books = ...

print("HTML 中书籍数:", in_html, "| 接口返回:", len(books))`,
    check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/level5-dynamic/api/books.json", timeout=10).json()
_expect = _exp["data"]
assert in_html == 0, "页面源码里不应直接包含书籍数据(动态渲染)"
assert 'books' in globals() and isinstance(books, list), "请把接口数据存入变量 books"
assert len(books) == len(_expect), f"接口应返回 {len(_expect)} 本,实际 {len(books)}"
assert books == _expect, "接口数据与真实返回不一致" `,
    hintSteps: [
      '右键 → 查看网页源代码,搜 "书名"、"Java" 这种字眼——如果搜不到,说明数据不是 HTML 直接给的。',
      'F12 → Network 面板,刷新页面,观察哪些请求返回 JSON。接口路径通常藏在 .js 文件里。',
      '拿到接口 URL 后,直接 requests.get() 它,就是后端数据——绕过 JS 渲染。',
    ],
    explanation: '看穿动态页面的标准动作:F12 → Network → 找 JSON 接口 → 直接 requests。源码里看不到想要的数据?八成是 JS 渲染——找到底层接口直连,效率比 Selenium 跑浏览器高得多。',
  },
  '11-anti-crawling': {
    id: 'ex-11-anti',
      question: `<h4>任务:伪装浏览器 UA</h4><p>构造浏览器风格的 <code>User-Agent</code> 请求头并发起请求,验证请求头确实被发送。</p><p><strong>要点:</strong></p><ul><li>UA 应含 <code>Mozilla</code>,不含 <code>python-requests</code></li><li>检查 <code>r.request.headers</code>(发送的)而非 <code>r.headers</code>(返回的)</li></ul><p class="ce-q-spec">判定标准:状态码 200 且 UA 已伪装。</p>`,
    title: '实战:伪装浏览器 UA',
    skills: ['反爬'],
    maxScore: 10,
    starter: `import requests

# TODO 1: 构造请求头 headers,设置 User-Agent 为一段"像 Chrome"的字符串
# (提示:Chrome 真实 UA 形如 "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")
# headers = ...

# TODO 2: 发起请求带上 headers,响应存为 r
# URL = SITE_BASE + "/practice/level1-books/"
# r = ...

print("状态码:", r.status_code)
print("实际发送的 UA:", r.request.headers.get("User-Agent"))`,
    check: `assert r.status_code == 200, "请求失败"
ua = r.request.headers.get("User-Agent", "")
assert 'python-requests' not in ua, "仍在用默认 UA,请伪装成浏览器"
assert 'Mozilla' in ua, "UA 应形如浏览器(包含 Mozilla)"`,
    hintSteps: [
      'requests 默认 UA 含 "python-requests",很多站点一看就拒。',
      '打开你电脑上的 Chrome,F12 → Network → 看任意请求的 User-Agent,复制粘贴。',
      'r.request.headers 才是"你发出去了什么",r.headers 是"服务器返回了什么"。',
    ],
    explanation: 'UA 伪装是反爬的第一道基本功。生产环境还应加 Accept、Accept-Language、Referer 等,让请求更像真实浏览器。',
  },
  '12-ethics': {
    id: 'ex-12-robots',
      question: `<h4>任务:读懂 robots.txt</h4><p>抓取 <code>/robots.txt</code>,用 <code>RobotFileParser</code> 判断哪些路径允许抓取。</p><p><strong>要点:</strong></p><ul><li><code>rp.parse(text.splitlines())</code> 加载规则</li><li><code>rp.can_fetch(ua, url)</code> 判断单条路径</li></ul><p class="ce-q-spec">判定标准:/practice/ 允许,/private/ 禁止。</p>`,
    title: '实战:读懂 robots.txt',
    skills: [],
    maxScore: 10,
    starter: `import requests
from urllib.robotparser import RobotFileParser

# TODO 1: 请求 /robots.txt 拿到文本,存入变量 text
# (提示:这是一个 GET,URL 拼接 SITE_BASE)
# text = ...

# TODO 2: 构造 RobotFileParser,parse(text.splitlines()) 让它认识规则
# rp = ...
# rp.parse(...)

# TODO 3: 分别判断 UA="Crawler" 能否抓 /practice/level1-books/ 和 /private/
# 把两个布尔结果打印出来,顺便把 text 也打印

# can_practice = ...
# can_private  = ...`,
    check: `assert 'text' in globals() and 'Disallow' in text, "未读到 robots.txt 或缺少 Disallow 规则"
assert rp.can_fetch("Crawler", SITE_BASE + "/practice/level1-books/"), "应允许抓取 /practice/"
assert not rp.can_fetch("Crawler", SITE_BASE + "/private/"), "应禁止抓取 /private/"`,
    hintSteps: [
      'robots.txt 是站长的"君子协定",违反它通常不会立刻被封,但会被业内鄙视。',
      'RobotFileParser 用 parse() 加载规则后,can_fetch(ua, url) 判断单条路径。',
      '批量抓取前先 can_fetch 是合规爬虫的"职业礼仪",面试经常被问到。',
    ],
    explanation: 'robots.txt 是站长的访问声明。用 RobotFileParser 解析后,can_fetch 一查就知道能不能抓——这是合规爬虫的第一步,也是判断"对方是否愿意被爬"的标准答案。',
  },
  '13-final-project': {
    id: 'ex-13-project',
      question: `<h4>任务:全量抓取并导出 CSV</h4><p>翻遍 Level 2 的 10 页,抓取 100 条记录,用 <code>csv</code> 模块导出。</p><p><strong>要点:</strong></p><ul><li>每条 dict:<code>{"编号","书名","价格"}</code></li><li><code>csv.DictWriter</code> 先 <code>writeheader()</code> 再 <code>writerows()</code></li></ul><p class="ce-q-spec">判定标准:100 条记录,CSV 1 行表头 + 100 行数据。</p>`,
    title: '综合实战:全量抓取并导出 CSV',
    skills: ['请求', '解析', '分页', '反爬', '存储'],
    maxScore: 20,
    starter: `import requests
import csv
import io
from bs4 import BeautifulSoup

records = []
# TODO 1: 写 for 循环遍历 page=1 到 10
# 每个 page 请求 /practice/level2-pagination/page/{page}.html(记得 r.encoding = "utf-8")
# 解析后遍历 tbody tr,把每行组成 dict {"编号": ..., "书名": ..., "价格": ...} 追加到 records
# (提示:编号/书名/价格分别对应 td[0]、td[1]、td[5])

# TODO 2: 用 io.StringIO + csv.DictWriter 写入字段 ["编号", "书名", "价格"]
# writeheader() 后 writerows(records),把最终 CSV 文本存入变量 csv_text
# (提示:csv.DictWriter 需要先 writeheader 才能写数据,字段顺序写在 fieldnames 里)

out = io.StringIO()
# w = ...
# w.writeheader()
# w.writerows(...)
csv_text = out.getvalue()

print("写入记录数:", len(records))
print("文件行数(含表头):", len(csv_text.strip().splitlines()))`,
    check: `assert 'records' in globals() and len(records) == 100, f"应抓取 100 条记录,实际 {len(records)}"
assert 'csv_text' in globals() and csv_text.startswith("编号"), "CSV 缺少表头"
assert len(csv_text.strip().splitlines()) == 101, "CSV 应为 1 行表头 + 100 行数据"`,
    hintSteps: [
      '你已掌握 ex-07(分页)与 ex-06(单页解析),这里就是"分页 + 单页"的拼装。',
      'csv.DictWriter 必须先 writeheader(),再 writerows(rows)——顺序反了会写出空文件。',
      'csv_text.strip().splitlines() 切出所有行,含表头 101 行。',
    ],
    explanation: '这是综合大结局:把前 9 道题的技能(请求、解析、分页、存储)拼成一个完整数据管道。生产爬虫无非就是这种"循环 + 解析 + 持久化"的套路,只是更多异常处理和重试逻辑。',
  },
};
/** 单元测试 · 实操题(带 TODO,需学生补全代码) */
export const unitTestTasks: Record<string, TaskDef[]> = {
  'unit-test-1': [
    {
      id: 'unit-test-1-t1',
      question: `<h4>任务:记录状态码与行数</h4><p>请求 Level 1 靶站,把状态码存入变量 <code>status</code>,把表格行存入 <code>rows</code>。</p><p class="ce-q-spec">判定标准:判分器独立抓取,比对 status=200、rows 与真实行数一致。</p>`,
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
      question: `<h4>任务:自定义请求头 + 提取书名</h4><p>带上自定义 UA 请求,把 24 个书名提取到变量 <code>titles</code>。</p><p class="ce-q-spec">判定标准:UA 已伪装,书名与真实数据一致。</p>`,
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
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level1-books/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'python-requests' not in r.request.headers.get('User-Agent', ''), "请设置自定义 User-Agent"
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入变量 titles"
assert len(titles) == len(_expect), f"应提取 {len(_expect)} 个书名,实际 {len(titles)}"
assert titles == _expect, "书名与靶站真实数据不一致" `,
      hint: '用 soup.select("tbody tr td:nth-child(2)") 提取书名存入变量 titles。',
      explanation: '单元一实操 2 完成:请求头 + CSS 选择器提取。',
    },
    {
      id: 'unit-test-1-t3',
      question: `<h4>任务:提取价格列</h4><p>取前 5 行的价格(第 6 个 td),存入变量 <code>prices</code>。</p><p class="ce-q-spec">判定标准:与真实价格一致,均以 ¥ 开头。</p>`,
      title: '实操题 3:提取价格列',
      skills: ['解析'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
# === TODO 补全 ===`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level1-books/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[5].get_text().strip() for _tr in _soup.select("tbody tr")][:5]
assert 'prices' in globals() and isinstance(prices, list), "请把价格存入变量 prices"
assert len(prices) == 5, f"应取前 5 行价格,实际 {len(prices)} 条"
assert prices == _expect, "价格与靶站真实数据不一致" `,
      hint: '价格是每行第 6 个 td(下标 5),取前 5 行存入变量 prices。',
      explanation: '单元一实操 3 完成:单元格定位与切片。',
    },
    {
      id: 'unit-test-1-t4',
      question: `<h4>任务:筛选高价图书</h4><p>提取价格并筛选高于 60 的,存入变量 <code>expensive</code>(float 列表)。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 4:筛选价格高于 60 的书',
      skills: ['请求', '解析'],
      maxScore: 10,
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
      id: 'unit-test-1-t5',
      question: `<h4>任务:提取去重出版社</h4><p>提取出版社(第 4 个 td)并去重,存入变量 <code>pubs</code>。</p><p class="ce-q-spec">判定标准:与真实出版社集合一致。</p>`,
      title: '实操题 5:提取去重出版社',
      skills: ['请求', '解析'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
rows = BeautifulSoup(r.text, "html.parser").select("tbody tr")
# === TODO 补全 ===`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level1-books/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = list({_tr.select("td")[3].get_text().strip() for _tr in _soup.select("tbody tr")})
assert 'pubs' in globals() and isinstance(pubs, list), "请把出版社存入变量 pubs"
assert set(pubs) == set(_expect), "出版社集合与靶站真实数据不一致"
assert len(pubs) == len(set(pubs)), "pubs 应无重复" `,
      hint: '出版社是每行第 4 个 td(下标 3),提取文本后用 set() 去重,再转回 list 存入变量 pubs。',
      explanation: '单元一实操 5 完成:字段提取与去重。',
    },
  ],
  'unit-test-2': [
    {
      id: 'unit-test-2-t1',
      question: `<h4>任务:书名与价格成对提取</h4><p>遍历行,把 (书名, 价格) 元组存入变量 <code>books</code>。</p><p class="ce-q-spec">判定标准:与真实数据完全一致。</p>`,
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
      question: `<h4>任务:XPath 取书名</h4><p>用 lxml XPath 提取 24 个书名到变量 <code>titles</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 2:XPath 取书名',
      skills: ['解析'],
      maxScore: 10,
      starter: `import requests
from lxml import html

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
doc = html.fromstring(r.text)
# === TODO 补全 ===`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level1-books/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入变量 titles"
assert len(titles) == len(_expect), f"应提取 {len(_expect)} 个书名,实际 {len(titles)}"
assert titles == _expect, "XPath 书名与靶站真实数据不一致" `,
      hint: '用 doc.xpath("//tbody/tr/td[2]/text()") 提取书名存入变量 titles。',
      explanation: '单元二实操 2 完成:XPath 表达式。',
    },
    {
      id: 'unit-test-2-t3',
      question: `<h4>任务:提取详情页链接</h4><p>从 Level 3 列表页提取 20 个详情链接,存入变量 <code>links</code>。</p><p class="ce-q-spec">判定标准:与真实链接一致。</p>`,
      title: '实操题 3:提取详情页链接',
      skills: ['解析'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level3-detail/books.html", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
# === TODO 补全 ===`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level3-detail/" + "books.html", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [a.get("href") for a in _soup.select("tbody tr td:first-child a")]
assert 'links' in globals() and isinstance(links, list), "请把详情链接存入变量 links"
assert len(links) == len(_expect), f"应提取 {len(_expect)} 个链接,实际 {len(links)}"
assert links == _expect, "详情链接与靶站真实数据不一致" `,
      hint: '链接在 tbody tr td:first-child a 的 href 属性里,用 get("href") 提取并存入 links。',
      explanation: '单元二实操 3 完成:属性提取。',
    },
    {
      id: 'unit-test-2-t4',
      question: `<h4>任务:提取作者列表</h4><p>提取 24 个作者(第 3 个 td)到变量 <code>authors</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 4:提取作者列表',
      skills: ['请求', '解析'],
      maxScore: 10,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/level1-books/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")
# === TODO 补全 ===`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level1-books/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[2].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'authors' in globals() and isinstance(authors, list), "请把作者存入变量 authors"
assert len(authors) == len(_expect), f"应提取 {len(_expect)} 个作者,实际 {len(authors)}"
assert authors == _expect, "作者与靶站真实数据不一致" `,
      hint: '作者是每行第 3 个 td(下标 2),用 row.select("td")[2].get_text().strip() 提取,存入变量 authors。',
      explanation: '单元二实操 4 完成:多列定位练习。',
    },
    {
      id: 'unit-test-2-t5',
      question: `<h4>任务:三元组综合提取</h4><p>提取 (书名, 作者, 价格) 三元组存入变量 <code>records</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 5:三元组综合提取',
      skills: ['请求', '解析'],
      maxScore: 10,
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
      id: 'unit-test-3-t1',
      question: `<h4>任务:翻页累计 100 本</h4><p>翻遍 Level 2 的 10 页,累计行数存入变量 <code>total</code>。</p><p class="ce-q-spec">判定标准:判分器独立翻页,比对 total=100。</p>`,
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
      question: `<h4>任务:两级页面抓取</h4><p>抓取 Level 3 的 20 个详情页标题,存入变量 <code>details</code>。</p><p class="ce-q-spec">判定标准:与真实 20 条一致。</p>`,
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
      question: `<h4>任务:JSON 接口全量</h4><p>请求 Level 4 的 10 页 JSON,收集 200 本到变量 <code>books</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
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
    {
      id: 'unit-test-3-t4',
      question: `<h4>任务:详情页书名 + 评分</h4><p>抓取 20 个详情页的 (书名, 评分) 存入变量 <code>scores</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 4:详情页书名+评分',
      skills: ['请求', '解析'],
      maxScore: 15,
      starter: `import requests
from bs4 import BeautifulSoup

base = SITE_BASE + "/practice/level3-detail/"
r = requests.get(base + "books.html", timeout=10)
r.encoding = "utf-8"
links = [a.get("href") for a in BeautifulSoup(r.text, "html.parser").select("tbody tr td:first-child a")]
# === TODO 补全 ===`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/level3-detail/" + "books.html", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_links = [a.get("href") for a in _soup.select("tbody tr td:first-child a")]
_expect = []
for _href in _links:
    _d = _rq.get(SITE_BASE + "/practice/level3-detail/" + _href, timeout=10)
    _d.encoding = "utf-8"
    _doc = _bs(_d.text, "html.parser")
    _expect.append((_doc.select_one("h2").get_text().strip(), _doc.select_one("td.rating").get_text().strip()))
assert 'scores' in globals() and isinstance(scores, list), "请把 (书名, 评分) 存入变量 scores"
assert len(scores) == len(_expect), f"应抓取 {len(_expect)} 条,实际 {len(scores)}"
assert scores == _expect, "(书名, 评分) 与靶站真实数据不一致" `,
      hint: '遍历 links 请求详情页,用 doc.select_one("td.rating").get_text() 取评分,按 (书名, 评分) 存入变量 scores。',
      explanation: '单元三实操 4 完成:详情页多字段提取。',
    },
    {
      id: 'unit-test-3-t5',
      question: `<h4>任务:翻页收集评分</h4><p>翻遍 10 页收集 100 个评分(第 7 个 td)到变量 <code>ratings</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 5:翻页收集评分',
      skills: ['请求', '解析', '分页'],
      maxScore: 15,
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
      id: 'unit-test-4-t1',
      question: `<h4>任务:识别动态渲染</h4><p>验证 Level 5 源码无数据(<code>in_html == 0</code>),直连接口拿 56 本到 <code>books</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
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
      question: `<h4>任务:UA 伪装</h4><p>带浏览器 UA 请求,验证状态码与请求头。</p><p class="ce-q-spec">判定标准:状态码 200,UA 不含 python-requests。</p>`,
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
      question: `<h4>任务:异常与状态码</h4><p>请求不存在的路径,验证返回 404,存入变量 <code>not_found</code>。</p><p class="ce-q-spec">判定标准:not_found == 404。</p>`,
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
    {
      id: 'unit-test-4-t4',
      question: `<h4>任务:JSON 元数据</h4><p>请求 Level 4 第一页,把 <code>total</code> 与 <code>total_pages</code> 存入变量。</p><p class="ce-q-spec">判定标准:total=200,totalPages=10。</p>`,
      title: '实操题 4:JSON 接口取总页数',
      skills: ['请求', '存储'],
      maxScore: 10,
      starter: `import requests

data = requests.get(SITE_BASE + "/practice/level4-json-api/api/books/page-1.json", timeout=10).json()
# === TODO 补全 ===`,
      check: `assert 'total' in globals() and total == 200, f"total 应为 200,实际 {total}"
assert 'total_pages' in globals() and total_pages == 10, f"totalPages 应为 10,实际 {total_pages}"`,
      hint: 'data["data"]["total"] 与 data["data"]["totalPages"],分别存入变量 total 与 total_pages。',
      explanation: '单元四实操 4 完成:JSON 元数据读取。',
    },
    {
      id: 'unit-test-4-t5',
      question: `<h4>任务:JSON 书名收集</h4><p>翻遍 10 页 JSON,收集 200 个书名到变量 <code>titles</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 5:JSON 书名收集',
      skills: ['请求', '存储'],
      maxScore: 15,
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
      id: 'unit-test-5-t1',
      question: `<h4>任务:解析 robots.txt</h4><p>读取 robots.txt 并判断 /practice/ 与 /private/ 的抓取许可。</p><p class="ce-q-spec">判定标准:允许 /practice/,禁止 /private/。</p>`,
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
      question: `<h4>任务:全量抓取 + 去重</h4><p>翻遍 10 页收集 100 个书名到 <code>books</code>,并用 set 去重。</p><p class="ce-q-spec">判定标准:100 条,无重复。</p>`,
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
      question: `<h4>任务:JSON 全量导出 CSV</h4><p>从 JSON 接口收集 200 本,导出 CSV 文本到变量 <code>csv_text</code>。</p><p class="ce-q-spec">判定标准:201 行(表头 + 200)。</p>`,
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
    {
      id: 'unit-test-5-t4',
      question: `<h4>任务:价格区间统计</h4><p>翻遍 10 页收集 100 个价格(转 float)到变量 <code>prices</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 4:价格区间统计',
      skills: ['请求', '解析'],
      maxScore: 15,
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
      id: 'unit-test-5-t5',
      question: `<h4>任务:JSON 评分聚合</h4><p>从 JSON 接口收集 200 个评分到变量 <code>ratings</code>。</p><p class="ce-q-spec">判定标准:与真实数据一致。</p>`,
      title: '实操题 5:JSON 全量+评分聚合',
      skills: ['请求', '存储'],
      maxScore: 15,
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

export const courseTestTasks: Record<string, TaskDef[]> = {
  '01': [
    {
      id: 'course-test-01-t1',
      title: '实操题 1:抓取「城市气候观测」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「城市气候观测」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-01/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-01/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-01/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「城市气候观测」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-01-t2',
      title: '实操题 2:提取「城市」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「城市气候观测」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-01/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-01/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-01/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-01-t3',
      title: '实操题 3:直连「城市气候观测」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「城市气候观测」JSON 接口</h4><p>请求 <code>/practice/course-test-01/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-01/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-01/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '02': [
    {
      id: 'course-test-02-t1',
      title: '实操题 1:抓取「数码配件行情」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「数码配件行情」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-02/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-02/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-02/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「数码配件行情」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-02-t2',
      title: '实操题 2:提取「商品」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「数码配件行情」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-02/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-02/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-02/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-02-t3',
      title: '实操题 3:直连「数码配件行情」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「数码配件行情」JSON 接口</h4><p>请求 <code>/practice/course-test-02/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-02/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-02/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '03': [
    {
      id: 'course-test-03-t1',
      title: '实操题 1:抓取「股票行情速览」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「股票行情速览」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-03/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-03/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-03/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「股票行情速览」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-03-t2',
      title: '实操题 2:提取「股票」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「股票行情速览」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-03/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-03/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-03/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-03-t3',
      title: '实操题 3:直连「股票行情速览」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「股票行情速览」JSON 接口</h4><p>请求 <code>/practice/course-test-03/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-03/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-03/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '04': [
    {
      id: 'course-test-04-t1',
      title: '实操题 1:抓取「经典影片榜单」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「经典影片榜单」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-04/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-04/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-04/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「经典影片榜单」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-04-t2',
      title: '实操题 2:提取「电影」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「经典影片榜单」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-04/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-04/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-04/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-04-t3',
      title: '实操题 3:直连「经典影片榜单」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「经典影片榜单」JSON 接口</h4><p>请求 <code>/practice/course-test-04/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-04/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-04/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '05': [
    {
      id: 'course-test-05-t1',
      title: '实操题 1:抓取「人气餐厅推荐」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「人气餐厅推荐」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-05/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-05/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-05/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「人气餐厅推荐」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-05-t2',
      title: '实操题 2:提取「餐厅」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「人气餐厅推荐」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-05/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-05/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-05/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-05-t3',
      title: '实操题 3:直连「人气餐厅推荐」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「人气餐厅推荐」JSON 接口</h4><p>请求 <code>/practice/course-test-05/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-05/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-05/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '06': [
    {
      id: 'course-test-06-t1',
      title: '实操题 1:抓取「健身器材精选」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「健身器材精选」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-06/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-06/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-06/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「健身器材精选」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-06-t2',
      title: '实操题 2:提取「器材」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「健身器材精选」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-06/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-06/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-06/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-06-t3',
      title: '实操题 3:直连「健身器材精选」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「健身器材精选」JSON 接口</h4><p>请求 <code>/practice/course-test-06/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-06/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-06/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '07': [
    {
      id: 'course-test-07-t1',
      title: '实操题 1:抓取「热门景点排行」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「热门景点排行」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-07/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-07/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-07/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「热门景点排行」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-07-t2',
      title: '实操题 2:提取「景点」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「热门景点排行」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-07/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-07/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-07/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-07-t3',
      title: '实操题 3:直连「热门景点排行」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「热门景点排行」JSON 接口</h4><p>请求 <code>/practice/course-test-07/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-07/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-07/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '08': [
    {
      id: 'course-test-08-t1',
      title: '实操题 1:抓取「宠物好物推荐」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「宠物好物推荐」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-08/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-08/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-08/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「宠物好物推荐」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-08-t2',
      title: '实操题 2:提取「商品」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「宠物好物推荐」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-08/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-08/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-08/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-08-t3',
      title: '实操题 3:直连「宠物好物推荐」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「宠物好物推荐」JSON 接口</h4><p>请求 <code>/practice/course-test-08/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-08/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-08/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '09': [
    {
      id: 'course-test-09-t1',
      title: '实操题 1:抓取「专辑热度榜」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「专辑热度榜」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-09/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-09/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-09/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「专辑热度榜」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-09-t2',
      title: '实操题 2:提取「专辑」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「专辑热度榜」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-09/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-09/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-09/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-09-t3',
      title: '实操题 3:直连「专辑热度榜」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「专辑热度榜」JSON 接口</h4><p>请求 <code>/practice/course-test-09/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-09/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-09/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ],
  '10': [
    {
      id: 'course-test-10-t1',
      title: '实操题 1:抓取「家居好物甄选」列表',
      skills: ["请求", "解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「家居好物甄选」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-10/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>用 CSS 选择器提取表格中所有行,存入变量 <code>rows</code>。</p><p class="ce-q-spec">判定标准:rows 数量与顺序必须和靶站真实表格行完全一致(24 行);且每行必须是 BeautifulSoup 解析出的对象。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-10/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")

# TODO: 用 CSS 选择器把表格中所有行存入变量 rows(提示: tbody tr)
# rows = ...`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-10/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [_tr.select("td")[1].get_text().strip() for _tr in _soup.select("tbody tr")]
assert 'rows' in globals(), "未定义变量 rows,请先把表格行存入 rows"
assert isinstance(rows, list) and len(rows) == len(_expect), f"行数应为 {len(_expect)},实际 {len(rows)}"
assert hasattr(rows[0], "select"), "rows 元素应为 BeautifulSoup 解析出的行对象,请用 soup.select() 提取"
_got = [row.select("td")[1].get_text().strip() for row in rows]
assert _got == _expect, "提取的名称与靶站真实数据不一致,请检查选择器与下标" `,
      hintSteps: ["表格行在 <tbody> 里,每行是 <tr>。soup.select('tbody tr') 是标准做法。", "判分器会重新抓靶站逐行比对——所以必须真实解析,不能伪造列表。", "运行后应看到 '抓到行数: 24'。"],
      explanation: '「家居好物甄选」列表页是单页表格。测试用例式判定要求你真正解析出与靶站一致的数据——这是爬虫的核心:让代码与页面结构精确对应。',
    },
    {
      id: 'course-test-10-t2',
      title: '实操题 2:提取「商品」名称与价格',
      skills: ["解析"],
      maxScore: 10,
      question: `<h4>任务:抓取「家居好物甄选」榜单</h4><p>请求 <code>SITE_BASE + "/practice/course-test-10/"</code>,用 Python 爬虫解析页面数据。</p><p><strong>要点:</strong></p><ul><li>靶站为静态 HTML 表格,数据为虚构教学数据</li><li>判分器会<strong>独立重新抓取靶站</strong>生成期望值,与你提交的结果<strong>逐项比对</strong>,无法靠数行数或伪造变量通过</li><li>注意编码:<code>r.encoding = "utf-8"</code> 避免中文乱码</li></ul><p><strong>要求:</strong>遍历表格行,把每行的<strong>名称</strong>(第 2 个 td)与<strong>价格</strong>(第 5 个 td)提取为元组,全部存入变量 <code>items</code>。</p><p class="ce-q-spec">判定标准:items 必须与靶站真实数据<strong>逐条完全一致</strong>(名称与价格,含顺序)。</p>`,
      starter: `import requests
from bs4 import BeautifulSoup

r = requests.get(SITE_BASE + "/practice/course-test-10/", timeout=10)
r.encoding = "utf-8"
soup = BeautifulSoup(r.text, "html.parser")
rows = soup.select("tbody tr")

# TODO: 遍历 rows,提取每行的名称(td 第 2 列)与价格(td 第 5 列)为 (名称, 价格) 元组,
# 全部存入变量 items(提示: row.select("td") 取该行单元格)
# items = ...

print("条目数:", len(items))
print("样例:", items[0] if items else None)`,
      check: `import requests as _rq
from bs4 import BeautifulSoup as _bs
_src = _rq.get(SITE_BASE + "/practice/course-test-10/", timeout=10)
_src.encoding = "utf-8"
_soup = _bs(_src.text, "html.parser")
_expect = [(_tr.select("td")[1].get_text().strip(), _tr.select("td")[4].get_text().strip())
           for _tr in _soup.select("tbody tr")]
assert 'items' in globals() and isinstance(items, list), "请把提取结果存入变量 items"
assert len(items) == len(_expect), f"应提取 {len(_expect)} 条,实际 {len(items)}"
assert items == _expect, "提取的 (名称, 价格) 与靶站真实数据不一致,请检查列下标与去空白" `,
      hintSteps: ["每行有 6 个 td:编号/名称/类别/品牌/价格/评分。名称是第 2 个(td[1]),价格是第 5 个(td[4])。", "列表推导式 [ (row.select('td')[1].get_text().strip(), row.select('td')[4].get_text().strip()) for row in rows ]。", "用 .strip() 去掉首尾空白——判分器比对的是精确值,多余空格会导致不一致。"],
      explanation: '字段提取的关键是列定位:名称第 2 列、价格第 5 列。判定器用靶站真实数据逐条比对,这正是生产环境校验爬虫输出的方式。',
    },
    {
      id: 'course-test-10-t3',
      title: '实操题 3:直连「家居好物甄选」JSON 接口',
      skills: ["请求", "存储"],
      maxScore: 10,
      question: `<h4>任务:直连「家居好物甄选」JSON 接口</h4><p>请求 <code>/practice/course-test-10/api/items.json</code>,解析 JSON 数据。</p><p><strong>要求:</strong></p><ul><li>把 <code>data</code> 字段(条目列表)存入变量 <code>items</code></li><li>把 <code>total</code> 字段(总数)存入变量 <code>total</code></li></ul><p class="ce-q-spec">判定标准:items 必须与接口真实返回的 40 条数据完全一致;total == 40。判分器会独立请求接口比对。</p>`,
      starter: `import requests

# TODO: 请求 JSON 接口,用 .json() 解析
# 把 data 字段(列表)存入变量 items,把 total 字段存入变量 total
# data = requests.get(f"SITE_BASE/practice/course-test-10/api/items.json", timeout=10).json()
# items = ...
# total = ...

print("total:", total)
print("条目数:", len(items))`,
      check: `import requests as _rq
_exp = _rq.get(SITE_BASE + "/practice/course-test-10/api/items.json", timeout=10).json()
assert 'items' in globals() and isinstance(items, list), "请把 data 字段存入变量 items"
assert 'total' in globals(), "请把 total 字段存入变量 total"
assert total == _exp["total"], f"total 应为 {_exp['total']},实际 {total}"
assert len(items) == len(_exp["data"]), f"应返回 {len(_exp['data'])} 条,实际 {len(items)}"
assert items == _exp["data"], "items 与接口真实数据不一致,请检查取的是否为 data 字段" `,
      hintSteps: ["JSON 接口返回结构: code / message / total / data[]。", "data = requests.get(url, timeout=10).json() 一步拿到整个字典。", "items = data['data']; total = data['total'],然后打印验证。"],
      explanation: '直连 JSON 接口是效率最高的方式。判定器独立请求接口并逐条比对,确保你的解析与真实数据结构完全吻合。',
    }
  ]
};
