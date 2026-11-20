/**
 * 考试扩展题库 —— 供正式考试抽取的多/填/简/编程题型。
 *
 * 与概念题库(questions.ts)的关系:
 *  - 概念题库的 choice/truefalse 是低风险课内快速检索题,仍保留在课内诊断里;
 *  - 本文件补足"考试要覆盖多题型"的需求,加入 multi/fill/short/code。
 *  - 这些题目只在 buildPaper 抽取时进入考试;课内诊断题仍走 conceptQuestions,
 *    避免新增题型破坏现有 Quiz 组件渲染。
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
  // ── 单元一 · 爬虫基础 ─────────────────────────────────────────────
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
  // ── 单元二 · HTTP 基础 ─────────────────────────────────────────────
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
  // ── 单元三 · requests 基础 ─────────────────────────────────────────
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
  // ── 单元四 · BeautifulSoup ─────────────────────────────────────────
  {
    id: 'exm-04-m1',
    lessonId: '04-beautifulsoup',
    unitId: 'unit-1',
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
    unitId: 'unit-1',
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
  // ── 单元五 · XPath ───────────────────────────────────────────────
  {
    id: 'exm-05-m1',
    lessonId: '05-xpath',
    unitId: 'unit-1',
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
  // ── 单元六 · 单页解析 ─────────────────────────────────────────────
  {
    id: 'exm-06-c1',
    lessonId: '06-single-page',
    unitId: 'unit-1',
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
  // ── 单元七 · 翻页 ───────────────────────────────────────────────
  {
    id: 'exm-07-s1',
    lessonId: '07-pagination',
    unitId: 'unit-1',
    objectiveId: '07-pagination-1',
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
  // ── 单元八 · 多级详情 ───────────────────────────────────────────
  {
    id: 'exm-08-f1',
    lessonId: '08-multi-level',
    unitId: 'unit-1',
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
  // ── 单元九 · JSON 与存储 ────────────────────────────────────────
  {
    id: 'exm-09-s1',
    lessonId: '09-json-and-storage',
    unitId: 'unit-1',
    objectiveId: '09-json-and-storage-1',
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
  // ── 单元十 · 动态页面 ───────────────────────────────────────────
  {
    id: 'exm-10-f1',
    lessonId: '10-dynamic-pages',
    unitId: 'unit-1',
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
  // ── 单元十一 · 反爬 ───────────────────────────────────────────
  {
    id: 'exm-11-m1',
    lessonId: '11-anti-crawling',
    unitId: 'unit-1',
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
  // ── 单元十二 · 合规 ───────────────────────────────────────────
  {
    id: 'exm-12-f1',
    lessonId: '12-ethics',
    unitId: 'unit-1',
    objectiveId: '12-ethics-1',
    type: 'fill',
    level: 'remember',
    points: 5,
    anchor: '二、robots.txt',
    prompt: '爬取一个站点前,应先去访问它的 ______ 文件,确认目标路径没有被 Disallow。',
    accept: ['robots.txt'],
    explanation: 'robots.txt 声明站点允许/不允许抓取的路径。',
    skills: [],
    misconception: 'robots-legal-status',
  },
  // ── 单元十三 · 综合 ───────────────────────────────────────────
  {
    id: 'exm-13-s1',
    lessonId: '13-final-project',
    unitId: 'unit-1',
    objectiveId: '13-final-project-1',
    type: 'short',
    level: 'analyze',
    points: 5,
    anchor: '五、工程规范',
    prompt: '写一个稳定的爬虫,除了抓取逻辑外还应考虑哪两类问题?(写出任意一个关键词)',
    keywords: ['频率', '控频', '限流', 'sleep', '异常处理', '重试', '去重', '断点', '合规'],
    explanation: '稳定爬虫通常要处理控频/限流、异常重试、去重与断点续爬、合规等。',
    skills: [],
    misconception: 'monolith-script',
  },
];
