/**
 * 考试扩展题库(第三批) —— 在 exam-questions / exam-questions-extra 基础上再加 80 题。
 * 每题型 20 题(multi/fill/short/code),全站扩展题达 160 题。
 * 约束:unitId 按 course.ts 对齐;code 的 check 为 Pyodide 可判的 assert 代码。
 */
import type { ExamBankQuestion } from './exam-questions.ts';

export const examQuestionsExtra2: ExamBankQuestion[] = [
  // ══ 多选 · 20 题(每单元 4) ═══════════════════════════════════════
  {
    id: 'exm-y2-m01', lessonId: '01-environment', unitId: 'unit-1', type: 'multi', level: 'understand', points: 5,
    objectiveId: '01-environment-2', anchor: '二、依赖管理',
    prompt: '关于 pip 与依赖管理,下列说法正确的有哪些?(多选)',
    options: ['pip freeze > requirements.txt 可导出当前环境的依赖清单', 'pip install -r requirements.txt 可批量安装清单里的依赖', 'requirements.txt 中固定(pin)依赖版本有利于环境复现', '虚拟环境创建后必须手动复制一份 Python 解释器才能使用'],
    answer: ['0', '1', '2'],
    explanation: 'freeze 导出、install -r 安装、固定版本都利于环境复现;虚拟环境通过脚本/软链即可用,无需手动复制解释器。',
    skills: [], misconception: 'version-pin',
  },
  {
    id: 'exm-y2-m02', lessonId: '02-http-basics', unitId: 'unit-1', type: 'multi', level: 'understand', points: 5,
    objectiveId: '02-http-basics-1', anchor: '二、请求方法',
    prompt: '关于 HTTP 的 GET 与 POST 方法,下列说法正确的有哪些?(多选)',
    options: ['GET 的参数通常附在 URL 查询串里', 'POST 的参数通常放在请求体(body)里', 'GET 语义上应幂等,适合读取资源', 'GET 请求绝对不能携带任何数据,否则一定报错'],
    answer: ['0', '1', '2'],
    explanation: 'GET 用查询串、POST 用请求体,GET 幂等适合读取;GET 也能带查询数据,并非"绝对不能携带数据"。',
    skills: [], misconception: 'http-method-semantics',
  },
  {
    id: 'exm-y2-m03', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'multi', level: 'apply', points: 5,
    objectiveId: '03-requests-basics-1', anchor: '二、查询参数',
    prompt: '用 requests 发送带查询参数的 GET 请求,下列做法正确的有哪些?(多选)',
    options: ['用 params=字典 传入,requests 会自动编码', 'params 中的中文会被自动 URL 编码', '可给 params 传列表来处理同名多值参数', '应把参数手工拼接到 URL 字符串里,params 不可靠'],
    answer: ['0', '1', '2'],
    explanation: 'params 会自动编码中文与特殊字符,也支持列表多值;手拼 URL 易出错且漏编码。',
    skills: [], misconception: 'url-encoding',
  },
  {
    id: 'exm-y2-m04', lessonId: '02-http-basics', unitId: 'unit-1', type: 'multi', level: 'understand', points: 5,
    objectiveId: '02-http-basics-2', anchor: '三、状态码',
    prompt: '关于 HTTP 状态码的分类,下列说法正确的有哪些?(多选)',
    options: ['2xx 表示请求成功', '3xx 通常与重定向有关', '4xx 表示客户端请求有问题', '5xx 表示客户端浏览器版本过低'],
    answer: ['0', '1', '2'],
    explanation: '2xx 成功、3xx 重定向、4xx 客户端错误、5xx 服务端错误;5xx 与浏览器版本无关。',
    skills: [], misconception: 'status-2xx-vs-3xx',
  },
  {
    id: 'exm-y2-m05', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'multi', level: 'apply', points: 5,
    objectiveId: '04-beautifulsoup-2', anchor: '三、CSS 选择器',
    prompt: '用 BeautifulSoup 选取元素,下列说法正确的有哪些?(多选)',
    options: ['soup.select(".item") 返回所有 class 含 item 的元素列表', 'soup.find_all("a") 返回所有 a 标签的列表', 'soup.find("a") 只返回第一个 a 标签', 'select 与 find_all 的参数语法完全相同,可随意互换'],
    answer: ['0', '1', '2'],
    explanation: 'select 用 CSS 选择器、find_all 用标签名/属性,语法不同;find 只取第一个。',
    skills: [], misconception: 'select-vs-find',
  },
  {
    id: 'exm-y2-m06', lessonId: '05-xpath', unitId: 'unit-2', type: 'multi', level: 'understand', points: 5,
    objectiveId: '05-xpath-2', anchor: '三、常用 XPath',
    prompt: '关于 XPath 语法,下列说法正确的有哪些?(多选)',
    options: ['//a 选取文档中所有 a 元素,不限层级', '/html/body 从根节点按层级逐级选取', '//a/text() 选取 a 元素内的文本节点', 'XPath 的结果下标从 0 开始'],
    answer: ['0', '1', '2'],
    explanation: '// 跨层级、/ 逐级、text() 取文本;XPath 位置谓词下标从 1 开始,不是 0。',
    skills: [], misconception: 'xpath-index-base',
  },
  {
    id: 'exm-y2-m07', lessonId: '06-single-page', unitId: 'unit-2', type: 'multi', level: 'apply', points: 5,
    objectiveId: '06-single-page-3', anchor: '四、保存 CSV',
    prompt: '用 csv 模块保存中文数据,下列做法正确的有哪些?(多选)',
    options: ['打开文件加 newline="" 避免多余空行', '编码用 utf-8-sig 便于 Excel 正确识别中文', '用 csv.writer 而不是手动逗号拼接', '为了省事把所有字段拼进同一个单元格'],
    answer: ['0', '1', '2'],
    explanation: 'newline=""、utf-8-sig、csv.writer 都是规范做法;把所有字段塞进一个单元格会破坏 CSV 结构。',
    skills: [], misconception: 'csv-newline',
  },
  {
    id: 'exm-y2-m08', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'multi', level: 'understand', points: 5,
    objectiveId: '04-beautifulsoup-3', anchor: '四、提取文本与属性',
    prompt: '关于 BeautifulSoup 提取内容,下列说法正确的有哪些?(多选)',
    options: ['tag.get_text() 返回标签内的所有文本', 'tag["href"] 可取出 href 属性值', 'tag.get("class") 通常以列表形式返回 class', 'str(tag) 与 tag.get_text() 返回的内容完全一样'],
    answer: ['0', '1', '2'],
    explanation: 'get_text 取文本、[]/get 取属性、class 是多值属性返回列表;str(tag) 含标签本身,与纯文本不同。',
    skills: [], misconception: 'get-text-vs-str',
  },
  {
    id: 'exm-y2-m09', lessonId: '07-pagination', unitId: 'unit-3', type: 'multi', level: 'apply', points: 5,
    objectiveId: '07-pagination-2', anchor: '二、识别分页规律',
    prompt: '抓取分页列表时,哪些做法合理?(多选)',
    options: ['用 params 传入变化的页码参数', '以"下一页"链接是否存在作为循环条件', '遇到空数据页就停止抓取', '从第 1 页一直抓到第 9999 页,靠报错结束'],
    answer: ['0', '1', '2'],
    explanation: 'params 翻页、按下一页/空数据终止都合理;硬编码超大页数是反模式。',
    skills: [], misconception: 'page-param',
  },
  {
    id: 'exm-y2-m10', lessonId: '08-multi-level', unitId: 'unit-3', type: 'multi', level: 'apply', points: 5,
    objectiveId: '08-multi-level-2', anchor: '二、两级抓取',
    prompt: '做列表—详情两级抓取时,哪些做法有助于稳定与去重?(多选)',
    options: ['用集合记录已抓取的详情页 URL,避免重复请求', '把相对详情链接用 urljoin 补全成绝对地址', '对失败的详情请求做有限重试并隔离错误', '对每个详情页都无条件重复抓取三遍以确保完整'],
    answer: ['0', '1', '2'],
    explanation: '集合去重、urljoin 补全、失败隔离都有价值;无条件重复抓三遍纯属浪费且易触发封禁。',
    skills: [], misconception: 'dedupe-placement',
  },
  {
    id: 'exm-y2-m11', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'multi', level: 'apply', points: 5,
    objectiveId: '09-json-and-storage-2', anchor: '三、存为 JSON',
    prompt: '用 json.dump 保存含中文的数据,下列参数设置合理的有哪些?(多选)',
    options: ['ensure_ascii=False 让中文保持可读', '打开文件指定 encoding="utf-8"', 'indent=2 让结构更易读', '把文件句柄丢弃、依赖垃圾回收自动关闭'],
    answer: ['0', '1', '2'],
    explanation: 'ensure_ascii=False、utf-8、indent 都合理;应显式关闭文件(用 with),不能依赖 GC。',
    skills: [], misconception: 'json-vs-text',
  },
  {
    id: 'exm-y2-m12', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'multi', level: 'apply', points: 5,
    objectiveId: '09-json-and-storage-3', anchor: '四、SQLite 存储',
    prompt: '用 sqlite3 存储抓取结果,哪些做法正确?(多选)',
    options: ['执行 INSERT/UPDATE 后调用 conn.commit() 提交', '用主键或唯一约束配合 UPSERT 实现幂等入库', '用 with conn 上下文可自动提交或回滚', '每次插入都新建连接且不关闭,交给系统回收'],
    answer: ['0', '1', '2'],
    explanation: 'commit、幂等 UPSERT、with 上下文都正确;频繁新建且不关闭连接会耗尽资源。',
    skills: [], misconception: 'upsert-missing',
  },
  {
    id: 'exm-y2-m13', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'multi', level: 'understand', points: 5,
    objectiveId: '10-dynamic-pages-2', anchor: '二、Playwright 基础',
    prompt: '关于用 Playwright 抓取动态页面,下列说法正确的有哪些?(多选)',
    options: ['它驱动真实浏览器执行 JS,拿到渲染后的 DOM', '可用 page.wait_for_selector 等待元素出现', '它比纯 requests 更快、更省资源', '可监听网络响应直接拿到接口返回的 JSON'],
    answer: ['0', '1', '3'],
    explanation: 'Playwright 能执行 JS、条件等待、监听响应;但启动浏览器更慢、更耗资源。',
    skills: [], misconception: 'wait-condition',
  },
  {
    id: 'exm-y2-m14', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'multi', level: 'understand', points: 5,
    objectiveId: '11-anti-crawling-2', anchor: '二、请求头伪装',
    prompt: '设置 requests 请求头时,哪些说法是正确的?(多选)',
    options: ['请求头字段名大小写不敏感,User-Agent 写成 user-agent 通常也有效', '除 User-Agent 外,Referer、Accept-Language 也常被检查', '只用随机 User-Agent 就足以绕过所有反爬', '把常用请求头集中成字典复用便于管理'],
    answer: ['0', '1', '3'],
    explanation: 'HTTP 头名大小写不敏感,多个头都可能被校验,集中管理便于维护;但只改 UA 远不够。',
    skills: [], misconception: 'header-case',
  },
  {
    id: 'exm-y2-m15', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'multi', level: 'apply', points: 5,
    objectiveId: '11-anti-crawling-3', anchor: '三、状态码与限流',
    prompt: '遇到 401/403/429 响应,哪些理解或处理合理?(多选)',
    options: ['401 通常表示未认证,需要凭据', '403 通常表示已识别但被禁止访问', '429 表示请求过多被限流,应降频或按 Retry-After 等待', '一律换更多代理高并发猛冲直到成功'],
    answer: ['0', '1', '2'],
    explanation: '401 未认证、403 禁止、429 限流需降频;并发猛冲只会招致更严的封禁。',
    skills: [], misconception: '429-response',
  },
  {
    id: 'exm-y2-m16', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'multi', level: 'analyze', points: 5,
    objectiveId: '10-dynamic-pages-1', anchor: '一、动态页面判断',
    prompt: '如何判断一个页面是否由 JS 动态渲染?(多选)',
    options: ['查看"查看源代码"里是否已有目标数据', '对比浏览器渲染后的 DOM 与原始 HTML 是否不同', 'requests 抓到的 HTML 无数据但浏览器可见数据,大概率是动态渲染', '只要页面 URL 里带参数就一定是动态渲染'],
    answer: ['0', '1', '2'],
    explanation: '源代码与渲染 DOM 对比是标准诊断法;URL 带参数不能说明是动态渲染。',
    skills: [], misconception: 'js-render-source',
  },
  {
    id: 'exm-y2-m17', lessonId: '12-ethics', unitId: 'unit-5', type: 'multi', level: 'understand', points: 5,
    objectiveId: '12-ethics-1', anchor: '一、robots.txt',
    prompt: '关于 robots.txt,下列说法正确的有哪些?(多选)',
    options: ['它声明站点希望爬虫遵守的抓取规则', '可用 User-agent 对不同爬虫分别设定规则', 'Disallow 表示不希望被抓取的路径', 'robots.txt 具有强制法律效力,违反一定构成犯罪'],
    answer: ['0', '1', '2'],
    explanation: 'robots.txt 是抓取约定,按 UA 分组、Disallow 禁抓;它本身不是法律,违反不必然构成犯罪。',
    skills: [], misconception: 'robots-legal-status',
  },
  {
    id: 'exm-y2-m18', lessonId: '12-ethics', unitId: 'unit-5', type: 'multi', level: 'understand', points: 5,
    objectiveId: '12-ethics-2', anchor: '二、数据与合规',
    prompt: '关于数据合规,下列说法正确的有哪些?(多选)',
    options: ['"公开可见"不等于"可任意收集使用"', '应遵守最小必要,只采目标所需字段', '对手机号、身份证等敏感信息应脱敏', '采集到的个人信息可随意转卖变现'],
    answer: ['0', '1', '2'],
    explanation: '公开≠可自由收集,最小必要、脱敏是基本合规要求;转卖个人信息明显违法违规。',
    skills: [], misconception: 'public-equals-free',
  },
  {
    id: 'exm-y2-m19', lessonId: '13-final-project', unitId: 'unit-5', type: 'multi', level: 'analyze', points: 5,
    objectiveId: '13-final-project-2', anchor: '四、工程规范',
    prompt: '一个可维护的爬虫项目,通常应具备哪些特性?(多选)',
    options: ['抓取、解析、存储分层,模块职责单一', '配置(URL、间隔)与代码分离', '使用 logging 而非满屏 print', '所有逻辑堆在一个脚本里,变量全用全局'],
    answer: ['0', '1', '2'],
    explanation: '分层、配置分离、结构化日志都利于维护;单文件全局变量堆砌难以维护与复用。',
    skills: [], misconception: 'monolith-script',
  },
  {
    id: 'exm-y2-m20', lessonId: '13-final-project', unitId: 'unit-5', type: 'multi', level: 'apply', points: 5,
    objectiveId: '13-final-project-3', anchor: '五、断点续爬',
    prompt: '为爬虫实现断点续爬,通常需要哪些机制?(多选)',
    options: ['把已成功抓取的任务/URL 持久化到文件或数据库', '重启时跳过已完成任务,从上次进度继续', '记录失败任务以便后续重试', '每次重启都清空所有记录,从头全量重抓'],
    answer: ['0', '1', '2'],
    explanation: '持久化进度、跳过已完成、记录失败都支撑续爬;每次清空重抓违背断点续爬。',
    skills: [], misconception: 'no-resume',
  },

  // ══ 填空 · 20 题(每单元 4) ═══════════════════════════════════════
  {
    id: 'exm-y2-f01', lessonId: '01-environment', unitId: 'unit-1', type: 'fill', level: 'remember', points: 5,
    objectiveId: '01-environment-2', anchor: '二、依赖清单',
    prompt: '用 pip 导出当前环境依赖到 requirements.txt,常用命令是 <code>pip ______ &gt; requirements.txt</code>。',
    accept: ['freeze'],
    explanation: 'pip freeze > requirements.txt 导出已安装包及版本。',
    skills: [], misconception: 'version-pin',
  },
  {
    id: 'exm-y2-f02', lessonId: '02-http-basics', unitId: 'unit-1', type: 'fill', level: 'remember', points: 5,
    objectiveId: '02-http-basics-3', anchor: '三、状态码',
    prompt: 'HTTP 状态码 ______ 通常表示"未授权、需要身份验证"。(填三位数字)',
    accept: ['401'],
    explanation: '401 表示未认证;403 是已认证但被禁止。',
    skills: [], misconception: 'status-code-confusion',
  },
  {
    id: 'exm-y2-f03', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'fill', level: 'remember', points: 5,
    objectiveId: '03-requests-basics-3', anchor: '三、响应对象',
    prompt: 'requests 响应对象中,表示响应状态码的属性是 <code>resp.______</code>。',
    accept: ['status_code'],
    explanation: 'resp.status_code 是整数状态码;resp.ok 可快速判断是否 2xx/3xx。',
    skills: [], misconception: 'status-2xx-vs-3xx',
  },
  {
    id: 'exm-y2-f04', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'fill', level: 'understand', points: 5,
    objectiveId: '03-requests-basics-4', anchor: '四、会话保持',
    prompt: 'requests 中用于跨请求保持 Cookie 与会话的对象是 <code>requests.______()</code>。(填类名)',
    accept: ['session', 'session()'],
    explanation: 'Session 对象会自动在多次请求间携带 Cookie。',
    skills: [], misconception: 'session-vs-stateless',
  },
  {
    id: 'exm-y2-f05', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'fill', level: 'remember', points: 5,
    objectiveId: '04-beautifulsoup-2', anchor: '三、CSS 选择器',
    prompt: 'BeautifulSoup 中按 CSS 选择器选取多个元素的方法是 <code>soup.______(".item")</code>。',
    accept: ['select', 'select()'],
    explanation: 'select 接收 CSS 选择器并返回列表;find_all 用标签名/属性参数。',
    skills: [], misconception: 'select-vs-find',
  },
  {
    id: 'exm-y2-f06', lessonId: '05-xpath', unitId: 'unit-2', type: 'fill', level: 'remember', points: 5,
    objectiveId: '05-xpath-3', anchor: '三、常用 XPath',
    prompt: 'XPath 中用于选取节点内部文本的函数是 ______()。',
    accept: ['text', 'text()'],
    explanation: '如 //a/text() 取 a 的文本节点;取属性用 @href。',
    skills: [], misconception: 'xpath-axis',
  },
  {
    id: 'exm-y2-f07', lessonId: '06-single-page', unitId: 'unit-2', type: 'fill', level: 'understand', points: 5,
    objectiveId: '06-single-page-3', anchor: '四、保存 CSV',
    prompt: '用 csv.writer 写中文 CSV 时,open 文件常指定编码 ______ 以兼容 Excel。(填编码名)',
    accept: ['utf-8-sig', 'utf_8_sig'],
    explanation: 'utf-8-sig 带 BOM,Excel 打开中文不乱码。',
    skills: [], misconception: 'csv-encoding',
  },
  {
    id: 'exm-y2-f08', lessonId: '05-xpath', unitId: 'unit-2', type: 'fill', level: 'remember', points: 5,
    objectiveId: '05-xpath-2', anchor: '二、节点选择',
    prompt: 'XPath 谓词 <code>[______]</code> 可选取第一个元素。(填数字)',
    accept: ['1'],
    explanation: 'XPath 位置下标从 1 开始,[1] 取第一个,[last()] 取最后一个。',
    skills: [], misconception: 'xpath-index-base',
  },
  {
    id: 'exm-y2-f09', lessonId: '07-pagination', unitId: 'unit-3', type: 'fill', level: 'understand', points: 5,
    objectiveId: '07-pagination-3', anchor: '三、循环边界',
    prompt: '<code>range(1, total + 1)</code> 能生成 1..total 的页码,是因为 range 的右端点 ______。(填"含"或"不含")',
    accept: ['不含', '不包含', 'exclusive'],
    explanation: 'range 左闭右开,所以需 total+1 才能包含 total 本身。',
    skills: [], misconception: 'range-off-by-one',
  },
  {
    id: 'exm-y2-f10', lessonId: '08-multi-level', unitId: 'unit-3', type: 'fill', level: 'understand', points: 5,
    objectiveId: '08-multi-level-1', anchor: '一、链接补全',
    prompt: '把相对 URL 补全为绝对 URL,应使用 <code>urllib.parse</code> 的 ______ 函数。',
    accept: ['urljoin', 'urljoin()'],
    explanation: 'urljoin(base, href) 能正确处理相对路径与协议相对 URL。',
    skills: [], misconception: 'detail-url-relative',
  },
  {
    id: 'exm-y2-f11', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'fill', level: 'remember', points: 5,
    objectiveId: '09-json-and-storage-1', anchor: '二、解析 JSON',
    prompt: '把 JSON 格式的字符串解析为 Python 对象,用 <code>json.______()</code>。',
    accept: ['loads', 'loads()'],
    explanation: 'json.loads 解析字符串;json.load 解析文件对象。',
    skills: [], misconception: 'json-vs-text',
  },
  {
    id: 'exm-y2-f12', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'fill', level: 'remember', points: 5,
    objectiveId: '09-json-and-storage-3', anchor: '四、SQLite 存储',
    prompt: 'sqlite3 中,用游标的 ______() 方法执行 SQL 语句。(填方法名)',
    accept: ['execute', 'execute()'],
    explanation: 'cursor.execute(sql, params) 执行 SQL,参数化可防注入。',
    skills: [], misconception: 'sqlite-commit',
  },
  {
    id: 'exm-y2-f13', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'fill', level: 'understand', points: 5,
    objectiveId: '10-dynamic-pages-1', anchor: '一、动态页面判断',
    prompt: '若页面源代码里没有目标数据、浏览器渲染后才出现,说明数据由 ______ 动态生成。(填语言名)',
    accept: ['javascript', 'js'],
    explanation: 'JS 在浏览器端执行后填充 DOM,原始 HTML 里自然看不到。',
    skills: [], misconception: 'dynamic-diagnosis',
  },
  {
    id: 'exm-y2-f14', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'fill', level: 'remember', points: 5,
    objectiveId: '11-anti-crawling-4', anchor: '四、限流响应',
    prompt: 'HTTP 响应头中,服务器提示限流后应等待多久的头是 ______。(填英文头名)',
    accept: ['retry-after'],
    explanation: 'Retry-After 给出建议等待秒数或日期,应遵守。',
    skills: [], misconception: '429-response',
  },
  {
    id: 'exm-y2-f15', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'fill', level: 'remember', points: 5,
    objectiveId: '11-anti-crawling-3', anchor: '三、状态码与限流',
    prompt: 'HTTP 状态码 ______ 表示"请求过多、被限流"。(填三位数字)',
    accept: ['429'],
    explanation: '429 Too Many Requests 表示客户端发送请求过多。',
    skills: [], misconception: '429-response',
  },
  {
    id: 'exm-y2-f16', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'fill', level: 'remember', points: 5,
    objectiveId: '10-dynamic-pages-2', anchor: '二、Playwright 基础',
    prompt: 'Playwright 中用于点击元素的页面方法是 <code>page.______()</code>。(填方法名)',
    accept: ['click', 'click()'],
    explanation: 'page.click(selector) 模拟点击,常与 wait_for_selector 配合使用。',
    skills: [], misconception: 'wait-condition',
  },
  {
    id: 'exm-y2-f17', lessonId: '12-ethics', unitId: 'unit-5', type: 'fill', level: 'remember', points: 5,
    objectiveId: '12-ethics-1', anchor: '一、robots.txt',
    prompt: 'robots.txt 中用于声明抓取间隔(秒)的指令是 ______。(填英文,小写)',
    accept: ['crawl-delay'],
    explanation: 'Crawl-delay 建议两次抓取的最小间隔,应予以尊重。',
    skills: [], misconception: 'crawl-delay',
  },
  {
    id: 'exm-y2-f18', lessonId: '12-ethics', unitId: 'unit-5', type: 'fill', level: 'understand', points: 5,
    objectiveId: '12-ethics-3', anchor: '三、数据合规',
    prompt: '采集并发布他人文章时,应尊重原作者的 ______ 权,不应大段复制原文。(填两字)',
    accept: ['著作', '版权'],
    explanation: '著作权保护表达,未经许可大段复制可能侵权。',
    skills: [], misconception: 'public-equals-free',
  },
  {
    id: 'exm-y2-f19', lessonId: '13-final-project', unitId: 'unit-5', type: 'fill', level: 'understand', points: 5,
    objectiveId: '13-final-project-1', anchor: '一、项目分层',
    prompt: '把爬虫拆成抓取、解析、存储等职责单一的模块,这种方式称为 ______ 化。(填两字)',
    accept: ['模块', '分层'],
    explanation: '模块化/分层让各部分可独立维护与复用。',
    skills: [], misconception: 'monolith-script',
  },
  {
    id: 'exm-y2-f20', lessonId: '13-final-project', unitId: 'unit-5', type: 'fill', level: 'remember', points: 5,
    objectiveId: '13-final-project-3', anchor: '五、断点续爬',
    prompt: '记录已抓取 URL、重启后跳过以继续抓取的机制,称为断点 ______。(填两字)',
    accept: ['续爬', '续抓'],
    explanation: '断点续爬让任务中断后能从进度处继续,避免全量重抓。',
    skills: [], misconception: 'no-resume',
  },

  // ══ 简答 · 20 题(每单元 4) ═══════════════════════════════════════
  {
    id: 'exm-y2-s01', lessonId: '01-environment', unitId: 'unit-1', type: 'short', level: 'understand', points: 5,
    objectiveId: '01-environment-2', anchor: '二、依赖清单',
    prompt: '一句话说明 requirements.txt 的作用(写出关键词即可)。',
    keywords: ['依赖', '版本', '安装', '复现', '清单'],
    explanation: 'requirements.txt 记录依赖及版本,便于在新环境批量安装、复现环境。',
    skills: [], misconception: 'version-pin',
  },
  {
    id: 'exm-y2-s02', lessonId: '02-http-basics', unitId: 'unit-1', type: 'short', level: 'understand', points: 5,
    objectiveId: '02-http-basics-4', anchor: '五、重定向',
    prompt: '一句话说明 3xx 状态码的含义(写出关键词即可)。',
    keywords: ['重定向', '跳转', '位置', 'location', '临时', '永久'],
    explanation: '3xx 表示需要进一步操作(通常是重定向),目标地址在 Location 头。',
    skills: [], misconception: 'status-2xx-vs-3xx',
  },
  {
    id: 'exm-y2-s03', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'short', level: 'understand', points: 5,
    objectiveId: '03-requests-basics-4', anchor: '六、超时与异常',
    prompt: '一句话说明为什么 requests 请求要设置 timeout(写出关键词即可)。',
    keywords: ['超时', '阻塞', '卡住', '挂起', '等待', '无限'],
    explanation: '不设超时,请求可能长期挂起,拖垮整个批量任务。',
    skills: [], misconception: 'no-timeout',
  },
  {
    id: 'exm-y2-s04', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'short', level: 'understand', points: 5,
    objectiveId: '03-requests-basics-4', anchor: '四、会话保持',
    prompt: '一句话说明 Session 相比直接 requests.get 的好处(写出关键词即可)。',
    keywords: ['会话', 'cookie', '复用', '保持', '连接', '登录'],
    explanation: 'Session 跨请求保持 Cookie 与连接,适合需要登录或复用连接的场景。',
    skills: [], misconception: 'session-vs-stateless',
  },
  {
    id: 'exm-y2-s05', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'short', level: 'understand', points: 5,
    objectiveId: '04-beautifulsoup-2', anchor: '三、CSS 选择器',
    prompt: '一句话说明 find 与 find_all 的区别(写出关键词即可)。',
    keywords: ['第一个', '所有', '单个', '列表', '全部'],
    explanation: 'find 返回第一个匹配元素,find_all 返回所有匹配元素的列表。',
    skills: [], misconception: 'select-vs-find',
  },
  {
    id: 'exm-y2-s06', lessonId: '05-xpath', unitId: 'unit-2', type: 'short', level: 'understand', points: 5,
    objectiveId: '05-xpath-1', anchor: '二、路径表达式',
    prompt: '一句话说明 XPath 中 // 与 / 的区别(写出关键词即可)。',
    keywords: ['任意', '层级', '根', '直接', '逐级', '子'],
    explanation: '// 从任意层级选取后代,/ 从当前或根节点按层级逐级选取。',
    skills: [], misconception: 'xpath-axis',
  },
  {
    id: 'exm-y2-s07', lessonId: '06-single-page', unitId: 'unit-2', type: 'short', level: 'understand', points: 5,
    objectiveId: '06-single-page-1', anchor: '一、三段式流程',
    prompt: '一句话说明"抓取—解析—存储"三段式的好处(写出关键词即可)。',
    keywords: ['抓取', '解析', '存储', '分离', '解耦', '复用'],
    explanation: '三段式让各阶段职责清晰,便于单独调试、替换与复用。',
    skills: [], misconception: 'fetch-parse-store',
  },
  {
    id: 'exm-y2-s08', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'short', level: 'understand', points: 5,
    objectiveId: '04-beautifulsoup-3', anchor: '四、提取文本',
    prompt: '一句话说明 get_text() 与 str(tag) 的区别(写出关键词即可)。',
    keywords: ['文本', '标签', '属性', '字符串', '子节点'],
    explanation: 'get_text() 只取内部文本,str(tag) 包含标签本身及属性。',
    skills: [], misconception: 'get-text-vs-str',
  },
  {
    id: 'exm-y2-s09', lessonId: '07-pagination', unitId: 'unit-3', type: 'short', level: 'apply', points: 5,
    objectiveId: '07-pagination-2', anchor: '二、识别分页规律',
    prompt: '一句话说明如何判断分页已到最后一页(写出关键词即可)。',
    keywords: ['下一页', '空', '禁用', '终止', '结束', 'has_next'],
    explanation: '当"下一页"按钮消失、被禁用或返回空数据时即可停止翻页。',
    skills: [],
  },
  {
    id: 'exm-y2-s10', lessonId: '08-multi-level', unitId: 'unit-3', type: 'short', level: 'apply', points: 5,
    objectiveId: '08-multi-level-3', anchor: '三、失败处理',
    prompt: '一句话说明为什么多级抓取中要隔离单条失败(写出关键词即可)。',
    keywords: ['异常', '捕获', 'try', '跳过', '重试', '隔离'],
    explanation: '用 try/except 包住单条详情请求,失败时跳过或重试,避免整体任务中断。',
    skills: [], misconception: 'fault-isolation',
  },
  {
    id: 'exm-y2-s11', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'short', level: 'understand', points: 5,
    objectiveId: '09-json-and-storage-2', anchor: '二、解析 JSON',
    prompt: '一句话说明 json.loads 的作用(写出关键词即可)。',
    keywords: ['字符串', '对象', '解析', '字典', 'loads'],
    explanation: 'json.loads 把 JSON 字符串解析成 Python 的 dict/list 等对象。',
    skills: [], misconception: 'json-vs-text',
  },
  {
    id: 'exm-y2-s12', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'short', level: 'understand', points: 5,
    objectiveId: '09-json-and-storage-3', anchor: '四、SQLite 存储',
    prompt: '一句话说明为什么要做幂等入库(UPSERT)(写出关键词即可)。',
    keywords: ['幂等', '重复', '更新', '插入', '主键', '覆盖'],
    explanation: '重复运行时 UPSERT 会更新已有记录而非插入重复行,保证数据唯一。',
    skills: [], misconception: 'upsert-missing',
  },
  {
    id: 'exm-y2-s13', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'short', level: 'understand', points: 5,
    objectiveId: '10-dynamic-pages-1', anchor: '一、动态页面判断',
    prompt: '一句话说明为什么 requests 抓到的页面没有浏览器里能看到的数据(写出关键词即可)。',
    keywords: ['JavaScript', 'js', '渲染', '动态', '执行'],
    explanation: '数据由浏览器执行 JS 后动态填充,requests 只拿到未执行的原始 HTML。',
    skills: [], misconception: 'dynamic-diagnosis',
  },
  {
    id: 'exm-y2-s14', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'short', level: 'understand', points: 5,
    objectiveId: '11-anti-crawling-3', anchor: '三、状态码与限流',
    prompt: '一句话说明 403 状态码通常意味着什么(写出关键词即可)。',
    keywords: ['禁止', '拒绝', '权限', '身份', '访问'],
    explanation: '403 Forbidden 表示服务器理解请求但拒绝执行,常见于无权限或被识别。',
    skills: [],
  },
  {
    id: 'exm-y2-s15', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'short', level: 'understand', points: 5,
    objectiveId: '11-anti-crawling-2', anchor: '二、请求头伪装',
    prompt: '一句话说明为什么只改 User-Agent 往往不够(写出关键词即可)。',
    keywords: ['请求头', 'cookie', '指纹', '特征', '浏览器', 'referer'],
    explanation: '服务器还会检查 Cookie、Referer、浏览器指纹等多重特征,仅改 UA 容易被识破。',
    skills: [], misconception: 'ua-only',
  },
  {
    id: 'exm-y2-s16', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'short', level: 'apply', points: 5,
    objectiveId: '10-dynamic-pages-3', anchor: '三、等待策略',
    prompt: '一句话说明条件等待(如 wait_for_selector)优于固定 sleep 的原因(写出关键词即可)。',
    keywords: ['条件', '元素', '固定', 'sleep', '稳定', '效率'],
    explanation: '条件等到目标出现即继续,既稳定又不浪费固定等待时间。',
    skills: [], misconception: 'fixed-sleep',
  },
  {
    id: 'exm-y2-s17', lessonId: '12-ethics', unitId: 'unit-5', type: 'short', level: 'understand', points: 5,
    objectiveId: '12-ethics-1', anchor: '一、robots.txt',
    prompt: '一句话说明 robots.txt 的法律/约束地位(写出关键词即可)。',
    keywords: ['协议', '规范', '约定', '自愿', '效力', '法律'],
    explanation: 'robots.txt 是行业约定,通常不具强制法律效力,但应被尊重。',
    skills: [], misconception: 'robots-legal-status',
  },
  {
    id: 'exm-y2-s18', lessonId: '12-ethics', unitId: 'unit-5', type: 'short', level: 'understand', points: 5,
    objectiveId: '12-ethics-2', anchor: '二、数据合规',
    prompt: '一句话说明"公开数据不等于可随意收集"的道理(写出关键词即可)。',
    keywords: ['公开', '授权', '合规', '个人信息', '最小', '用途'],
    explanation: '公开可见不代表可任意收集使用,仍须遵守合规与最小必要原则。',
    skills: [], misconception: 'public-equals-free',
  },
  {
    id: 'exm-y2-s19', lessonId: '13-final-project', unitId: 'unit-5', type: 'short', level: 'analyze', points: 5,
    objectiveId: '13-final-project-1', anchor: '一、项目分层',
    prompt: '一句话说明为什么不建议把所有爬虫逻辑写在一个脚本里(写出关键词即可)。',
    keywords: ['模块', '分层', '维护', '复用', '调试', '结构'],
    explanation: '单文件脚本难以维护、调试与复用,分层模块化更清晰。',
    skills: [], misconception: 'monolith-script',
  },
  {
    id: 'exm-y2-s20', lessonId: '13-final-project', unitId: 'unit-5', type: 'short', level: 'understand', points: 5,
    objectiveId: '13-final-project-4', anchor: '四、日志与文档',
    prompt: '一句话说明用 logging 代替 print 的好处(写出关键词即可)。',
    keywords: ['分级', '日志', '时间', '文件', '过滤', '输出'],
    explanation: 'logging 支持分级、时间戳、文件输出与过滤,便于排障与归档。',
    skills: [], misconception: 'log-vs-print',
  },

  // ══ 编程 · 20 题(每单元 4) ═══════════════════════════════════════
  {
    id: 'exm-y2-c01', lessonId: '01-environment', unitId: 'unit-1', type: 'code', level: 'apply', points: 10,
    objectiveId: '01-environment-1', anchor: '二、依赖管理',
    prompt: '给定依赖字符串列表 <code>deps</code>(形如 <code>requests==2.28.0</code>、<code>lxml&gt;=4.9</code>),提取每个字符串里的包名(<code>==</code> 或 <code>&gt;=</code> 前的部分),存入列表 <code>names</code> 并打印。',
    starter: `deps = ['requests==2.28.0', 'beautifulsoup4==4.11.1', 'lxml>=4.9']

# TODO: 提取每个依赖的包名存入列表 names
# 提示: 可用 re.split 按 = < > 切分后取第一段
# names = ...
print(names)`,
    check: `assert 'names' in globals() and isinstance(names, list), "请把包名存入列表 names"
assert names == ['requests', 'beautifulsoup4', 'lxml'], f"names 应为 ['requests','beautifulsoup4','lxml'],实际 {names}"`,
    explanation: '用 <code>re.split(r"[=&lt;&gt;]", s)[0]</code> 或按符号切分即可取出包名。',
    skills: [],
  },
  {
    id: 'exm-y2-c02', lessonId: '02-http-basics', unitId: 'unit-1', type: 'code', level: 'apply', points: 10,
    objectiveId: '02-http-basics-2', anchor: '三、状态码',
    prompt: '给定状态码列表 <code>codes</code>,统计其中 4xx 与 5xx(即 &gt;=400)的个数,存入整数 <code>error_count</code> 并打印。',
    starter: `codes = [200, 301, 404, 500, 204, 403]

# TODO: 统计 >=400 的状态码个数存入 error_count
# error_count = ...
print(error_count)`,
    check: `assert 'error_count' in globals() and isinstance(error_count, int), "请把个数存入整数 error_count"
assert error_count == 3, f"error_count 应为 3,实际 {error_count}"`,
    explanation: '可用 <code>sum(1 for c in codes if c &gt;= 400)</code> 统计错误状态码个数。',
    skills: [],
  },
  {
    id: 'exm-y2-c03', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'code', level: 'apply', points: 10,
    objectiveId: '03-requests-basics-1', anchor: '二、查询参数',
    prompt: '给定查询参数字典 <code>params</code>,按 key 排序后拼成 <code>key=value</code> 形式、用 <code>&amp;</code> 连接的查询串,存入 <code>query</code> 并打印。',
    starter: `params = {'page': 2, 'q': 'python', 'sort': 'new'}

# TODO: 按 key 排序拼成查询串存入 query
# 例: 'page=2&q=python&sort=new'
# query = ...
print(query)`,
    check: `assert 'query' in globals() and isinstance(query, str), "请把查询串存入字符串 query"
assert query == 'page=2&q=python&sort=new', f"query 不符: {query}"`,
    explanation: '可用 <code>"&".join(f"{k}={v}" for k in sorted(params))</code> 按序拼接。',
    skills: [],
  },
  {
    id: 'exm-y2-c04', lessonId: '03-requests-basics', unitId: 'unit-1', type: 'code', level: 'apply', points: 10,
    objectiveId: '03-requests-basics-3', anchor: '三、响应内容',
    prompt: '给定空格分隔的词串 <code>text</code>,统计每个单词出现次数,存入字典 <code>freq</code> 并打印。',
    starter: `text = "python requests python json python"

# TODO: 统计每个单词出现次数存入字典 freq
# freq = ...
print(freq)`,
    check: `assert 'freq' in globals() and isinstance(freq, dict), "请把词频存入字典 freq"
assert freq == {'python': 3, 'requests': 1, 'json': 1}, f"freq 不符: {freq}"`,
    explanation: '遍历 <code>text.split()</code>,用字典累加每个词的计数。',
    skills: [],
  },
  {
    id: 'exm-y2-c05', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'code', level: 'apply', points: 10,
    objectiveId: '04-beautifulsoup-2', anchor: '三、CSS 选择器',
    prompt: '给定 HTML 字符串 <code>html</code>,用 <code>re.findall</code> 提取所有 <code>&lt;li&gt;</code> 标签之间的文本,存入列表 <code>fruits</code> 并打印。',
    starter: `import re
html = "<li>苹果</li><li>香蕉</li><li>橘子</li>"

# TODO: 用 re.findall 提取所有 li 标签之间的文本存入 fruits
# 提示: 匹配 <li> 与 </li> 之间的任意内容
# fruits = ...
print(fruits)`,
    check: `assert 'fruits' in globals() and isinstance(fruits, list), "请把文本存入列表 fruits"
assert fruits == ['苹果', '香蕉', '橘子'], f"fruits 不符: {fruits}"`,
    explanation: '正则 <code>&lt;li&gt;(.*?)&lt;/li&gt;</code> 配合 re.findall 可取出所有 li 文本。',
    skills: [],
  },
  {
    id: 'exm-y2-c06', lessonId: '05-xpath', unitId: 'unit-2', type: 'code', level: 'apply', points: 10,
    objectiveId: '05-xpath-3', anchor: '三、常用 XPath',
    prompt: '给定 HTML 字符串 <code>html</code>,用 <code>re.findall</code> 提取所有 <code>href</code> 属性的值,存入列表 <code>links</code> 并打印(模拟 XPath 的 //a/@href)。',
    starter: `import re
html = '<a href="/p/1">一</a><a href="/p/2">二</a>'

# TODO: 用 re.findall 提取所有 href 的值存入 links
# 提示: 匹配 href 后等号加引号包裹的内容
# links = ...
print(links)`,
    check: `assert 'links' in globals() and isinstance(links, list), "请把链接存入列表 links"
assert links == ['/p/1', '/p/2'], f"links 不符: {links}"`,
    explanation: '用捕获组匹配 href="..." 中的值,即得到所有链接地址。',
    skills: [],
  },
  {
    id: 'exm-y2-c07', lessonId: '06-single-page', unitId: 'unit-2', type: 'code', level: 'apply', points: 10,
    objectiveId: '06-single-page-3', anchor: '四、保存 CSV',
    prompt: '给定字典列表 <code>rows</code>,用 <code>csv.DictWriter</code> 写入 <code>StringIO</code>(含表头),结果存入字符串 <code>result</code> 并打印。',
    starter: `import csv, io
rows = [{'name': '苹果', 'price': '5'}, {'name': '香蕉', 'price': '6'}]
buf = io.StringIO()
writer = csv.DictWriter(buf, fieldnames=['name', 'price'])

# TODO: 写入表头与每一行,把 buf.getvalue() 存入 result
# ...
result = buf.getvalue()
print(result)`,
    check: `assert 'result' in globals() and isinstance(result, str), "请确保写入后得到字符串 result"
assert 'name,price' in result and '苹果,5' in result and '香蕉,6' in result, f"result 不符: {result}"`,
    explanation: '先 <code>writer.writeheader()</code>,再逐行 <code>writer.writerow(row)</code>。',
    skills: [],
  },
  {
    id: 'exm-y2-c08', lessonId: '04-beautifulsoup', unitId: 'unit-2', type: 'code', level: 'apply', points: 10,
    objectiveId: '04-beautifulsoup-1', anchor: '二、解析 HTML',
    prompt: '给定文本 <code>text</code>,用 <code>re.findall</code> 提取其中所有整数(字符串形式),存入列表 <code>nums</code> 并打印。',
    starter: `import re
text = "共 12 页,当前第 3 页,还有 9 条"

# TODO: 用 re.findall 提取所有连续数字存入 nums
# 提示: 匹配一个或多个数字
# nums = ...
print(nums)`,
    check: `assert 'nums' in globals() and isinstance(nums, list), "请把数字存入列表 nums"
assert nums == ['12', '3', '9'], f"nums 不符: {nums}"`,
    explanation: '用匹配连续数字的正则配合 re.findall 即可得到字符串形式的整数列表。',
    skills: [],
  },
  {
    id: 'exm-y2-c09', lessonId: '07-pagination', unitId: 'unit-3', type: 'code', level: 'apply', points: 10,
    objectiveId: '07-pagination-1', anchor: '二、识别分页规律',
    prompt: '给定列表页基地址 <code>base</code> 与总页数 <code>total</code>,生成第 1 到 total 页的 URL 列表(格式为 base 加页码),存入 <code>urls</code> 并打印。',
    starter: `base = "https://example.com/list?page="
total = 4

# TODO: 生成页码 1..total 的 URL 列表存入 urls
# urls = ...
print(urls)`,
    check: `assert 'urls' in globals() and isinstance(urls, list), "请把 URL 存入列表 urls"
assert urls == ['https://example.com/list?page=1', 'https://example.com/list?page=2', 'https://example.com/list?page=3', 'https://example.com/list?page=4'], f"urls 不符: {urls}"`,
    explanation: '用 <code>[base + str(i) for i in range(1, total + 1)]</code>,注意右端点要 +1。',
    skills: [],
  },
  {
    id: 'exm-y2-c10', lessonId: '08-multi-level', unitId: 'unit-3', type: 'code', level: 'apply', points: 10,
    objectiveId: '08-multi-level-2', anchor: '二、两级抓取',
    prompt: '给定可能含重复的详情页 URL 列表 <code>urls</code>,去重并保持原有顺序,存入列表 <code>unique</code> 并打印。',
    starter: `urls = ['/p/1', '/p/2', '/p/1', '/p/3', '/p/2']

# TODO: 去重且保持原有顺序存入 unique
# 提示: dict.fromkeys 能保序去重
# unique = ...
print(unique)`,
    check: `assert 'unique' in globals() and isinstance(unique, list), "请把结果存入列表 unique"
assert unique == ['/p/1', '/p/2', '/p/3'], f"unique 不符: {unique}"`,
    explanation: '<code>list(dict.fromkeys(urls))</code> 可去重且保持首次出现顺序。',
    skills: [],
  },
  {
    id: 'exm-y2-c11', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'code', level: 'apply', points: 10,
    objectiveId: '09-json-and-storage-2', anchor: '二、解析嵌套 JSON',
    prompt: '给定 JSON 字符串 <code>raw</code>,解析后取出 <code>meta.count</code> 的值,存入整数 <code>count</code> 并打印。',
    starter: `import json
raw = '{"meta": {"count": 3}, "items": [1, 2, 3]}'
obj = json.loads(raw)

# TODO: 取出 meta 里的 count 存入整数 count
# count = ...
print(count)`,
    check: `assert 'count' in globals() and isinstance(count, int), "请把个数存入整数 count"
assert count == 3, f"count 应为 3,实际 {count}"`,
    explanation: '用 <code>obj["meta"]["count"]</code> 沿嵌套路径取值。',
    skills: [],
  },
  {
    id: 'exm-y2-c12', lessonId: '09-json-and-storage', unitId: 'unit-3', type: 'code', level: 'apply', points: 10,
    objectiveId: '09-json-and-storage-3', anchor: '四、SQLite 存储',
    prompt: '给定 <code>(id, name)</code> 元组列表 <code>records</code>,以 id 为键、name 为值构建字典 <code>store</code>(重复 id 由后者覆盖),并打印。',
    starter: `records = [(1, '苹果'), (2, '香蕉'), (1, '红富士')]

# TODO: 以 id 为键构建字典 store,重复 id 后者覆盖
# store = ...
print(store)`,
    check: `assert 'store' in globals() and isinstance(store, dict), "请把结果存入字典 store"
assert store == {1: '红富士', 2: '香蕉'}, f"store 不符: {store}"`,
    explanation: '<code>dict(records)</code> 或字典推导式都能让重复键被最后一条覆盖,类似 UPSERT。',
    skills: [],
  },
  {
    id: 'exm-y2-c13', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'code', level: 'apply', points: 10,
    objectiveId: '10-dynamic-pages-1', anchor: '一、动态页面判断',
    prompt: '给定 HTML 字符串 <code>html</code>,用 <code>re.sub</code> 去掉所有类似 <code>&lt;...&gt;</code> 的标签,得到纯文本存入 <code>plain</code> 并打印。',
    starter: `import re
html = "<div><p>标题</p><p>正文</p></div>"

# TODO: 用 re.sub 把 < 开头、> 结尾的标签替换为空串,纯文本存入 plain
# plain = ...
print(plain)`,
    check: `assert 'plain' in globals() and isinstance(plain, str), "请把纯文本存入字符串 plain"
assert plain == '标题正文', f"plain 应为 '标题正文',实际 {plain!r}"`,
    explanation: '用匹配尖括号标签的正则把整段替换为空串即可去掉所有标签。',
    skills: [],
  },
  {
    id: 'exm-y2-c14', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'code', level: 'apply', points: 10,
    objectiveId: '11-anti-crawling-2', anchor: '二、请求头伪装',
    prompt: '给定请求头字典 <code>headers</code> 与 Cookie 字符串 <code>cookie</code>,把 Cookie 写入 headers 的 <code>Cookie</code> 键(若已有则覆盖),并打印 headers。',
    starter: `headers = {'User-Agent': 'Mozilla/5.0'}
cookie = 'session=abc123; token=xyz'

# TODO: 把 cookie 存入 headers['Cookie']
# ...
print(headers)`,
    check: `assert isinstance(headers, dict), "headers 应保持字典"
assert headers.get('Cookie') == 'session=abc123; token=xyz', f"Cookie 不符: {headers}"`,
    explanation: '直接赋值 <code>headers["Cookie"] = cookie</code> 即可,字典赋值会自动覆盖旧值。',
    skills: [],
  },
  {
    id: 'exm-y2-c15', lessonId: '10-dynamic-pages', unitId: 'unit-4', type: 'code', level: 'apply', points: 10,
    objectiveId: '10-dynamic-pages-2', anchor: '二、Playwright 基础',
    prompt: '给定渲染后的 HTML 字符串 <code>html</code> 与标记串 <code>marker</code>,判断 html 中是否包含 marker,把布尔结果存入 <code>has_marker</code> 并打印。',
    starter: `html = "<html><body><div id='app'></div></body></html>"
marker = "<script"

# TODO: 判断 html 是否包含 marker,布尔值存入 has_marker
# has_marker = ...
print(has_marker)`,
    check: `assert 'has_marker' in globals() and isinstance(has_marker, bool), "请把结果存入布尔变量 has_marker"
assert has_marker is False, f"has_marker 应为 False,实际 {has_marker}"`,
    explanation: '用 <code>marker in html</code> 判断子串是否存在,结果为布尔值。',
    skills: [],
  },
  {
    id: 'exm-y2-c16', lessonId: '11-anti-crawling', unitId: 'unit-4', type: 'code', level: 'apply', points: 10,
    objectiveId: '11-anti-crawling-4', anchor: '四、限流与退避',
    prompt: '给定初始等待 <code>base</code> 与重试次数 <code>retries</code>,用列表推导式生成指数退避秒数(共 retries 项),存入 <code>delays</code> 并打印。',
    starter: `base = 1
retries = 4

# TODO: 生成指数退避秒数 [1, 2, 4, 8] 存入 delays
# delays = ...
print(delays)`,
    check: `assert 'delays' in globals() and isinstance(delays, list), "请把结果存入列表 delays"
assert delays == [1, 2, 4, 8], f"delays 应为 [1,2,4,8],实际 {delays}"`,
    explanation: '用 <code>[base * 2 ** i for i in range(retries)]</code> 生成指数退避序列。',
    skills: [],
  },
  {
    id: 'exm-y2-c17', lessonId: '12-ethics', unitId: 'unit-5', type: 'code', level: 'apply', points: 10,
    objectiveId: '12-ethics-1', anchor: '一、robots.txt',
    prompt: '给定 robots.txt 的行列表 <code>lines</code>,提取所有 <code>Disallow:</code> 路径(去掉前缀并 strip),存入列表 <code>blocked</code> 并打印。',
    starter: `lines = ['User-agent: *', 'Disallow: /admin', 'Disallow: /private', 'Allow: /']

# TODO: 提取所有 Disallow 路径存入 blocked
# blocked = ...
print(blocked)`,
    check: `assert 'blocked' in globals() and isinstance(blocked, list), "请把路径存入列表 blocked"
assert blocked == ['/admin', '/private'], f"blocked 不符: {blocked}"`,
    explanation: '用 <code>line.startswith("Disallow:")</code> 判断,切片去前缀后 strip()。',
    skills: [],
  },
  {
    id: 'exm-y2-c18', lessonId: '13-final-project', unitId: 'unit-5', type: 'code', level: 'apply', points: 10,
    objectiveId: '13-final-project-4', anchor: '四、日志与文档',
    prompt: '给定日志行列表 <code>logs</code>,统计其中包含字符串 <code>ERROR</code> 的行数,存入整数 <code>err_count</code> 并打印。',
    starter: `logs = ['INFO ok', 'ERROR failed', 'ERROR retry', 'INFO done']

# TODO: 统计包含 'ERROR' 的行数存入 err_count
# err_count = ...
print(err_count)`,
    check: `assert 'err_count' in globals() and isinstance(err_count, int), "请把条数存入整数 err_count"
assert err_count == 2, f"err_count 应为 2,实际 {err_count}"`,
    explanation: '用 <code>sum(1 for line in logs if "ERROR" in line)</code> 统计错误日志条数。',
    skills: [],
  },
  {
    id: 'exm-y2-c19', lessonId: '12-ethics', unitId: 'unit-5', type: 'code', level: 'apply', points: 10,
    objectiveId: '12-ethics-2', anchor: '二、数据合规',
    prompt: '给定数据字典 <code>data</code> 与敏感字段集合 <code>sensitive</code>,生成去掉敏感字段的新字典 <code>clean</code>(不修改原字典),并打印。',
    starter: `data = {'title': '新闻', 'phone': '13800000000', 'id_card': 'X', 'author': '张三'}
sensitive = {'phone', 'id_card'}

# TODO: 过滤掉敏感字段,结果存入新字典 clean
# clean = ...
print(clean)`,
    check: `assert 'clean' in globals() and isinstance(clean, dict), "请把结果存入字典 clean"
assert clean == {'title': '新闻', 'author': '张三'}, f"clean 不符: {clean}"`,
    explanation: '用字典推导式 <code>{k: v for k, v in data.items() if k not in sensitive}</code> 过滤敏感字段。',
    skills: [],
  },
  {
    id: 'exm-y2-c20', lessonId: '13-final-project', unitId: 'unit-5', type: 'code', level: 'apply', points: 10,
    objectiveId: '13-final-project-3', anchor: '五、断点续爬',
    prompt: '给定已抓取 URL 集合 <code>crawled</code> 与候选 URL 列表 <code>candidates</code>,找出尚未抓取的 URL(保持原有顺序),存入列表 <code>todo</code> 并打印。',
    starter: `crawled = {'/p/1', '/p/2'}
candidates = ['/p/1', '/p/2', '/p/3', '/p/4']

# TODO: 找出未抓取的 URL 存入 todo(保持顺序)
# todo = ...
print(todo)`,
    check: `assert 'todo' in globals() and isinstance(todo, list), "请把结果存入列表 todo"
assert todo == ['/p/3', '/p/4'], f"todo 不符: {todo}"`,
    explanation: '用 <code>[u for u in candidates if u not in crawled]</code> 过滤出未抓取项。',
    skills: [],
  },
];
