/**
 * 考试扩展题库 —— 供正式考试抽取的多/填/简/编程题型。
 *
 * 与概念题库(questions.ts)的关系:
 *  - 概念题库的 choice/truefalse 是低风险课内快速检索题,仍保留在课内诊断里;
 *  - 本文件补足"考试要覆盖多题型"的需求,加入 multi/fill/short/code;
 *  - 这些题目只在 buildPaper 抽取时进入考试;课内诊断题仍走 conceptQuestions,
 *    避免新增题型破坏现有 Quiz 组件渲染。
 *
 * 覆盖范围(正式考试标准):
 *  - 5 个单元 × 每单元 8 题 = 40 题,每个单元都齐备 multi/fill/short/code 四种扩展题型;
 *  - 编程题合计 10 道,避免短期重复抽取;
 *  - unitId 与 lessonId 严格对应 course.ts,保证"按单元组卷"题型不单一。
 *
 * 判分约定(全部自动):
 *  - multi : answer 为选中索引集合,漏选/多选/错选均不得分
 *  - fill  : accept 为可接受答案(任一命中),大小写/首尾空白不敏感
 *  - short : keywords 为判分关键词,学生答案包含任一关键词即得分(可机判)
 *  - code  : starter 为预填代码,check 为隐藏判分代码,前端跑 Pyodide 判分
 */
import type { Question } from '../lib/types';

/** 考试扩展题:在 Question 基础上补充课/单元归属,并让 answer/skills 可选(由具体题型决定) */
export interface ExamBankQuestion extends Omit<Question, 'answer'> {
  lessonId: string;
  unitId: string;
  answer?: string[];
}

