/**
 * 考试扩展题库(第二批) —— 在 exam-questions.ts 基础上再加 40 题。
 *
 * 目的:把每种题型的总量从 10 提到 20,题库从 70 提到 126(概念 56 + 扩展 70)。
 * 更深的题量让正式考试可组多套互不重复的卷,降低押题与短期重复率。
 *
 * 约定与 exam-questions.ts 完全一致:
 *  - unitId / lessonId 严格对应 course.ts;
 *  - multi.answer 为选中索引集合;fill.accept 任一命中;
 *  - short.keywords 任一命中;code.starter/check 走 Pyodide 判分。
 */
import type { ExamBankQuestion } from './exam-questions';

export const examQuestionsExtra: ExamBankQuestion[] = [
  // ══ 多选 · 10 题(每单元 2) ═══════════════════════════════════════
  {
    id: 'exm-x-m01', lessonId: '01-environment', unitId: 'unit-1', type: 'multi', level: 'understand', points: 5,
    anchor: '一、虚拟环境',
    prompt: '关于虚拟环境,下列说法正确的有哪些?(多选)',
    options: ['不同项目可用不同版本依赖而互不干扰', '激活后 pip install 的包装在该环境的 site-packages', '虚拟环境会复制一份新的 Python 解释器二进制', '删除 .venv 目录即可移除该环境的依赖'],
    answer: ['0', '1', '3'],
    explanation: '虚拟环境隔离的是"包"的安装位置,不复制新的解释器二进制(通常是软链接);删除目录即可清理。',
    skills: [], misconception: 'env-not-activated',
  },
  {
    id: 'exm-x-m02', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'multi', level: 'apply', points: 5,
    anchor: '六、超时与异常',
    prompt: '使用 requests 时,哪些做法有助于提升脚本健壮性?(多选)',
    options: ['为每个请求设置 timeout', '用 try/except 捕获 RequestException', '对每个请求都关闭异常处理,让错误直接暴露给用户', '对可重试的失败设置有限次数重试与退避'],
    answer: ['0', '1', '3'],
    explanation: '超时、异常捕获、有限重试都是健壮性手段;不捕获异常会让批量任务因单点失败而整体崩溃。',
    skills: [], misconception: 'fault-isolation',
  },
  {
    id: 'exm-x-m03', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'multi', level: 'apply', points: 5,
    anchor: '四、提取属性',
    prompt: '用 BeautifulSoup 提取链接绝对地址,哪些做法正确?(多选)',
    options: ['用 tag.get("href") 取属性值', '用 tag["href"] 取属性值', '用 urljoin(base, href) 把相对链接补全', '用 tag.get_text() 取 href'],
    answer: ['0', '1', '2'],
    explanation: 'get()/[] 都能取属性;相对链接要用 urljoin 补全。get_text() 取的是文本,不是属性值。',
    skills: [], misconception: 'detail-url-relative',
  },
  {
    id: 'exm-x-m04', lessonId: '06-single-page', unitId: 'unit-2', type: 'multi', level: 'understand', points: 5,
    anchor: '四、保存 CSV',
    prompt: '用 Python 保存 CSV 时,哪些做法能减少中文与换行问题?(多选)',
    options: ['open 时指定 encoding="utf-8-sig" 便于 Excel 识别中文', 'open 时加 newline="" 避免多余空行', '用 csv.writer 而不是手动 join 字符串', '把所有字段拼进一个单元格以省事'],
    answer: ['0', '1', '2'],
    explanation: 'utf-8-sig 带 BOM 兼容 Excel,newline="" 防空行,csv 模块正确处理逗号与引号。手动拼接字段会破坏 CSV 结构。',
    skills: [], misconception: 'csv-encoding',
  },
  {
    id: 'exm-x-m05', lessonId: '07-pagination', unitId: 'unit-3', type: 'multi', level: 'apply', points: 5,
    anchor: '三、终止条件',
    prompt: '判断翻页是否已经到最后一页,哪些信号可靠?(多选)',
    options: ['接口返回 has_next=false 或类似元信息', '下一页按钮消失或带 disabled 属性', '本页返回空数据列表', '把页数写到 999,抓到报错为止'],
    answer: ['0', '1', '2'],
    explanation: '元信息、分页控件、空数据都是可靠终止信号;硬编码超大页数会浪费请求甚至触发封禁。',
    skills: [], misconception: 'page-end-condition',
  },
  {
    id: 'exm-x-m06', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'multi', level: 'apply', points: 5,
    anchor: '三、存为 JSON',
    prompt: '用 json.dump 把含中文的字典写入文件,哪些参数设置合理?(多选)',
    options: ['ensure_ascii=False 保留中文可读', '指定 encoding="utf-8" 打开文件', '用 indent=2 便于人工查看(非必需但合理)', '不关闭文件,让系统稍后自动回收'],
    answer: ['0', '1', '2'],
    explanation: 'ensure_ascii=False 保留中文,utf-8 编码,indent 便于阅读。文件应显式关闭或用 with 管理,不能依赖系统回收。',
    skills: [], misconception: 'json-ensure-ascii',
  },
  {
    id: 'exm-x-m07', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'multi', level: 'understand', points: 5,
    anchor: '二、Playwright 基础',
    prompt: '关于 Playwright 抓动态页面,下列说法正确的有哪些?(多选)',
    options: ['它启动真实浏览器执行 JS,得到渲染后的 DOM', '可用 wait_for_selector 等待元素出现', '它比纯 requests 更快且资源消耗更低', '可拦截网络请求获取接口返回的 JSON'],
    answer: ['0', '1', '3'],
    explanation: 'Playwright 驱动真实浏览器,能等待元素、监听网络响应;但它更慢、更耗资源,不是"更快更轻量"。',
    skills: [], misconception: 'dynamic-wait',
  },
  {
    id: 'exm-x-m08', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'multi', level: 'apply', points: 5,
    anchor: '四、代理与频率',
    prompt: '收到 429 限流响应后,哪些处理方式合理?(多选)',
    options: ['降低请求频率', '遵循 Retry-After 头指定的等待时间', '采用指数退避重试', '用更多代理并发猛冲直到成功'],
    answer: ['0', '1', '2'],
    explanation: '降频、遵循 Retry-After、指数退避都是标准做法;并发猛冲只会更快触发更严的封禁。',
    skills: [], misconception: 'crawl-delay',
  },
  {
    id: 'exm-x-m09', lessonId: '12-ethics', unitId: 'unit-5', type: 'multi', level: 'understand', points: 5,
    anchor: '三、数据合规',
    prompt: '爬虫处理数据时,哪些做法符合个人信息保护的最小必要原则?(多选)',
    options: ['只采集完成目标所必需的字段', '对手机号、身份证等敏感信息做脱敏', '采集后长期留存全部原始数据以备不时之需', '明确数据用途,不超范围使用'],
    answer: ['0', '1', '3'],
    explanation: '最小必要 = 只采必需字段、脱敏、限定用途。无目的长期留存全部原始数据违背最小必要原则。',
    skills: [], misconception: 'personal-info',
  },
  {
    id: 'exm-x-m10', lessonId: '13-final-project', unitId: 'unit-5', type: 'multi', level: 'analyze', points: 5,
    anchor: '五、工程规范',
    prompt: '一个可长期稳定运行的爬虫项目,通常应具备哪些工程化能力?(多选)',
    options: ['结构化日志与错误告警', '断点续爬与去重', '配置与代码分离', '把所有状态只存在内存里,重启即丢'],
    answer: ['0', '1', '2'],
    explanation: '日志、续爬去重、配置分离都是长期运行的关键;状态只存内存会导致重启后从头开始,无法续爬。',
    skills: [], misconception: 'no-resume',
  },

  // ══ 填空 · 10 题(每单元 2) ═══════════════════════════════════════
  {
    id: 'exm-x-f01', lessonId: '02-http-basics', unitId: 'unit-1', type: 'fill', level: 'remember', points: 5,
    anchor: '一、请求与响应',
    prompt: 'HTTP 请求方法里,用于"读取资源、应当幂等"的最常见方法是 ______。',
    accept: ['get', 'GET'],
    explanation: 'GET 用于读取,语义上幂等且可缓存;POST 用于提交或改变状态。',
    skills: [], misconception: 'http-method-semantics',
  },
  {
    id: 'exm-x-f02', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'fill', level: 'understand', points: 5,
    anchor: '五、响应内容',
    prompt: 'requests 响应对象中,返回原始二进制字节的属性是 <code>resp.______</code>。',
    accept: ['content'],
    explanation: 'resp.content 是 bytes,resp.text 是解码后的字符串。下载图片用 content。',
    skills: [], misconception: 'resp-content-vs-text',
  },
  {
    id: 'exm-x-f03', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'fill', level: 'remember', points: 5,
    anchor: '三、CSS 选择器',
    prompt: 'CSS 选择器中,用符号 ______ 表示 class(如选取 class 为 item 的元素)。',
    accept: ['.', '点', '点号'],
    explanation: '<code>.item</code> 选 class,#id 选 id,裸名称选标签。',
    skills: [], misconception: 'css-combinator',
  },
  {
    id: 'exm-x-f04', lessonId: '05-xpath', unitId: 'unit-2', type: 'fill', level: 'remember', points: 5,
    anchor: '三、常用 XPath',
    prompt: 'XPath 中选取最后一个元素的谓词是 <code>[______()]</code>。',
    accept: ['last'],
    explanation: '<code>//li[last()]</code> 选取最后一个 li;XPath 位置下标从 1 开始。',
    skills: [], misconception: 'xpath-index-base',
  },
  {
    id: 'exm-x-f05', lessonId: '07-pagination', unitId: 'unit-3', type: 'fill', level: 'understand', points: 5,
    anchor: '二、识别分页规律',
    prompt: '若第 1、2 页 URL 分别是 <code>?page=1</code>、<code>?page=2</code>,变化的 <code>page</code> 称为分页 ______。',
    accept: ['参数', 'param', 'query'],
    explanation: '识别变化参数后用 params 传入循环即可翻页,比拼字符串更稳。',
    skills: [], misconception: 'page-param',
  },
  {
    id: 'exm-x-f06', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'fill', level: 'remember', points: 5,
    anchor: '四、SQLite 存储',
    prompt: 'sqlite3 中执行 INSERT 后,需调用连接的 ______() 方法提交事务,数据才会落盘。',
    accept: ['commit'],
    explanation: 'conn.commit() 提交事务;用 with conn 上下文会自动提交。',
    skills: [], misconception: 'sqlite-commit',
  },
  {
    id: 'exm-x-f07', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'fill', level: 'understand', points: 5,
    anchor: '三、等待策略',
    prompt: 'Playwright 中等待目标元素出现的常用方法是 <code>wait_for_______</code>。',
    accept: ['selector', 'selector()'],
    explanation: 'wait_for_selector 属于条件等待,比固定 sleep 更稳更快。',
    skills: [], misconception: 'wait-condition',
  },
  {
    id: 'exm-x-f08', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'fill', level: 'remember', points: 5,
    anchor: '二、请求头伪装',
    prompt: '服务器用来识别客户端浏览器类型、爬虫常需要伪装的请求头是 ______(填英文头名)。',
    accept: ['user-agent', 'ua'],
    explanation: 'User-Agent 声明客户端类型,是最基础的请求头伪装字段。',
    skills: [], misconception: 'ua-only',
  },
  {
    id: 'exm-x-f09', lessonId: '12-ethics', unitId: 'unit-5', type: 'fill', level: 'remember', points: 5,
    anchor: '二、robots.txt',
    prompt: 'robots.txt 中用 ______ 指令声明不希望爬虫访问的路径。',
    accept: ['disallow'],
    explanation: 'Disallow 声明禁止路径,Allow 声明允许路径,可按 User-agent 分段。',
    skills: [], misconception: 'robots-scope',
  },
  {
    id: 'exm-x-f10', lessonId: '13-final-project', unitId: 'unit-5', type: 'fill', level: 'remember', points: 5,
    anchor: '五、工程规范',
    prompt: 'Python 标准库中,支持分级(DEBUG/INFO/ERROR 等)记录的日志模块是 ______。',
    accept: ['logging'],
    explanation: 'logging 支持分级、时间戳、文件输出与过滤,优于 print。',
    skills: [], misconception: 'log-vs-print',
  },

  // ══ 简答 · 10 题(每单元 2) ═══════════════════════════════════════
  {
    id: 'exm-x-s01', lessonId: '01-environment', unitId: 'unit-1', type: 'short', level: 'understand', points: 5,
    anchor: '一、虚拟环境',
    prompt: '一句话说明虚拟环境解决了什么问题(写出关键词即可)。',
    keywords: ['隔离', '依赖', '版本', '冲突', '项目'],
    explanation: '虚拟环境隔离各项目的依赖与版本,避免相互冲突。',
    skills: [], misconception: 'pip-global-vs-venv',
  },
  {
    id: 'exm-x-s02', lessonId: '02-http-basics', unitId: 'unit-1', type: 'short', level: 'understand', points: 5,
    anchor: '三、状态码',
    prompt: '一句话说明 5xx 状态码通常表示什么(写出关键词即可)。',
    keywords: ['服务器', '服务端', '内部', '错误', '500'],
    explanation: '5xx 表示服务端自身出错,与客户端请求特征无关。',
    skills: [], misconception: 'status-code-confusion',
  },
  {
    id: 'exm-x-s03', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'short', level: 'understand', points: 5,
    anchor: '三、CSS 选择器',
    prompt: '一句话说明 CSS 选择器中 > 与空格的区别(写出关键词即可)。',
    keywords: ['直接', '子元素', '后代', '任意层级', '层级'],
    explanation: '> 只选直接子元素,空格选任意层级后代。',
    skills: [], misconception: 'css-combinator',
  },
  {
    id: 'exm-x-s04', lessonId: '06-single-page', unitId: 'unit-2', type: 'short', level: 'apply', points: 5,
    anchor: '四、保存数据',
    prompt: '一句话说明为什么保存中文 CSV 常使用 utf-8-sig 而不是 utf-8(写出关键词即可)。',
    keywords: ['bom', 'excel', '乱码', '识别'],
    explanation: 'utf-8-sig 带 BOM,Excel 才能正确识别中文,否则可能乱码。',
    skills: [], misconception: 'csv-encoding',
  },
  {
    id: 'exm-x-s05', lessonId: '08-multi-level', unitId: 'unit-3', type: 'short', level: 'understand', points: 5,
    anchor: '二、两级抓取',
    prompt: '一句话说明多级抓取中"去重"的目的(写出关键词即可)。',
    keywords: ['重复', '已抓', '集合', '浪费', '相同'],
    explanation: '去重避免重复请求同一详情,节省资源并保证数据唯一。',
    skills: [], misconception: 'dedupe-placement',
  },
  {
    id: 'exm-x-s06', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'short', level: 'understand', points: 5,
    anchor: '三、存为 JSON',
    prompt: '一句话说明 json.dump 中 ensure_ascii=False 的作用(写出关键词即可)。',
    keywords: ['中文', '转义', '可读', 'ascii'],
    explanation: 'ensure_ascii=False 让中文按原样写入而不是转成 \\u 转义,便于阅读。',
    skills: [], misconception: 'json-ensure-ascii',
  },
  {
    id: 'exm-x-s07', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'short', level: 'understand', points: 5,
    anchor: '一、判断是否动态',
    prompt: '一句话说明如何初步判断一个页面是否由 JS 动态渲染(写出关键词即可)。',
    keywords: ['源代码', '查看', '搜', '为空', '元素面板', 'js'],
    explanation: '对比"查看源代码"与元素面板:源码搜不到而面板能看到,多半是 JS 动态渲染。',
    skills: [], misconception: 'js-render-source',
  },
  {
    id: 'exm-x-s08', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'short', level: 'understand', points: 5,
    anchor: '四、频率控制',
    prompt: '一句话说明爬虫为什么要设置请求间隔(写出关键词即可)。',
    keywords: ['频率', '限流', '封', '服务器', '压力', '礼貌'],
    explanation: '控制频率降低对服务器压力,避免触发限流与封禁。',
    skills: [], misconception: 'sleep-purpose',
  },
  {
    id: 'exm-x-s09', lessonId: '12-ethics', unitId: 'unit-5', type: 'short', level: 'understand', points: 5,
    anchor: '三、数据合规',
    prompt: '一句话说明"把公开当可收集"为什么错误(写出关键词即可)。',
    keywords: ['授权', '合规', '个人信息', '必要', '同意', '用途'],
    explanation: '页面公开不等于可任意收集使用,仍须遵守合法、正当、必要与用途限制。',
    skills: [], misconception: 'public-equals-free',
  },
  {
    id: 'exm-x-s10', lessonId: '13-final-project', unitId: 'unit-5', type: 'short', level: 'analyze', points: 5,
    anchor: '五、工程规范',
    prompt: '一句话说明为什么爬虫需要断点续爬(写出关键词即可)。',
    keywords: ['中断', '重启', '续', '进度', '从头', '失败'],
    explanation: '长任务难免中断,断点续爬让程序从上次进度继续,避免从头重来。',
    skills: [], misconception: 'no-resume',
  },

  // ══ 编程 · 10 题(每单元 2) ═══════════════════════════════════════
  {
    id: 'exm-x-c01', lessonId: '01-environment', unitId: 'unit-1', type: 'code', level: 'apply', points: 10,
    anchor: '五、安装第三方库',
    prompt: '给定包名列表,用列表推导式把所有名字转成小写,存入变量 <code>lower_names</code> 并打印。',
    starter: `names = ['Requests', 'BEAUTIFULSOUP4', 'lxml']

# TODO: 转成全小写存入 lower_names
# lower_names = ...
print(lower_names)`,
    check: `assert 'lower_names' in globals() and isinstance(lower_names, list), "请把结果存入列表 lower_names"
assert lower_names == ['requests', 'beautifulsoup4', 'lxml'], f"结果不符: {lower_names}"`,
    explanation: '<code>[n.lower() for n in names]</code> 可批量转小写。',
    skills: [],
  },
  {
    id: 'exm-x-c02', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'code', level: 'apply', points: 10,
    anchor: '二、查询参数',
    prompt: '给定查询参数字典,用 <code>urllib.parse.urlencode</code> 把它编码为查询串,存入变量 <code>query</code> 并打印。',
    starter: `from urllib.parse import urlencode

params = {'q': 'python 爬虫', 'page': 2}

# TODO: 编码成查询串存入 query
# query = ...
print(query)`,
    check: `assert 'query' in globals() and isinstance(query, str), "请把结果存入字符串 query"
assert 'q=python' in query and '%E7%88%AC%E8%99%AB' in query and 'page=2' in query, f"编码不符: {query}"`,
    explanation: 'urlencode 会把中文编码为 %E7%88%AC%E8%99%AB,空格编码为 +,这正是 params 内部做的事。',
    skills: [],
  },
  {
    id: 'exm-x-c03', lessonId: '05-xpath', unitId: 'unit-2', type: 'code', level: 'apply', points: 10,
    anchor: '三、常用 XPath',
    prompt: '用 lxml 解析 HTML,提取所有 <code>&lt;a&gt;</code> 的文本,存入列表 <code>texts</code> 并打印。',
    starter: `from lxml import etree

html = "<div><a>甲</a><a>乙</a></div>"
root = etree.HTML(html)

# TODO: 用 xpath 取所有 a 的文本存入 texts
# texts = ...
print(texts)`,
    check: `assert 'texts' in globals() and isinstance(texts, list), "请把文本存入列表 texts"
assert texts == ['甲', '乙'], f"texts 应为 ['甲','乙'],实际 {texts}"`,
    explanation: '<code>root.xpath("//a/text()")</code> 直接取所有 a 的文本节点。',
    skills: [],
  },
  {
    id: 'exm-x-c04', lessonId: '06-single-page', unitId: 'unit-2', type: 'code', level: 'apply', points: 10,
    anchor: '四、保存 CSV',
    prompt: '给定行数据列表,把每行的 name 与 price 用 csv 模块写入变量 <code>buf</code>(StringIO)。',
    starter: `import csv, io

rows = [('Java', '59'), ('Python', '69')]
buf = io.StringIO()
writer = csv.writer(buf)

# TODO: 把每行写入 writer
# ...
result = buf.getvalue()
print(result)`,
    check: `assert 'result' in globals() and isinstance(result, str), "请确保写入后得到 result"
assert 'Java,59' in result and 'Python,69' in result, f"CSV 内容不符: {result}"`,
    explanation: '用 <code>writer.writerow(row)</code> 逐行写入,csv 模块会正确处理分隔符与转义。',
    skills: [],
  },
  {
    id: 'exm-x-c05', lessonId: '07-pagination', unitId: 'unit-3', type: 'code', level: 'apply', points: 10,
    anchor: '二、识别分页规律',
    prompt: '给定总页数 <code>total</code>,用 range 生成 1 到 total 的页码列表,存入 <code>pages</code> 并打印。',
    starter: `total = 5

# TODO: 生成页码列表 [1, 2, 3, 4, 5] 存入 pages
# pages = ...
print(pages)`,
    check: `assert 'pages' in globals() and pages == [1, 2, 3, 4, 5], f"pages 应为 [1..5],实际 {pages}"`,
    explanation: '<code>list(range(1, total + 1))</code> 注意右端点是排他的,所以要 +1。',
    skills: [],
  },
  {
    id: 'exm-x-c06', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'code', level: 'apply', points: 10,
    anchor: '二、解析嵌套 JSON',
    prompt: '给定 JSON 字符串,统计 <code>items</code> 中价格(price)大于 10 的元素个数,存入整数 <code>count</code> 并打印。',
    starter: `import json
raw = '{"items": [{"price": 8}, {"price": 15}, {"price": 20}]}'
obj = json.loads(raw)

# TODO: 统计 price > 10 的个数存入 count
# count = ...
print(count)`,
    check: `assert 'count' in globals() and isinstance(count, int), "请把个数存入整数 count"
assert count == 2, f"count 应为 2,实际 {count}"`,
    explanation: '<code>sum(1 for it in obj["items"] if it["price"] > 10)</code> 可统计满足条件的个数。',
    skills: [],
  },
  {
    id: 'exm-x-c07', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'code', level: 'apply', points: 10,
    anchor: '四、提取数据',
    prompt: '给定渲染后的 HTML 字符串,用 BeautifulSoup 提取所有 <code>class="name"</code> 元素的文本,存入列表 <code>names</code> 并打印。',
    starter: `from bs4 import BeautifulSoup
html = "<ul><li class='name'>A</li><li class='name'>B</li></ul>"
soup = BeautifulSoup(html, 'html.parser')

# TODO: 提取所有 .name 文本存入 names
# names = ...
print(names)`,
    check: `assert 'names' in globals() and isinstance(names, list), "请把文本存入列表 names"
assert names == ['A', 'B'], f"names 应为 ['A','B'],实际 {names}"`,
    explanation: '<code>[t.get_text() for t in soup.select(".name")]</code> 可批量提取文本。',
    skills: [],
  },
  {
    id: 'exm-x-c08', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'code', level: 'apply', points: 10,
    anchor: '二、请求头伪装',
    prompt: '给定请求头字典 <code>headers</code>,把 <code>Accept-Language</code> 设为 <code>zh-CN</code> 并打印字典。',
    starter: `headers = {'User-Agent': 'Mozilla/5.0'}

# TODO: 增加 Accept-Language 头,值为 zh-CN
# ...
print(headers)`,
    check: `assert isinstance(headers, dict), "headers 应保持字典"
assert headers.get('Accept-Language') == 'zh-CN', f"缺少正确的 Accept-Language: {headers}"`,
    explanation: '直接赋值 <code>headers["Accept-Language"] = "zh-CN"</code> 即可。',
    skills: [],
  },
  {
    id: 'exm-x-c09', lessonId: '12-ethics', unitId: 'unit-5', type: 'code', level: 'apply', points: 10,
    anchor: '二、robots.txt',
    prompt: '给定 robots.txt 的行列表 <code>lines</code>,把以 <code>Allow:</code> 开头的路径(去掉前缀并 strip)存入列表 <code>allowed</code> 并打印。',
    starter: `lines = ['User-agent: *', 'Disallow: /admin', 'Allow: /public']

# TODO: 提取所有 Allow 路径存入 allowed
# allowed = ...
print(allowed)`,
    check: `assert 'allowed' in globals() and isinstance(allowed, list), "请把路径存入列表 allowed"
assert allowed == ['/public'], f"allowed 应为 ['/public'],实际 {allowed}"`,
    explanation: '用 <code>line.startswith("Allow:")</code> 判断,切片去前缀后 <code>strip()</code>。',
    skills: [],
  },
  {
    id: 'exm-x-c10', lessonId: '13-final-project', unitId: 'unit-5', type: 'code', level: 'apply', points: 10,
    anchor: '四、串联流程',
    prompt: '给定价格字符串列表 <code>raw</code>,提取其中的数字并求和,存入数值变量 <code>total</code> 并打印。',
    starter: `raw = ['￥39', '￥58']

# TODO: 提取数字求和存入 total
# total = ...
print(total)`,
    check: `assert 'total' in globals(), "请把结果存入变量 total"
assert total == 97, f"total 应为 97,实际 {total}"`,
    explanation: '可用 <code>sum(int(s.strip("￥")) for s in raw)</code> 提取并求和。',
    skills: [],
  },
];
