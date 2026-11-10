// 概念题库 —— 每课 2~3 道「低风险快速检索题」,用于课内即时检测与单元概念卷
//
// 设计约束(教学视角,勿随意破坏):
// 1. 一题只考一个点,题干不超过两行,避免阅读理解成本盖过知识本身。
// 2. choice 题的 optionFeedback 必须**逐项**写:错误选项要解释"错在哪、为什么有人会这么想",
//    这是诊断性反馈的核心资产,直接决定学生能否自我修正。
// 3. misconception 是错误归因标签,错题本按它聚合,教师看到的是"班级共性误区"而不是题号。
// 4. anchor 指向课内小节,学生答错后知道回去看哪一段,而不是重看整课。
// 5. objectiveId 对齐 data/design.ts 中的目标,构建期会校验(scripts/check-catalog.mjs)。

import type { Question } from '../lib/types';

export interface ConceptQuestion extends Question {
  lessonId: string;
  unitId: string;
  /** 题干所属技能的简短标签,用于错题本筛选 */
  skills: string[];
}

export const conceptQuestions: ConceptQuestion[] = [
  // ── 单元一 · 爬虫基础 ─────────────────────────────────────────────
  {
    id: 'q-01-1',
    lessonId: '01-environment',
    unitId: 'unit-1',
    objectiveId: '01-environment-1',
    type: 'choice',
    level: 'understand',
    points: 5,
    skills: [],
    anchor: '一、为什么一定要虚拟环境',
    prompt: '在一个新项目里执行了 <code>python -m venv .venv</code>,接下来安装 requests 的正确做法是?',
    options: [
      '直接 <code>pip install requests</code>,venv 会自动接管',
      '先激活虚拟环境(<code>.venv\\Scripts\\activate</code> 或 <code>source .venv/bin/activate</code>),再 <code>pip install requests</code>',
      '把 requests 目录手动复制进项目文件夹',
      '必须重装一次 Python 才能生效',
    ],
    answer: ['1'],
    optionFeedback: [
      '创建虚拟环境只是"造了一个房间",没进门就 pip install 仍然装到全局 Python 里——这是新手最常见的隐性坑。',
      '',
      '手动复制包目录会丢掉依赖元数据和已编译扩展,换台机器就崩;而且 site-packages 里的包不是都能直接拷。',
      '不需要。虚拟环境不改变解释器版本,只隔离"包"的安装位置。',
    ],
    explanation:
      '虚拟环境改变的是 pip 与 python 的指向:激活后,pip 装的包只落在 .venv 里,项目之间互不污染。判断是否激活成功,看命令行提示符前是否出现 (.venv)。',
    misconception: 'env-not-activated',
  },
  {
    id: 'q-01-2',
    lessonId: '01-environment',
    unitId: 'unit-1',
    objectiveId: '01-environment-1',
    type: 'truefalse',
    level: 'understand',
    points: 5,
    skills: [],
    anchor: '三、验证安装',
    prompt: '在命令行执行 <code>python -c "import bs4"</code>,如果没有任何输出,说明 bs4 尚未安装。',
    answer: ['F'],
    explanation:
      'Python 的 import 成功时是静默的。没有输出恰恰说明导入成功;如果失败,会抛出 ModuleNotFoundError 并带红色回溯信息。',
    misconception: 'import-noise-confusion',
  },
  {
    id: 'q-02-1',
    lessonId: '02-http-basics',
    unitId: 'unit-1',
    objectiveId: '02-http-basics-2',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['请求'],
    anchor: '三、状态码',
    prompt: '你的脚本对某个商品页返回 <code>403</code>,用浏览器却能正常打开。最可能的原因是?',
    options: [
      '这个页面已经不存在了',
      '服务器识别出请求不是普通浏览器(缺 User-Agent 等特征),主动拒绝',
      '你的网络断了',
      '服务器内部代码报错',
    ],
    answer: ['1'],
    optionFeedback: [
      '"不存在"对应 404。403 是"Forbidden":资源存在,但你被拒绝访问。',
      '',
      '网络断掉通常表现为连接超时/连接被拒(ConnectionError),拿不到任何 HTTP 状态码。',
      '服务器内部错误对应 5xx(如 500),那是服务端自己的问题,与你的请求特征无关。',
    ],
    explanation:
      '403 是反爬最常见的反馈信号。排查顺序:① 请求头是否像浏览器(UA、Accept、Referer);② 是否缺少 Cookie/登录态;③ 请求频率是否过高。',
    misconception: 'status-code-confusion',
  },
  {
    id: 'q-02-2',
    lessonId: '02-http-basics',
    unitId: 'unit-1',
    objectiveId: '02-http-basics-1',
    type: 'choice',
    level: 'understand',
    points: 5,
    skills: ['请求'],
    anchor: '一、请求与响应',
    prompt: '关于 GET 与 POST,下面哪种说法是准确的?',
    options: [
      'GET 的参数放在 URL 查询串里,POST 的参数通常放在请求体里',
      'GET 只能取 HTML,POST 只能提交表单',
      'POST 比 GET 更安全,所以登录一定要用 POST 加密传输',
      'GET 请求不能携带任何自定义请求头',
    ],
    answer: ['0'],
    optionFeedback: [
      '',
      '两者都能传任意内容,区别在语义与参数位置,不在"能取什么格式"。',
      'POST 不等于加密。没有 HTTPS 时,POST 的请求体同样是明文可截获的。安全性来自 TLS,不是方法名。',
      'GET 完全可以带自定义头(如 User-Agent、Referer),爬虫里天天这么做。',
    ],
    explanation:
      '语义上 GET 用于"读取",应当幂等、可缓存;POST 用于"提交/改变状态"。爬虫里大量接口用 GET + 查询参数,这正是 params 参数的用武之地。',
    misconception: 'http-method-semantics',
  },
  {
    id: 'q-02-3',
    lessonId: '02-http-basics',
    unitId: 'unit-1',
    objectiveId: '02-http-basics-4',
    type: 'truefalse',
    level: 'apply',
    points: 5,
    skills: ['请求'],
    anchor: '四、编码',
    prompt: '响应头是 <code>Content-Type: text/html; charset=gbk</code>,此时 <code>resp.text</code> 默认一定会按 GBK 正确解码。',
    answer: ['F'],
    explanation:
      'requests 在响应头缺 charset 时会按 ISO-8859-1 猜,或依赖内容嗅探,经常猜错并产生乱码。稳妥做法是显式设置 <code>resp.encoding = "gbk"</code>(或 utf-8)后再取 .text。',
    misconception: 'encoding-guess',
  },
  {
    id: 'q-03-1',
    lessonId: '03-requests-basics',
    unitId: 'unit-1',
    objectiveId: '03-requests-basics-2',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['请求'],
    anchor: '二、查询参数',
    prompt: '用 <code>params={&#34;q&#34;: &#34;python 爬虫&#34;, &#34;page&#34;: 2}</code> 而不是手拼 URL,最主要的收益是?',
    options: [
      '请求速度更快',
      '自动做 URL 编码(中文、空格、& 等特殊字符),避免拼出非法或语义错误的地址',
      '可以绕过网站的反爬检测',
      '让服务器认为请求来自浏览器',
    ],
    answer: ['1'],
    optionFeedback: [
      '性能差别可忽略;params 的价值在正确性,不在速度。',
      '',
      '编码不是反爬绕过手段。反爬看的是请求特征与频率,不看你怎么拼字符串。',
      'UA 由请求头决定,与参数拼接方式毫无关系——这是一处典型的概念混淆。',
    ],
    explanation:
      '手拼 "?q=python 爬虫&page=2" 时,空格会变成非法字符或提前截断查询串。params 会编码为 q=python%20%E7%88%AC%E8%99%AB,服务器才解析得对。',
    misconception: 'url-encoding',
  },
  {
    id: 'q-03-2',
    lessonId: '03-requests-basics',
    unitId: 'unit-1',
    objectiveId: '03-requests-basics-3',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['请求'],
    anchor: '五、Session',
    prompt: '先用 <code>requests.post(login_url, ...)</code> 登录成功,紧接着 <code>requests.get(profile_url)</code> 却返回未登录。原因是?',
    options: [
      '服务器把你的 IP 封了',
      '两次调用是两个独立会话,第二次没有携带登录拿到的 Cookie',
      'requests 不支持登录',
      '登录接口一定需要验证码',
    ],
    answer: ['1'],
    optionFeedback: [
      '第一次请求还能成功,说明网络与 IP 都正常,问题在会话连续性。',
      '',
      'requests 完全支持登录,只是"模块级函数"每次都是新会话。',
      '验证码是登录接口的一种保护,与这里"登录后立刻失效"的现象无关。',
    ],
    explanation:
      '模块级 requests.get/post 每次新建连接、不带历史 Cookie。要维持登录态,用 <code>s = requests.Session()</code>,之后统一走 s.post / s.get。',
    misconception: 'session-vs-stateless',
  },
  {
    id: 'q-03-3',
    lessonId: '03-requests-basics',
    unitId: 'unit-1',
    objectiveId: '03-requests-basics-4',
    type: 'truefalse',
    level: 'apply',
    points: 5,
    skills: ['请求'],
    anchor: '六、超时与异常',
    prompt: '不写 <code>timeout</code> 时,requests 会使用一个较长的默认超时,所以偶尔可以省略。',
    answer: ['F'],
    explanation:
      'requests 默认没有超时:目标若一直不返回,脚本会无限挂起,在批量任务里就是"卡死"。养成 <code>timeout=(3, 10)</code> 的习惯(连接超时, 读取超时)。',
    misconception: 'no-timeout',
  },

  // ── 单元二 · 数据解析 ─────────────────────────────────────────────
  {
    id: 'q-04-1',
    lessonId: '04-beautifulsoup',
    unitId: 'unit-2',
    objectiveId: '04-beautifulsoup-2',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['解析'],
    anchor: '三、CSS 选择器',
    prompt: '<code>soup.select(&#34;div.book &gt; span.price&#34;)</code> 里的 <code>&gt;</code> 表示?',
    options: [
      '任意层级的后代 span.price',
      '只取 div.book 的<strong>直接子元素</strong> span.price',
      '取 div.book 之后的兄弟节点',
      '取 div.book 内部第一个 span.price',
    ],
    answer: ['1'],
    optionFeedback: [
      '这是空格选择器(后代选择器)的含义,不是 >。',
      '',
      '兄弟节点用 + 或 ~。',
      '"第一个"要用 :first-child 或 .select_one(),与 > 无关。',
    ],
    explanation:
      '空格 = 后代(不限层级);> = 直接子元素。嵌套结构复杂时混用会多抓到子列表里的同类元素,这是解析结果"行数对不上"的高频原因。',
    misconception: 'css-combinator',
  },
  {
    id: 'q-04-2',
    lessonId: '04-beautifulsoup',
    unitId: 'unit-2',
    objectiveId: '04-beautifulsoup-2',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['解析'],
    anchor: '二、find / find_all',
    prompt: '要按 CSS 类名查找 <code>&lt;div class=&#34;item&#34;&gt;</code>,下面哪种写法是对的?',
    options: [
      '<code>soup.find_all(&#34;div&#34;, class=&#34;item&#34;)</code>',
      '<code>soup.find_all(&#34;div&#34;, class_=&#34;item&#34;)</code>',
      '<code>soup.find_all(&#34;div.item&#34;)</code>',
      '<code>soup.find_all(&#34;div&#34;, className=&#34;item&#34;)</code>',
    ],
    answer: ['1'],
    optionFeedback: [
      'class 是 Python 保留字,作为关键字参数会直接语法错误——这是初学者第一个撞的墙。',
      '',
      'find_all 的参数是标签名,不解析 CSS 语法;要写 <code>div.item</code> 得用 select。',
      'className 是 JavaScript 的写法,BeautifulSoup 不认。',
    ],
    explanation:
      'BeautifulSoup 对与 Python 保留字冲突的属性加下划线:class→class_,for→for_。也可以用 <code>attrs={&#34;class&#34;: &#34;item&#34;}</code> 绕开。',
    misconception: 'bs4-class-keyword',
  },
  {
    id: 'q-04-3',
    lessonId: '04-beautifulsoup',
    unitId: 'unit-2',
    objectiveId: '04-beautifulsoup-4',
    type: 'truefalse',
    level: 'apply',
    points: 5,
    skills: ['解析'],
    anchor: '四、提取文本',
    prompt: '<code>td.get_text()</code> 与 <code>td.get_text(strip=True)</code> 的区别是后者会去掉每个文本片段首尾的空白与换行。',
    answer: ['T'],
    explanation:
      'HTML 源码里的缩进会变成大量换行和空格,直接入库会带着一堆 \\n 和空格。strip=True 是最省事的清洗,但对 "1200 元" 这类含空格的字符串要谨慎,必要时用正则再收一次。',
  },
  {
    id: 'q-05-1',
    lessonId: '05-xpath',
    unitId: 'unit-2',
    objectiveId: '05-xpath-1',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['解析'],
    anchor: '二、常用表达式',
    prompt: '<code>//div[@class=&#34;item&#34;]/a/@href</code> 返回的是?',
    options: [
      '第一个 a 标签的 href 字符串',
      '所有匹配 a 标签的 href 属性值组成的列表',
      '一个 BeautifulSoup 对象',
      '整个 a 标签的 HTML 文本',
    ],
    answer: ['1'],
    optionFeedback: [
      '"第一个"要用 <code>(//div[@class=&#34;item&#34;]/a/@href)[1]</code>,默认是全部。',
      '',
      '@href 取的是字符串属性值,不是节点对象。',
      '要标签本身的 HTML 文本应取节点后用 etree.tostring(),@href 只取值。',
    ],
    explanation:
      'xpath 返回永远是列表(即使只有一个元素),这也是新手常犯的 "list 没有 get_text" 报错来源。取单个值用 [0],或写 <code>.xpath(...)[0]</code> 并配合判空。',
    misconception: 'xpath-return-list',
  },
  {
    id: 'q-05-2',
    lessonId: '05-xpath',
    unitId: 'unit-2',
    objectiveId: '05-xpath-1',
    type: 'choice',
    level: 'understand',
    points: 5,
    skills: ['解析'],
    anchor: '二、常用表达式',
    prompt: '<code>//div</code> 与 <code>/div</code> 的区别是?',
    options: [
      '两者完全等价',
      '// 从文档任意位置匹配 div,/ 只从根节点取直接子元素 div',
      '// 表示取第一个,/ 表示取全部',
      '/ 用于 HTML,// 用于 XML',
    ],
    answer: ['1'],
    optionFeedback: [
      '写法差一个斜杠,语义差一个量级——这是 XPath 最经典的混点。',
      '',
      '"取第几个"由位置谓词 [1]、[last()] 决定,与斜杠数量无关。',
      'XPath 同时适用于 HTML 与 XML,lxml 解析 HTML 后同样用 //。',
    ],
    explanation:
      '以 // 开头是"任意深度的后代",这也是为什么多数抓取用 // 更方便;绝对路径 /html/body/div 一旦页面加一层 wrapper 就全崩,可维护性差。',
    misconception: 'xpath-axis',
  },
  {
    id: 'q-05-3',
    lessonId: '05-xpath',
    unitId: 'unit-2',
    objectiveId: '05-xpath-3',
    type: 'truefalse',
    level: 'analyze',
    points: 5,
    skills: ['解析'],
    anchor: '四、取舍',
    prompt: '结构稳定、需要按属性精确定位时,XPath 往往比 CSS 选择器表达力更强;而写法简洁、前端同学更熟悉时,CSS 更合适。',
    answer: ['T'],
    explanation:
      'XPath 能表达"父节点、兄弟节点、按文本内容筛选、位置关系"等 CSS 做不到的语义;CSS 更短、更易读。真实项目里按"选择器稳定性"取舍,而不是站队。',
  },
  {
    id: 'q-06-1',
    lessonId: '06-single-page',
    unitId: 'unit-2',
    objectiveId: '06-single-page-2',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['解析'],
    anchor: '二、落表',
    prompt: '用 <code>csv.writer</code> 写出含中文的 CSV,用 Excel 打开出现乱码。最直接的修法是?',
    options: [
      '改用 pandas 写就不会乱码',
      '打开文件时指定 <code>encoding=&#34;utf-8-sig&#34;</code>',
      '把中文全部转成拼音',
      '把扩展名从 .csv 改成 .txt',
    ],
    answer: ['1'],
    optionFeedback: [
      'pandas 的 to_csv 默认同样是 utf-8,不指定编码照样乱码——问题在 BOM,不在库。',
      '',
      '转拼音是丢数据的做法,不解决编码问题。',
      '改扩展名不会改变字节内容,Excel 依旧按本地编码解析。',
    ],
    explanation:
      'Excel 在 Windows 上默认按 GBK 解析无 BOM 的 UTF-8 文件。utf-8-sig 会在文件头写入 BOM,Excel 才认得出这是 UTF-8。程序间交换数据时用纯 utf-8,给 Excel 看时用 utf-8-sig。',
    misconception: 'csv-encoding',
  },
  {
    id: 'q-06-2',
    lessonId: '06-single-page',
    unitId: 'unit-2',
    objectiveId: '06-single-page-1',
    type: 'choice',
    level: 'analyze',
    points: 5,
    skills: ['解析'],
    anchor: '一、抓取流程',
    prompt: '抓一个 24 行的表格,下面哪种流程最稳健?',
    options: [
      '每一行都重新 requests.get 一次,确保数据最新',
      '请求一次拿到整页 HTML → 解析出 24 个行节点 → 逐行提取字段',
      '先把 24 行用正则全部切出来,再转成表格',
      '直接复制浏览器里看到的内容粘贴进 CSV',
    ],
    answer: ['1'],
    optionFeedback: [
      '同一页面请求 24 次,既慢又是明显的异常流量,容易触发限流——这是"技术上能跑通、工程上不合格"的做法。',
      '',
      '正则切 HTML 对嵌套结构极其脆弱,标签换行或属性顺序变化就失效;能用解析器就别用正则啃 HTML。',
      '手工复制不可复现、不可扩展,也无法在数据更新后重跑。',
    ],
    explanation:
      '标准三段式:取(Fetch)→ 解(Parse)→ 存(Store)。一次请求、多次解析,是最小可行且可扩展的结构,后面加分页、多级、存储都是在这个骨架上长出分支。',
    misconception: 'fetch-parse-store',
  },

  // ── 单元三 · 进阶爬取 ─────────────────────────────────────────────
  {
    id: 'q-07-1',
    lessonId: '07-pagination',
    unitId: 'unit-3',
    objectiveId: '07-pagination-1',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['分页'],
    anchor: '二、循环翻页',
    prompt: '分页地址是 <code>page/1.html</code> 到 <code>page/10.html</code>,要抓满 10 页,循环应该写成?',
    options: [
      '<code>for p in range(1, 10):</code>',
      '<code>for p in range(1, 11):</code>',
      '<code>for p in range(0, 10):</code>',
      '<code>for p in range(10):</code>',
    ],
    answer: ['1'],
    optionFeedback: [
      'range 右端不包含,这里只跑了 1~9 页,静默少抓一页——最难发现的 bug 类型。',
      '',
      '第 0 页在多数站点不存在,会拿到 404 或首页重复数据。',
      'range(10) 等价于 0~9,同样错位。',
    ],
    explanation:
      'range(start, stop) 左闭右开。抓 n 页写 range(1, n + 1)。防错习惯:抓完打印总数并与页面标的"共 N 页/共 M 条"核对。',
    misconception: 'range-off-by-one',
  },
  {
    id: 'q-07-2',
    lessonId: '07-pagination',
    unitId: 'unit-3',
    objectiveId: '07-pagination-3',
    type: 'truefalse',
    level: 'understand',
    points: 5,
    skills: ['分页'],
    anchor: '三、频率控制',
    prompt: '翻页之间加 <code>time.sleep(1)</code> 只是为了"让脚本看起来不那么像机器人",对服务器没有实际影响。',
    answer: ['F'],
    explanation:
      'sleep 的实质是降低对目标站的压力,避免挤占真实用户的带宽与数据库连接,是工程礼貌也是稳定性手段(降低被限流概率)。"伪装"只是副产品,不是目的。',
    misconception: 'sleep-purpose',
  },
  {
    id: 'q-08-1',
    lessonId: '08-multi-level',
    unitId: 'unit-3',
    objectiveId: '08-multi-level-2',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['分页', '请求'],
    anchor: '二、去重',
    prompt: '列表页 20 条链接里,有 3 条重复指向同一个详情页。爬之前应该?',
    options: [
      '照抓不误,重复入库后再用 SQL 去重',
      '用 set 收集链接、去重后再发起请求',
      '随机抽 17 条抓',
      '先不处理,等接口报错再说',
    ],
    answer: ['1'],
    optionFeedback: [
      '能让数据库去重,但你已经多打了 3 次请求——对目标站是无意义的额外负载,对自己是白等。',
      '',
      '抽样会丢数据,把"去重"和"少抓"混为一谈。',
      '重复请求不会报错,只会悄悄污染数据或浪费时间;等报错是被动策略。',
    ],
    explanation:
      '去重要发生在"发请求之前",成本最低。列表页层面用 <code>seen = set()</code> 过滤 URL;跨运行层面则把已抓 URL 落库/落文件(断点续爬的基础)。',
    misconception: 'dedupe-placement',
  },
  {
    id: 'q-08-2',
    lessonId: '08-multi-level',
    unitId: 'unit-3',
    objectiveId: '08-multi-level-3',
    type: 'choice',
    level: 'analyze',
    points: 5,
    skills: ['分页'],
    anchor: '三、容错',
    prompt: '详情页共 20 个,第 7 个请求超时。整体脚本最合理的处理是?',
    options: [
      '抛出异常,整个任务终止',
      '捕获该条异常、记录失败 URL、继续抓剩下的,最后统一重试失败项',
      '无限重试第 7 个,直到成功',
      '跳过所有详情页,只保存列表页数据',
    ],
    answer: ['1'],
    optionFeedback: [
      '一条超时毁掉 19 条已抓数据,是最昂贵的失败方式——爬虫要"部分成功"而不是"全有或全无"。',
      '',
      '无限重试会把单点故障放大成对目标站的持续冲击,也会卡住整个队列;应设上限(如 3 次)并退避。',
      '数据完整度直接砍半,而且没有记录下来"缺了什么",后续无法补救。',
    ],
    explanation:
      '批量任务的健壮性 = 每条独立 try/except + 失败清单 + 有限重试。这也是单元四"反爬"要处理的前提:你得先知道自己哪一条失败了。',
    misconception: 'fault-isolation',
  },
  {
    id: 'q-09-1',
    lessonId: '09-json-and-storage',
    unitId: 'unit-3',
    objectiveId: '09-json-and-storage-1',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['存储', '请求'],
    anchor: '一、JSON 接口',
    prompt: '接口返回 JSON,想拿到 Python 字典,应该用?',
    options: [
      '<code>resp.text</code> 直接当字典用',
      '<code>resp.json()</code>(或 <code>json.loads(resp.text)</code>)',
      '<code>eval(resp.text)</code>',
      '<code>resp.content.decode(&#34;ascii&#34;)</code>',
    ],
    answer: ['1'],
    optionFeedback: [
      'resp.text 是字符串,对它取 [&#34;items&#34;] 会报 TypeError:string indices must be integers。',
      '',
      'eval 会执行任意代码,遇到恶意响应就是安全漏洞;JSON 解析用 json 模块。',
      'ASCII 解码中文会直接抛 UnicodeDecodeError,而且解出来仍是字符串。',
    ],
    explanation:
      'resp.json() 内部就是 json.loads(resp.text),额外帮你处理了编码。判断一个地址是不是接口:响应体以 { 或 [ 开头,而不是 <!doctype html>。',
    misconception: 'json-vs-text',
  },
  {
    id: 'q-09-2',
    lessonId: '09-json-and-storage',
    unitId: 'unit-3',
    objectiveId: '09-json-and-storage-3',
    type: 'choice',
    level: 'analyze',
    points: 5,
    skills: ['存储'],
    anchor: '三、SQLite',
    prompt: '同一个商品被重复抓到,希望库里只保留最新一条,主键是 item_id。最合适的写法是?',
    options: [
      '<code>INSERT</code>,冲突时报错就忽略',
      '<code>INSERT ... ON CONFLICT(item_id) DO UPDATE</code>(或 <code>INSERT OR REPLACE</code>)',
      '每次先 <code>DROP TABLE</code> 再重建',
      '把 item_id 改成随机数避免冲突',
    ],
    answer: ['1'],
    optionFeedback: [
      '报错忽略能让脚本跑下去,但旧数据不会更新,你会拿着一堆过期价格。',
      '',
      'DROP TABLE 会把无关数据一起清空,且中途失败就是数据全丢;这是"解决冲突"里最危险的做法。',
      '随机主键等于放弃去重能力,同一商品会在库里躺成多条。',
    ],
    explanation:
      '爬虫入库的常态是"重复抓取",主键冲突是做增量更新的入口,不是错误。UPSERT 让"重跑脚本"变成幂等操作,这是可反复执行的关键。',
    misconception: 'upsert-missing',
  },

  // ── 单元四 · 反爬与动态页面 ───────────────────────────────────────
  {
    id: 'q-10-1',
    lessonId: '10-dynamic-pages',
    unitId: 'unit-4',
    objectiveId: '10-dynamic-pages-1',
    type: 'choice',
    level: 'analyze',
    points: 5,
    skills: ['反爬'],
    anchor: '一、判断是否动态',
    prompt: 'requests 拿到的 HTML 里没有商品列表,但浏览器里能看到。最快确认"是不是 JS 渲染"的方法是?',
    options: [
      '把代码改成 POST 再试一次',
      '在浏览器 Network 面板筛 XHR/Fetch,看是否有返回数据的接口;同时对比"查看网页源代码"与 Elements',
      '换一个 User-Agent 重试',
      '加大 timeout 等待更久',
    ],
    answer: ['1'],
    optionFeedback: [
      '方法与渲染方式无关,改 POST 只会得到另一个错误的响应。',
      '',
      'UA 影响是否被拒(403),不改变"HTML 里本就没有数据"这一事实。',
      '超时解决的是"慢",不是"没有";数据不在初始 HTML 里,等再久也不会出现。',
    ],
    explanation:
      '判断标准很硬:右键"查看网页源代码"(服务端原始 HTML)里没有、Elements(渲染后 DOM)里有,就是前端渲染。此时首选找 XHR 接口(更轻),其次才是无头浏览器。',
    misconception: 'dynamic-diagnosis',
  },
  {
    id: 'q-10-2',
    lessonId: '10-dynamic-pages',
    unitId: 'unit-4',
    objectiveId: '10-dynamic-pages-3',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['反爬'],
    anchor: '三、等待元素',
    prompt: 'Playwright 里 <code>page.goto(url)</code> 之后立刻取列表,常常拿到空数组。正确做法是?',
    options: [
      '<code>time.sleep(5)</code> 硬等',
      '<code>page.wait_for_selector(&#34;.item&#34;)</code> 等目标元素出现后再取',
      '多调用几次 <code>page.goto</code>',
      '把浏览器改成有头模式',
    ],
    answer: ['1'],
    optionFeedback: [
      'sleep 是"赌网速":赌慢了还失败,赌快了白等 5 秒。固定等待在批量任务里会累积成几分钟的浪费。',
      '',
      '重复 goto 会不断刷新页面,元素可能永远等不到,还增加服务器压力。',
      '有头/无头影响的是渲染环境与部分检测,不解决"时机"问题。',
    ],
    explanation:
      '动态页面的数据到达时间不确定,应"等条件"而非"等时间"。wait_for_selector / wait_for_response 都是在等一个可验证的状态,超时即报错,失败也更容易定位。',
    misconception: 'fixed-sleep',
  },
  {
    id: 'q-11-1',
    lessonId: '11-anti-crawling',
    unitId: 'unit-4',
    objectiveId: '11-anti-crawling-2',
    type: 'choice',
    level: 'analyze',
    points: 5,
    skills: ['反爬'],
    anchor: '二、请求头与频率',
    prompt: '目标站开始返回 429。最合理的第一步是?',
    options: [
      '立刻上代理 IP 池,继续同频率请求',
      '先降频率(加延时/减少并发),并检查是否缺必要请求头,再观察是否恢复',
      '直接改用无头浏览器绕过去',
      '写死循环重试直到成功',
    ],
    answer: ['1'],
    optionFeedback: [
      '429 明确说的是"你太快了"。换 IP 继续快,是在把问题扩散到更多 IP,也可能让整段 IP 段被封。',
      '',
      '无头浏览器更重、请求特征更明显,而且没解决"频率"这个根因。',
      '死循环重试会持续加压,通常换来更长封禁;应指数退避 + 上限。',
    ],
    explanation:
      '429 = Too Many Requests,是唯一"告诉你原因"的反爬信号。正确响应是尊重它:降低速率、遵守 Retry-After、减少并发。技术手段应服务于"合规访问",而不是绕过规则。',
    misconception: '429-response',
  },
  {
    id: 'q-11-2',
    lessonId: '11-anti-crawling',
    unitId: 'unit-4',
    objectiveId: '11-anti-crawling-4',
    type: 'choice',
    level: 'analyze',
    points: 5,
    skills: ['反爬'],
    anchor: '四、边界',
    prompt: '某网站用图形验证码保护数据。作为课程练习,下面哪种做法是可接受的?',
    options: [
      '接入打码平台批量破解验证码',
      '放弃对该站的数据抓取,改用课程靶站或公开 API 练习同样的技术',
      '用 OCR 模型识别,并高频重试',
      '通过社工手段拿到内部接口地址',
    ],
    answer: ['1'],
    optionFeedback: [
      '打码平台属于"绕过访问控制",在多数场景下违反网站条款,也可能触及法律边界;教学场景尤其不该示范。',
      '',
      'OCR + 高频重试仍是绕过访问控制,且高频会放大影响。技术难度不构成正当性。',
      '社工获取内部接口是明确的不当获取,不是技术问题而是行为问题。',
    ],
    explanation:
      '验证码是网站明确的"人类验证"意愿表达。绕过它,技术上可行 ≠ 行为上正当。学习爬虫的目标是掌握取数能力,靶站与公开 API 足以覆盖全部技术点。',
    misconception: 'captcha-bypass',
  },
  {
    id: 'q-12-1',
    lessonId: '12-ethics',
    unitId: 'unit-5',
    objectiveId: '12-ethics-1',
    type: 'choice',
    level: 'understand',
    points: 5,
    skills: [],
    anchor: '一、robots.txt',
    prompt: '关于 robots.txt,下面哪种理解是准确的?',
    options: [
      '它是法律条文,违反会被判刑',
      '它是网站对爬虫的访问约定;遵守它是行业规范与善意基础,但不等于"允许的部分就可以任意抓"',
      '只要 robots.txt 没写 Disallow,任何数据都可以随便抓、随便用',
      '它只能限制 Google 这类搜索引擎,对个人脚本无效',
    ],
    answer: ['1'],
    optionFeedback: [
      'robots.txt 是约定而非法律,但违反用户协议、抓取个人信息、破坏系统仍可能承担法律责任——法律依据在别处。',
      '',
      'robots 只表达"能不能来",不表达"数据能不能用"。著作权、个人信息保护、商业秘密是另外几道关。',
      '它对所有爬虫都是同一个约定,是否有约束力取决于你是否选择遵守——而合规评估正建立在这个选择上。',
    ],
    explanation:
      '把 robots.txt 当作"最低礼貌线",不是"合规上限"。真正的合规要看:数据是否含个人信息、是否违反用户协议、是否影响网站正常运行、使用目的是否合法。',
    misconception: 'robots-legal-status',
  },
  {
    id: 'q-12-2',
    lessonId: '12-ethics',
    unitId: 'unit-5',
    objectiveId: '12-ethics-3',
    type: 'truefalse',
    level: 'analyze',
    points: 5,
    skills: [],
    anchor: '三、个人信息',
    prompt: '抓取公开页面上的手机号、姓名并汇总成名单,因为页面"是公开的",所以不涉及个人信息保护问题。',
    answer: ['F'],
    explanation:
      '"公开可见"与"可批量收集"是两件事。批量收集、汇聚、存储个人信息,在《个人信息保护法》下通常需要合法性基础与告知同意;公开渠道不构成豁免。教学项目应避免以真实个人信息为对象。',
    misconception: 'public-equals-free',
  },

  // ── 单元五 · 综合 ─────────────────────────────────────────────────
  {
    id: 'q-13-1',
    lessonId: '13-final-project',
    unitId: 'unit-5',
    objectiveId: '13-final-project-1',
    type: 'choice',
    level: 'analyze',
    points: 5,
    skills: ['请求', '解析', '存储'],
    anchor: '二、代码结构',
    prompt: '一个要跑两小时的爬虫项目,代码组织上最该优先保证的是?',
    options: [
      '全部写在一个 main() 里,方便从上往下读',
      '把"取数 / 解析 / 入库"拆成独立函数,失败可单独重跑,数据可单独校验',
      '尽量多用全局变量,减少参数传递',
      '先追求并发数拉满,速度最重要',
    ],
    answer: ['1'],
    optionFeedback: [
      '单函数在 50 行内没问题,但两小时任务里任何一步失败都得从头再来,排查也无从下手。',
      '',
      '全局变量让函数互相隐式依赖,改一处崩一片,也难以单独测试解析规则。',
      '并发拉满先撞的是限流与封禁,不是速度瓶颈;而且并发会放大结构缺陷。',
    ],
    explanation:
      '长任务的三个必需品:分层(可单步重跑)、幂等(重复执行不出脏数据)、留痕(日志 + 失败清单)。这三条比"跑得快"重要一个数量级。',
    misconception: 'monolith-script',
  },
  {
    id: 'q-13-2',
    lessonId: '13-final-project',
    unitId: 'unit-5',
    objectiveId: '13-final-project-2',
    type: 'choice',
    level: 'apply',
    points: 5,
    skills: ['存储', '分页'],
    anchor: '三、断点续爬',
    prompt: '脚本跑到第 1200 条时被中断,重跑时希望不重复抓取。最直接的做法是?',
    options: [
      '重跑时从第 1200 条开始硬编码',
      '把已完成的 URL/ID 落库,启动时读出来跳过',
      '每次重跑前清空数据库,保证一致',
      '给每条请求加随机延时,减少中断概率',
    ],
    answer: ['1'],
    optionFeedback: [
      '硬编码只能救这一次,数据一变就失效,下次中断还得手改。',
      '',
      '清库重来让"重跑"变成"重新开始",长任务永远跑不完。',
      '延时降低中断概率,但不解决"中断之后怎么办"——这是两件事。',
    ],
    explanation:
      '断点续爬 = 进度持久化 + 启动时读取。配合 UPSERT,即使重复抓到同一条也不会产生脏数据,两者合起来才叫"可恢复"。',
    misconception: 'no-resume',
  },
];