export const examQuestions: ExamBankQuestion[] = [
  // ══ 单元一 · 爬虫基础 ═══════════════════════════════════════════════
  {
    id: 'exm-01-m1',
    lessonId: '01-environment',
    unitId: 'unit-1',
    objectiveId: '01-environment-1',
    type: 'multi',
    level: 'understand',
    points: 5,
    anchor: '五、安装 requests 与 BeautifulSoup',
    prompt: '以下哪些是 Python 标准库自带、无需另外 pip 安装的模块?(多选)',
    options: ['<code>json</code>', '<code>requests</code>', '<code>re</code>', '<code>BeautifulSoup</code>', '<code>urllib</code>'],
    answer: ['0', '2', '4'],
    explanation: '<code>json</code>、<code>re</code>、<code>urllib</code> 都在 Python 标准库;<code>requests</code> 与 <code>BeautifulSoup</code> 是第三方库,需要 pip 安装。',
    skills: [],
    misconception: 'stdlib-vs-thirdparty',
  },
  {
    id: 'exm-01-f1',
    lessonId: '01-environment',
    unitId: 'unit-1',
    objectiveId: '01-environment-1',
    type: 'fill',
    level: 'remember',
    points: 5,
    anchor: '五、安装 requests 与 BeautifulSoup',
    prompt: '在终端安装 requests 库,常用的命令是 <code>pip install ______</code>。(填包名,不含命令)',
    accept: ['requests'],
    explanation: '标准写法是 <code>pip install requests</code>。',
    skills: [],
    misconception: 'install-typo',
  },
  {
    id: 'exm-02-m1',
    lessonId: '02-http-basics',
    unitId: 'unit-1',
    objectiveId: '02-http-basics-2',
    type: 'multi',
    level: 'apply',
    points: 5,
    anchor: '三、状态码',
    prompt: '以下哪些状态码表示"请求成功"或"资源可用"?(多选)',
    options: ['200', '201', '301', '404'],
    answer: ['0', '1'],
    explanation: '200 表示 OK,201 表示已创建(成功);301 是重定向、404 是未找到。',
    skills: [],
    misconception: 'status-code-mix',
  },
  {
    id: 'exm-02-s1',
    lessonId: '02-http-basics',
    unitId: 'unit-1',
    objectiveId: '02-http-basics-2',
    type: 'short',
    level: 'understand',
    points: 5,
    anchor: '三、状态码',
    prompt: '一句话说明 HTTP 状态码 404 表示什么?',
    keywords: ['未找到', '不存在', '没有', '找不', '404'],
    explanation: '404 表示服务器找不到请求的资源。',
    skills: [],
    misconception: '404-not-exist',
  },
  {
    id: 'exm-02-c1',
    lessonId: '02-http-basics',
    unitId: 'unit-1',
    objectiveId: '02-http-basics-2',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '三、状态码',
    prompt: '给定状态码列表 <code>statuses</code>,用列表推导式筛出所有 2xx(200–299)的状态码,存入变量 <code>success</code> 并打印。',
    starter: `statuses = [200, 301, 404, 500, 204]

# TODO: 用列表推导式筛出 200-299 的状态码存入 success
# success = ...
print("2xx:", success)`,
    check: `assert 'success' in globals() and isinstance(success, list), "请把结果存入列表 success"
assert success == [200, 204], f"success 应为 [200, 204],实际 {success}"`,
    explanation: '列表推导式 <code>[s for s in statuses if 200 &lt;= s &lt; 300]</code> 可筛出 2xx 状态码。',
    skills: [],
    misconception: 'status-range',
  },
  {
    id: 'exm-03-c1',
    lessonId: '03-requests-basics',
    unitId: 'unit-1',
    objectiveId: '03-requests-basics-3',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '五、响应内容与编码',
    prompt: '给定一段 JSON 字符串,解析它并把其中的 <code>total</code> 数值存入变量 <code>total</code>,再打印出来。',
    starter: `import json

payload = '{"code": 0, "total": "56", "data": []}'
data = json.loads(payload)

# TODO: 取出 total 并转成整数存入变量 total
# total = ...
print("total =", total)`,
    check: `assert 'total' in globals(), "请把 total 存入变量"
assert isinstance(total, int), "total 需要是整数(用 int() 转换)"
assert total == 56, f"total 应为 56,实际 {total}"`,
    explanation: '<code>json.loads</code> 解析字符串得到 dict,取 <code>data["total"]</code>(是字符串),再用 <code>int()</code> 转成整数。',
    skills: [],
  },
  {
    id: 'exm-03-f1',
    lessonId: '03-requests-basics',
    unitId: 'unit-1',
    objectiveId: '03-requests-basics-2',
    type: 'fill',
    level: 'understand',
    points: 5,
    anchor: '四、设置请求头',
    prompt: 'requests 中,通过 <code>requests.get(url, ______=..., timeout=10)</code> 传入键值对形式的请求参数。',
    accept: ['params'],
    explanation: 'GET 请求的参数用 <code>params</code> 关键字传入,requests 会自动拼接成查询串。',
    skills: [],
    misconception: 'params-vs-data',
  },
  {
    id: 'exm-03-s1',
    lessonId: '03-requests-basics',
    unitId: 'unit-1',
    objectiveId: '03-requests-basics-4',
    type: 'short',
    level: 'understand',
    points: 5,
    anchor: '六、Session 会话',
    prompt: '一句话说明 requests.Session 的主要作用(写出关键词即可)。',
    keywords: ['保持', '会话', 'cookie', '状态', '复用连接'],
    explanation: 'Session 会自动保持 Cookie 与连接,跨请求共享状态,适合需要登录的站点。',
    skills: [],
    misconception: 'session-purpose',
  },

  // ══ 单元二 · 数据解析 ═══════════════════════════════════════════════
  {
    id: 'exm-04-m1',
    lessonId: '04-beautifulsoup',
    unitId: 'unit-2',
    objectiveId: '04-beautifulsoup-2',
    type: 'multi',
    level: 'apply',
    points: 5,
    anchor: '三、三种定位方式',
    prompt: '用 BeautifulSoup 定位一个元素,以下哪些写法是合法的?(多选)',
    options: ['<code>soup.find("div")</code>', '<code>soup.select("div.item")</code>', '<code>soup.css("div")</code>', '<code>soup.select_one(".title")</code>'],
    answer: ['0', '1', '3'],
    explanation: 'find 与 select/select_one 都是 BS4 的合法定位 API;<code>css()</code> 不是 BS4 的方法。',
    skills: [],
    misconception: 'bs4-selector-typo',
  },
  {
    id: 'exm-04-c1',
    lessonId: '04-beautifulsoup',
    unitId: 'unit-2',
    objectiveId: '04-beautifulsoup-2',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '三、三种定位方式',
    prompt: '用 BeautifulSoup 解析下面 HTML,把所有 <code>&lt;li class="book"&gt;</code> 里的书名(<code>.title</code>)提取出来,存入列表变量 <code>titles</code>。',
    starter: `from bs4 import BeautifulSoup

html = "<ul class='books'><li class='book'><span class='title'>Python 入门</span></li><li class='book'><span class='title'>爬虫实战</span></li></ul>"
soup = BeautifulSoup(html, "html.parser")

# TODO: 遍历 li.book,取 .title 文本存入列表 titles
# titles = ...
print("书名:", titles)`,
    check: `_expect = ["Python 入门", "爬虫实战"]
assert 'titles' in globals() and isinstance(titles, list), "请把书名存入列表 titles"
assert titles == _expect, f"应为 {_expect},实际 {titles}"`,
    explanation: '用 <code>soup.select("li.book")</code> 遍历,每项 <code>select_one(".title").get_text()</code>。',
    skills: [],
  },
  {
    id: 'exm-04-f1',
    lessonId: '04-beautifulsoup',
    unitId: 'unit-2',
    objectiveId: '04-beautifulsoup-2',
    type: 'fill',
    level: 'understand',
    points: 5,
    anchor: '三、三种定位方式',
    prompt: '<code>soup.find_all("li")</code> 的返回值类型是 ______(填 "列表" 或 "list" 均可)。',
    accept: ['列表', 'list', 'resultset'],
    explanation: 'find_all 返回 <code>ResultSet</code>,行为与列表一致,可遍历、可索引。',
    skills: [],
    misconception: 'findall-return-type',
  },
  {
    id: 'exm-05-m1',
    lessonId: '05-xpath',
    unitId: 'unit-2',
    objectiveId: '05-xpath-1',
    type: 'multi',
    level: 'apply',
    points: 5,
    anchor: '三、常用 XPath 表达式',
    prompt: '以下哪些是合法的 XPath 表达式?(多选)',
    options: ['<code>//div</code>', '<code>//a[@href]</code>', '<code>div::class</code>', '<code>//li[3]</code>'],
    answer: ['0', '1', '3'],
    explanation: '<code>//div</code>、属性筛选 <code>//a[@href]</code>、按位置 <code>//li[3]</code> 都合法;<code>::</code> 不是 XPath 语法。',
    skills: [],
    misconception: 'xpath-syntax',
  },
  {
    id: 'exm-05-s1',
    lessonId: '05-xpath',
    unitId: 'unit-2',
    objectiveId: '05-xpath-1',
    type: 'short',
    level: 'understand',
    points: 5,
    anchor: '二、路径语法',
    prompt: '一句话说明 XPath 中 <code>/</code> 与 <code>//</code> 的区别(含关键词即可)。',
    keywords: ['根', '任意', '所有', '子', '后代', '整棵'],
    explanation: '<code>/</code> 从根节点开始逐级选取,<code>//</code> 从任意位置选取后代节点。',
    skills: [],
    misconception: 'xpath-slash-difference',
  },
  {
    id: 'exm-05-f1',
    lessonId: '05-xpath',
    unitId: 'unit-2',
    objectiveId: '05-xpath-2',
    type: 'fill',
    level: 'remember',
    points: 5,
    anchor: '一、lxml 解析',
    prompt: '用 lxml 解析 HTML 字符串时,常用 <code>etree.______(html)</code> 生成可调用 xpath() 的对象。',
    accept: ['html.fromstring', 'fromstring', 'html'],
    explanation: '<code>etree.fromstring()</code> 或 <code>etree.HTML()</code> 都能得到可 xpath 的对象。',
    skills: [],
    misconception: 'lxml-entry',
  },
  {
    id: 'exm-06-c1',
    lessonId: '06-single-page',
    unitId: 'unit-2',
    objectiveId: '06-single-page-1',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '三、提取字段',
    prompt: '给定一个表格 HTML,用 BeautifulSoup 把它每一行的书名与价格提取并配对,存入列表 <code>rows</code>(每个元素是 <code>{"title": ..., "price": ...}</code>)。',
    starter: `from bs4 import BeautifulSoup

html = "<table><tr><td>Java</td><td>59</td></tr><tr><td>Python</td><td>69</td></tr></table>"
soup = BeautifulSoup(html, "html.parser")

# TODO: 遍历表格行,把书名/价格配对存入 rows
# rows = []
print("rows:", rows)`,
    check: `_expect = [{"title": "Java", "price": "59"}, {"title": "Python", "price": "69"}]
assert 'rows' in globals() and isinstance(rows, list), "请把每行数据存入 rows"
assert rows == _expect, f"应为 {_expect},实际 {rows}"`,
    explanation: '遍历 <code>soup.find_all("tr")</code>,用 <code>td</code> 依次取书名与价格。',
    skills: [],
  },
  {
    id: 'exm-06-s1',
    lessonId: '06-single-page',
    unitId: 'unit-2',
    objectiveId: '06-single-page-2',
    type: 'short',
    level: 'apply',
    points: 5,
    anchor: '四、保存 CSV',
    prompt: '用 Python 标准库把列表数据写入 CSV 文件时,通常使用哪个模块?',
    keywords: ['csv', 'writer', 'dictwriter'],
    explanation: '<code>csv.writer</code> / <code>csv.DictWriter</code> 能正确处理逗号、引号与换行。',
    skills: [],
    misconception: 'csv-manual-join',
  },

  // ══ 单元三 · 进阶爬取 ═══════════════════════════════════════════════
  {
    id: 'exm-07-m1',
    lessonId: '07-pagination',
    unitId: 'unit-3',
    objectiveId: '07-pagination-1',
    type: 'multi',
    level: 'understand',
    points: 5,
    anchor: '二、识别分页规律',
    prompt: '识别分页 URL 规律时,以下哪些做法合理?(多选)',
    options: ['对比第 1、2 页 URL 找出变化参数', '直接假定最后一页是第 100 页', '观察是否存在"下一页"链接', '检查页码参数是否从 0 或 1 开始'],
    answer: ['0', '2', '3'],
    explanation: '应通过对比 URL、观察分页控件确定规律和起点;硬编码页数不可靠。',
    skills: [],
    misconception: 'pagination-guess',
  },
  {
    id: 'exm-07-c1',
    lessonId: '07-pagination',
    unitId: 'unit-3',
    objectiveId: '07-pagination-1',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '二、识别分页规律',
    prompt: '给定分页 URL 前缀 <code>base</code>,用循环生成第 1 到第 3 页的完整 URL 列表,存入变量 <code>urls</code> 并打印。',
    starter: `base = "https://example.com/books?page="

# TODO: 生成第 1~3 页的 URL 列表存入 urls
# urls = ...
print(urls)`,
    check: `_expect = ["https://example.com/books?page=1", "https://example.com/books?page=2", "https://example.com/books?page=3"]
assert 'urls' in globals() and isinstance(urls, list), "请把 URL 存入列表 urls"
assert urls == _expect, f"应为 {_expect},实际 {urls}"`,
    explanation: '用 <code>[base + str(i) for i in range(1, 4)]</code> 或 for 循环累加拼接。',
    skills: [],
  },
  {
    id: 'exm-07-s1',
    lessonId: '07-pagination',
    unitId: 'unit-3',
    objectiveId: '07-pagination-2',
    type: 'short',
    level: 'understand',
    points: 5,
    anchor: '三、终止条件',
    prompt: '翻页爬取时,判断"到底了"最可靠的方式是什么?(一句话即可,含关键词)',
    keywords: ['has_next', '空', '返回空', '下一页', 'false', '没有下一页'],
    explanation: '优先用接口返回的元信息(如 has_next)判断;没有时用"返回空数据"或下一页不存在来终止。',
    skills: [],
    misconception: 'page-end-condition',
  },
  {
    id: 'exm-08-m1',
    lessonId: '08-multi-level',
    unitId: 'unit-3',
    objectiveId: '08-multi-level-1',
    type: 'multi',
    level: 'understand',
    points: 5,
    anchor: '二、两级抓取',
    prompt: '设计"列表页 + 详情页"两级抓取时,以下哪些措施能避免重复抓同一详情?(多选)',
    options: ['用 set 记录已抓过的详情 URL', '抓之前先判断 ID 是否出现过', '每次都把请求频率提高一倍', '把已抓 URL 持久化到本地文件或数据库'],
    answer: ['0', '1', '3'],
    explanation: '去重靠"记录 + 判断";提高频率与去重无关,反而增加被封风险。',
    skills: [],
    misconception: 'dedup-strategy',
  },
  {
    id: 'exm-08-f1',
    lessonId: '08-multi-level',
    unitId: 'unit-3',
    objectiveId: '08-multi-level-2',
    type: 'fill',
    level: 'understand',
    points: 5,
    anchor: '二、两级抓取',
    prompt: '多级抓取的基本策略是:先抓列表页拿到每个详情的链接,再逐条请求 ______ 页提取完整字段。',
    accept: ['详情'],
    explanation: '多级抓取 = 列表页取链接 + 详情页取字段,两级配合。',
    skills: [],
    misconception: 'multi-level-order',
  },
  {
    id: 'exm-09-c1',
    lessonId: '09-json-and-storage',
    unitId: 'unit-3',
    objectiveId: '09-json-and-storage-1',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '二、解析嵌套 JSON',
    prompt: '给定嵌套 JSON 字符串,解析后把 <code>data.items</code> 里每个元素的 <code>name</code> 依次取出,存入列表 <code>names</code> 并打印。',
    starter: `import json

raw = '{"data": {"items": [{"name": "A", "price": 10}, {"name": "B", "price": 20}]}}'
obj = json.loads(raw)

# TODO: 取出每个 item 的 name,存入列表 names
# names = ...
print(names)`,
    check: `assert 'names' in globals() and isinstance(names, list), "请把名字存入列表 names"
assert names == ['A', 'B'], f"names 应为 ['A', 'B'],实际 {names}"`,
    explanation: '先 <code>obj["data"]["items"]</code> 拿到列表,再列表推导式取 <code>item["name"]</code>。',
    skills: [],
  },
  {
    id: 'exm-09-s1',
    lessonId: '09-json-and-storage',
    unitId: 'unit-3',
    objectiveId: '09-json-and-storage-2',
    type: 'short',
    level: 'apply',
    points: 5,
    anchor: '三、存为 JSON',
    prompt: '把 Python 字典 <code>data</code> 写入 JSON 文件(含中文),用 <code>json.dump</code>,应设置哪个参数让中文不被转义?',
    keywords: ['ensure_ascii', 'false', 'ensure'],
    explanation: '<code>json.dump(data, f, ensure_ascii=False)</code> 可保留中文可读。',
    skills: [],
    misconception: 'json-ensure-ascii',
  },
  {
    id: 'exm-09-f1',
    lessonId: '09-json-and-storage',
    unitId: 'unit-3',
    objectiveId: '09-json-and-storage-3',
    type: 'fill',
    level: 'remember',
    points: 5,
    anchor: '四、SQLite 存储',
    prompt: 'Python 标准库中操作 SQLite 的模块名是 ______。',
    accept: ['sqlite3', 'sqlite'],
    explanation: '<code>import sqlite3</code> 后用 <code>connect()</code> 连接数据库文件。',
    skills: [],
    misconception: 'sqlite-module-name',
  },

  // ══ 单元四 · 反爬与动态页面 ═════════════════════════════════════════
  {
    id: 'exm-10-m1',
    lessonId: '10-dynamic-pages',
    unitId: 'unit-4',
    objectiveId: '10-dynamic-pages-2',
    type: 'multi',
    level: 'understand',
    points: 5,
    anchor: '三、等待元素出现',
    prompt: '用 Playwright 抓取动态页面时,以下哪些做法合理?(多选)',
    options: ['用 waitForSelector 等待目标元素出现', '打开页面后立即取 HTML,不做任何等待', '等待网络请求返回后再提取', '用 page.content() 获取渲染后的 DOM'],
    answer: ['0', '2', '3'],
    explanation: '动态页面必须等待元素/请求完成;立即取 HTML 往往拿到的是空壳。',
    skills: [],
    misconception: 'dynamic-wait',
  },
  {
    id: 'exm-10-f1',
    lessonId: '10-dynamic-pages',
    unitId: 'unit-4',
    objectiveId: '10-dynamic-pages-1',
    type: 'fill',
    level: 'understand',
    points: 5,
    anchor: '一、先定位',
    prompt: '判断"数据是否在源码里"的标准动作是:页面右键 → 查看网页 ______ ,搜索目标关键词。',
    accept: ['源代码'],
    explanation: '查看源代码若搜得到关键词,说明数据在 HTML 里;搜不到多半是 JS 渲染。',
    skills: [],
    misconception: 'dynamic-diagnosis',
  },
  {
    id: 'exm-10-c1',
    lessonId: '10-dynamic-pages',
    unitId: 'unit-4',
    objectiveId: '10-dynamic-pages-3',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '四、提取数据',
    prompt: '给定一段含价格的 HTML 字符串,用 <code>re.findall</code> 把所有价格数字提取出来,存入字符串列表 <code>prices</code> 并打印。',
    starter: `import re

html = '<span class="price">39</span><span class="price">58</span>'

# TODO: 用 re.findall 提取所有价格数字,存入字符串列表 prices
# prices = ...
print(prices)`,
    check: `assert 'prices' in globals() and isinstance(prices, list), "请把价格存入列表 prices"
assert prices == ['39', '58'], f"prices 应为 ['39', '58'],实际 {prices}"`,
    explanation: '价格是纯数字,可用模式 <code>(\\d+)</code> 配合 findall 一次性取出。',
    skills: [],
  },
  {
    id: 'exm-10-s1',
    lessonId: '10-dynamic-pages',
    unitId: 'unit-4',
    objectiveId: '10-dynamic-pages-2',
    type: 'short',
    level: 'understand',
    points: 5,
    anchor: '三、等待元素出现',
    prompt: '一句话说明为什么抓取动态页面常常需要"等待"(写出关键词即可)。',
    keywords: ['渲染', 'js', '异步', '加载', '元素', '出现'],
    explanation: '数据由 JS 异步渲染,需要等元素真正出现在 DOM 后才能提取。',
    skills: [],
    misconception: 'dynamic-why-wait',
  },
  {
    id: 'exm-11-m1',
    lessonId: '11-anti-crawling',
    unitId: 'unit-4',
    objectiveId: '11-anti-crawling-1',
    type: 'multi',
    level: 'apply',
    points: 5,
    anchor: '一、先诊断',
    prompt: '遇到 403 Forbidden,以下哪些排查方向是合理的?(多选)',
    options: ['补全浏览器 User-Agent 等请求头', '把请求频率降到 1 秒 1 次', '更换成更大带宽的网络', '判断是否缺 Referer / Cookie'],
    answer: ['0', '1', '3'],
    explanation: '403 通常是"身份特征不像正常用户",UA、请求头、频率都可能相关;带宽不是 403 的原因。',
    skills: [],
    misconception: '403-cause',
  },
  {
    id: 'exm-11-f1',
    lessonId: '11-anti-crawling',
    unitId: 'unit-4',
    objectiveId: '11-anti-crawling-2',
    type: 'fill',
    level: 'remember',
    points: 5,
    anchor: '二、请求头伪装',
    prompt: '标识浏览器身份的请求头字段是 ______(填英文头名)。',
    accept: ['user-agent', 'ua'],
    explanation: '<code>User-Agent</code> 声明客户端类型,是最常用的伪装字段。',
    skills: [],
    misconception: 'user-agent-header',
  },
  {
    id: 'exm-11-c1',
    lessonId: '11-anti-crawling',
    unitId: 'unit-4',
    objectiveId: '11-anti-crawling-2',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '二、请求头伪装',
    prompt: '给定请求头字典 <code>headers</code>,请为它补充 <code>Referer</code> 字段,值为 <code>https://example.com</code>。',
    starter: `headers = {'User-Agent': 'Mozilla/5.0'}

# TODO: 给 headers 增加键 'Referer',值为 'https://example.com'
# ...
print(headers)`,
    check: `assert isinstance(headers, dict), "headers 应保持字典类型"
assert headers.get('Referer') == 'https://example.com', f"缺少正确的 Referer 请求头,实际 {headers}"`,
    explanation: '直接赋值 <code>headers["Referer"] = "https://example.com"</code> 即可。',
    skills: [],
  },
  {
    id: 'exm-11-s1',
    lessonId: '11-anti-crawling',
    unitId: 'unit-4',
    objectiveId: '11-anti-crawling-4',
    type: 'short',
    level: 'understand',
    points: 5,
    anchor: '四、代理与频率',
    prompt: '一句话说明爬虫为什么要控制请求频率(写出关键词即可)。',
    keywords: ['封', '反爬', '压力', '礼貌', '限流', '封禁', '服务器'],
    explanation: '过高频率会给服务器造成压力,也容易触发反爬导致 IP 被封。',
    skills: [],
    misconception: 'rate-limit-why',
  },

  // ══ 单元五 · 规范与综合实战 ═════════════════════════════════════════
  {
    id: 'exm-12-m1',
    lessonId: '12-ethics',
    unitId: 'unit-5',
    objectiveId: '12-ethics-1',
    type: 'multi',
    level: 'understand',
    points: 5,
    anchor: '二、robots.txt',
    prompt: '关于 robots.txt,以下哪些说法是正确的?(多选)',
    options: ['它声明站点允许/禁止抓取的路径', '它通常位于站点根目录 /robots.txt', '它是具有法律强制力的合同', 'Disallow 表示不希望爬虫访问该路径'],
    answer: ['0', '1', '3'],
    explanation: 'robots.txt 是抓取约定,不是法律合同;但尊重它是合规的基本要求。',
    skills: [],
    misconception: 'robots-legal-status',
  },
  {
    id: 'exm-12-f1',
    lessonId: '12-ethics',
    unitId: 'unit-5',
    objectiveId: '12-ethics-1',
    type: 'fill',
    level: 'remember',
    points: 5,
    anchor: '二、robots.txt',
    prompt: '爬取一个站点前,应先去访问它的 ______ 文件,确认目标路径没有被 Disallow。',
    accept: ['robots.txt'],
    explanation: 'robots.txt 声明站点允许/不允许抓取的路径。',
    skills: [],
    misconception: 'robots-file-name',
  },
  {
    id: 'exm-12-s1',
    lessonId: '12-ethics',
    unitId: 'unit-5',
    objectiveId: '12-ethics-3',
    type: 'short',
    level: 'understand',
    points: 5,
    anchor: '三、数据合规',
    prompt: '一句话说明爬取涉及个人信息数据时应遵守的基本原则(写出关键词即可)。',
    keywords: ['授权', '同意', '脱敏', '最小化', '隐私', '合法', '必要'],
    explanation: '应遵循合法、正当、必要原则,取得授权并对个人信息脱敏。',
    skills: [],
    misconception: 'personal-data-compliance',
  },
  {
    id: 'exm-12-c1',
    lessonId: '12-ethics',
    unitId: 'unit-5',
    objectiveId: '12-ethics-2',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '二、robots.txt',
    prompt: '给定 robots.txt 的内容行列表 <code>lines</code>,找出所有以 <code>Disallow:</code> 开头的行,把路径(去掉前缀并去掉首尾空白)依次存入列表 <code>disallowed</code> 并打印。',
    starter: `lines = ['User-agent: *', 'Disallow: /admin', 'Disallow: /private']

# TODO: 提取所有 Disallow 路径存入 disallowed,如 ['/admin', '/private']
# disallowed = ...
print(disallowed)`,
    check: `assert 'disallowed' in globals() and isinstance(disallowed, list), "请把路径存入列表 disallowed"
assert disallowed == ['/admin', '/private'], f"disallowed 应为 ['/admin', '/private'],实际 {disallowed}"`,
    explanation: '用 <code>line.startswith("Disallow:")</code> 判断,再用切片或 <code>replace</code> 去掉前缀并 <code>strip()</code>。',
    skills: [],
  },
  {
    id: 'exm-13-m1',
    lessonId: '13-final-project',
    unitId: 'unit-5',
    objectiveId: '13-final-project-3',
    type: 'multi',
    level: 'analyze',
    points: 5,
    anchor: '五、工程规范',
    prompt: '写一个可长期稳定运行的爬虫,以下哪些属于必要的工程化措施?(多选)',
    options: ['异常捕获与重试', '结构化日志', '去重与断点续爬', '把所有代码写进一个巨型函数'],
    answer: ['0', '1', '2'],
    explanation: '健壮性来自异常处理、日志、去重与断点等工程化设计;巨型函数不利于维护。',
    skills: [],
    misconception: 'monolith-script',
  },
  {
    id: 'exm-13-f1',
    lessonId: '13-final-project',
    unitId: 'unit-5',
    objectiveId: '13-final-project-3',
    type: 'fill',
    level: 'remember',
    points: 5,
    anchor: '五、工程规范',
    prompt: 'Python 标准库中记录日志常用的模块名是 ______。',
    accept: ['logging', 'log'],
    explanation: '<code>import logging</code> 可输出分级日志,便于排错与监控。',
    skills: [],
    misconception: 'logging-module',
  },
  {
    id: 'exm-13-s1',
    lessonId: '13-final-project',
    unitId: 'unit-5',
    objectiveId: '13-final-project-2',
    type: 'short',
    level: 'analyze',
    points: 5,
    anchor: '五、工程规范',
    prompt: '写一个稳定的爬虫,除了抓取逻辑外还应考虑哪两类问题?(写出任意一个关键词)',
    keywords: ['频率', '控频', '限流', 'sleep', '异常处理', '重试', '去重', '断点', '合规'],
    explanation: '稳定爬虫通常要处理控频/限流、异常重试、去重与断点续爬、合规等。',
    skills: [],
    misconception: 'stability-factors',
  },
  {
    id: 'exm-13-c1',
    lessonId: '13-final-project',
    unitId: 'unit-5',
    objectiveId: '13-final-project-2',
    type: 'code',
    level: 'apply',
    points: 10,
    anchor: '四、串联流程',
    prompt: '给定商品列表 HTML,用 BeautifulSoup 统计 class 为 <code>item</code> 的 <code>&lt;li&gt;</code> 元素个数,存入整数变量 <code>count</code> 并打印。',
    starter: `from bs4 import BeautifulSoup

html = "<ul><li class='item'>A<span>10</span></li><li class='item'>B<span>20</span></li></ul>"
soup = BeautifulSoup(html, 'html.parser')

# TODO: 统计 .item 元素个数,存入整数 count
# count = ...
print(count)`,
    check: `assert 'count' in globals() and isinstance(count, int), "请把数量存入整数变量 count"
assert count == 2, f"count 应为 2,实际 {count}"`,
    explanation: '<code>len(soup.select("li.item"))</code> 即可得到匹配元素个数。',
    skills: [],
  },
];