/** 按课程取题(课内检查点) */
export function questionsOfLesson(lessonId: string): ConceptQuestion[] {
  return conceptQuestions.filter((q) => q.lessonId === lessonId);
}

/** 按单元取题(单元概念卷) */
export function questionsOfUnit(unitId: string): ConceptQuestion[] {
  return conceptQuestions.filter((q) => q.unitId === unitId);
}

export function getQuestion(id: string): ConceptQuestion | undefined {
  return conceptQuestions.find((q) => q.id === id);
}

/** 题组 id:课内检查点与单元概念卷分开记分 */
export function lessonQuizId(lessonId: string): string {
  return `quiz-${lessonId}`;
}

export function unitQuizId(unitId: string): string {
  return `quiz-${unitId}`;
}

/**
 * 误区标签 → 人话。错题本与教师端展示的是这个,而不是内部 key。
 * 新增题目时若写了 misconception,必须在此登记,否则构建期校验会失败。
 */
export const misconceptionLabels: Record<string, string> = {
  'env-not-activated': '虚拟环境未生效',
  'import-noise-confusion': '把 import 静默当失败',
  'status-code-confusion': '状态码归因错误',
  'http-method-semantics': 'GET/POST 语义混淆',
  'encoding-guess': '依赖自动编码猜测',
  'url-encoding': '手拼 URL 未编码',
  'session-vs-stateless': '会话与无状态混淆',
  'no-timeout': '忽略请求超时',
  'css-combinator': '后代/子元素选择器混淆',
  'bs4-class-keyword': 'class 关键字冲突',
  'xpath-return-list': '忽略 XPath 返回列表',
  'xpath-axis': '// 与 / 混淆',
  'csv-encoding': 'CSV 编码与 BOM',
  'fetch-parse-store': '抓取流程结构混乱',
  'range-off-by-one': '循环边界差一',
  'sleep-purpose': '误解延时的目的',
  'dedupe-placement': '去重时机过晚',
  'fault-isolation': '单点失败未隔离',
  'json-vs-text': '字符串与对象混淆',
  'upsert-missing': '缺少幂等入库',
  'dynamic-diagnosis': '动态渲染误判',
  'fixed-sleep': '用固定等待替代条件等待',
  '429-response': '限流响应策略错误',
  'captcha-bypass': '绕过访问控制',
  'robots-legal-status': '误解 robots.txt 效力',
  'public-equals-free': '把"公开"当"可收集"',
  'monolith-script': '单文件脚本结构',
  'no-resume': '缺少断点续爬',
};

export function misconceptionLabel(key: string | undefined): string {
  if (!key) return '未标注误区';
  return misconceptionLabels[key] ?? key;
}
