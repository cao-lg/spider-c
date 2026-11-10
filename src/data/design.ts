// 教学设计层 —— 每课一张「目标—活动—评价」设计卡
//
// 这个文件回答的是"为什么这样教",不是"教什么"(正文在 content/tutorials)也不是"怎么练"
// (在 data/tasks.ts)。三者的对应关系由 scripts/check-catalog.mjs 在构建期校验:
//   每个目标至少被 1 道概念题或 1 个代码任务覆盖,否则构建失败。
//
// 字段约定:
//   statement  用可观测的行为动词写(能写出/能判断/能修复),不写"理解""掌握"这类不可测动词
//   bloom      认知层级,用于检查"整门课是否只停在记忆层"
//   evidence   达成证据 —— 学生做出什么,我才算他达成了
//   timeline   课堂时间轴(教师视角),合计等于课时分钟数
//   pitfalls   课堂高发误区,教师提问时的"预警点"

import type { BloomLevel } from '../lib/types';

export interface Objective {
  /** 形如 "04-beautifulsoup-2",与概念题 objectiveId 对齐 */
  id: string;
  statement: string;
  bloom: BloomLevel;
  /** 达成证据:可观察的学生表现 */
  evidence: string;
}

export interface TimelineBlock {
  min: number;
  phase: string;
  /** 教师做什么(提问话术 / 演示 / 巡视重点) */
  teacher: string;
  /** 学生做什么 */
  student: string;
}

export interface LessonDesign {
  lessonId: string;
  /** 驱动性问题:整节课围绕它展开,结课时回到它 */
  driving: string;
  objectives: Objective[];
  prerequisites: string[];
  timeline: TimelineBlock[];
  /** 课堂高发误区(与题库 misconception 标签呼应) */
  pitfalls: string[];
  /** 形成性评价方式 */
  formative: string[];
  /** 小结时用来收口的迁移问题 */
  transfer: string;
}

export const lessonDesigns: Record<string, LessonDesign> = {
  '01-environment': {
    lessonId: '01-environment',
    driving: '为什么"在我电脑上能跑"是最没用的一句话?',
    objectives: [
      {
        id: '01-environment-1',
        statement: '能在项目内创建并激活虚拟环境,并说明它隔离了什么',
        bloom: 'understand',
        evidence: '命令行提示符出现 (.venv),pip list 只列出本项目的包',
      },
      {
        id: '01-environment-2',
        statement: '能安装 requests / beautifulsoup4 / lxml 并用一条命令验证导入成功',
        bloom: 'apply',
        evidence: 'python -c "import requests, bs4, lxml" 无报错',
      },
      {
        id: '01-environment-3',
        statement: '能写出 requirements.txt 并在新目录复原同一套依赖',
        bloom: 'apply',
        evidence: '在空目录 pip install -r requirements.txt 后脚本可运行',
      },
    ],
    prerequisites: [],
    timeline: [
      { min: 3, phase: '情境导入', teacher: '展示两份互相冲突的报错截图(同一份代码,两个人跑出两种错),问:代码一样,为什么结果不一样?', student: '猜测原因,写下自己的假设' },
      { min: 5, phase: '概念建构', teacher: '用"房间/门锁"类比讲清解释器、site-packages、虚拟环境三者关系', student: '在笔记上画出三者的层级关系' },
      { min: 8, phase: '示范操作', teacher: '现场演示 venv 创建→激活→安装→验证,故意先不激活就 pip install,让学生观察包装到了哪里', student: '同步操作,并在装错后自行纠正' },
      { min: 3, phase: '即时检测', teacher: '投屏一道概念题(未激活就安装的后果),让学生先独立作答再两两互讲', student: '作答 + 向同伴解释为什么' },
      { min: 1, phase: '收口', teacher: '回到驱动问题:虚拟环境让"能跑"变成可复现的事实', student: '用一句话写下本课的可复现标准' },
    ],
    pitfalls: ['以为创建了 venv 就自动生效(未激活)', '把 ModuleNotFoundError 归因于"没装 Python"', '在全局环境装包,导致另一个项目崩溃'],
    formative: ['操作巡检:逐个确认提示符前有 (.venv)', '概念题即时检测并互讲'],
    transfer: '如果团队里三个人 Python 版本不同,虚拟环境能解决这个问题吗?还需要补什么?',
  },

  '02-http-basics': {
    lessonId: '02-http-basics',
    driving: '浏览器按下回车之后,到页面出现,中间发生了什么?',
    objectives: [
      {
        id: '02-http-basics-1',
        statement: '能画出一次请求/响应的结构图,标出方法、URL、请求头、状态行、响应体',
        bloom: 'understand',
        evidence: '在白纸上画出五要素齐全的请求响应图',
      },
      {
        id: '02-http-basics-2',
        statement: '能根据状态码(200/301/403/404/429/500)判断问题出在哪一侧',
        bloom: 'analyze',
        evidence: '给出 5 个真实状态码场景,能正确归因到"我的请求/我的权限/对方服务"',
      },
      {
        id: '02-http-basics-3',
        statement: '能读懂并复现浏览器 Network 面板中的请求头',
        bloom: 'apply',
        evidence: '从 F12 抄出 UA 与 Referer,并用 curl/requests 复现同一请求',
      },
      {
        id: '02-http-basics-4',
        statement: '能识别编码声明并说明乱码的成因',
        bloom: 'understand',
        evidence: '对 GBK 页面显式设置 encoding 后得到正确中文',
      },
    ],
    prerequisites: ['01-environment'],
    timeline: [
      { min: 4, phase: '现象切入', teacher: '现场打开 F12 Network,刷新一个页面,问:这一屏里哪一条是"网页本身"?其余是什么?', student: '在 Network 列表里指认 HTML/JS/CSS/图片' },
      { min: 8, phase: '结构拆解', teacher: '逐行讲解一条原始请求与响应(可用 curl -v),强调"爬虫就是在手工构造第一条"', student: '抄写一条完整请求到笔记,标注各部分的用途' },
      { min: 6, phase: '状态码诊断', teacher: '给出 6 个状态码,让学生分组判断"该改代码还是该改请求头还是该停手"', student: '小组归类并说明理由' },
      { min: 8, phase: '动手复现', teacher: '布置任务:用 requests 复现浏览器对靶站 Level 1 的请求,要求 UA 与浏览器一致', student: '实操 + 对比带/不带 UA 的结果差异' },
      { min: 4, phase: '检测与收口', teacher: '概念题检测(403 归因),再回到驱动问题串起全流程', student: '作答并复述完整链路' },
    ],
    pitfalls: ['把 403 当成"页面不存在"', '认为 POST 天然比 GET 安全', '忽略 charset,把乱码归因于"网站有问题"'],
    formative: ['状态码归类小组任务', '带/不带 UA 的对比实验记录'],
    transfer: '如果服务器返回 200 但内容是"请开启 JavaScript",这算成功吗?你下一步查什么?',
  },

  '03-requests-basics': {
    lessonId: '03-requests-basics',
    driving: '凭什么几行代码就能替代一次点击?',
    objectives: [
      {
        id: '03-requests-basics-1',
        statement: '能发起 GET/POST 请求并读出状态码、文本、头部等关键信息',
        bloom: 'apply',
        evidence: '独立写出对靶站的请求并打印 status_code 与文本长度',
      },
      {
        id: '03-requests-basics-2',
        statement: '能用 params 构造查询串并解释为什么不该手拼 URL',
        bloom: 'understand',
        evidence: '手拼与 params 两种写法对比,指出中文参数被编码后的差异',
      },
      {
        id: '03-requests-basics-3',
        statement: '能用 Session 维持登录态,并说明 Cookie 在其中的作用',
        bloom: 'apply',
        evidence: '两次请求中第二次能拿到需要登录才可见的内容',
      },
      {
        id: '03-requests-basics-4',
        statement: '能为请求加上超时与异常处理,使脚本不因单次失败而挂死',
        bloom: 'apply',
        evidence: '代码中含 timeout 与 try/except,故意请求错误地址仍能优雅退出',
      },
    ],
    prerequisites: ['02-http-basics'],
    timeline: [
      { min: 5, phase: '回顾激活', teacher: '提问:昨天那条请求,如果用代码写,最少需要几个信息?', student: '口头列出 URL/方法/头' },
      { min: 10, phase: '最小可用', teacher: '演示三行代码取值,强调 resp 是一个"装满信息的对象",逐个属性点开看', student: '跟做并打印四个属性' },
      { min: 8, phase: '参数与编码', teacher: '故意手拼含中文与空格的 URL,让请求失败,再引入 params 修正', student: '对比两种写法的最终 URL' },
      { min: 10, phase: '会话与健壮性', teacher: '讲 Session 时用"门禁卡"类比;讲 timeout 时现场演示不加超时的卡死', student: '为脚本补上 Session 与 try/except' },
      { min: 7, phase: '检测与收口', teacher: '概念题(登录后立即失效)引出 Session;回到驱动问题', student: '作答 + 说出一行代码替代一次点击的对应关系' },
    ],
    pitfalls: ['手拼 URL 导致中文参数乱码', '忘记 timeout,脚本永久挂起', '用 requests.get 做登录,第二次请求丢 Cookie'],
    formative: ['手拼 vs params 的 URL 对比', '错误地址下的异常处理验证'],
    transfer: '如果登录需要先 GET 一个 token 再 POST 提交,Session 能帮你省掉哪一步?',
  },

  '04-beautifulsoup': {
    lessonId: '04-beautifulsoup',
    driving: '一页 HTML 有上千个标签,你怎么"指"给你要的那一个?',
    objectives: [
      {
        id: '04-beautifulsoup-1',
        statement: '能说明 HTML 的树形结构,并在 DOM 树上指出父子/兄弟关系',
        bloom: 'understand',
        evidence: '在浏览器 Elements 中逐层展开到目标节点并口述路径',
      },
      {
        id: '04-beautifulsoup-2',
        statement: '能用 find/find_all 与 CSS 选择器定位目标元素,并区分后代与直接子元素',
        bloom: 'apply',
        evidence: '对同一页面写出两种选择器,结果数量一致',
      },
      {
        id: '04-beautifulsoup-3',
        statement: '能从节点中提取文本与属性,并处理 class 关键字冲突',
        bloom: 'apply',
        evidence: '正确写出 class_="item",取到文本并 strip',
      },
      {
        id: '04-beautifulsoup-4',
        statement: '能判断解析结果"多了/少了"是选择器过宽还是过窄',
        bloom: 'analyze',
        evidence: '给出实际行数与预期不符时,能定位并修正选择器',
      },
    ],
    prerequisites: ['03-requests-basics'],
    timeline: [
      { min: 5, phase: '问题先行', teacher: '投屏一页 HTML,问:如果不许用眼睛找,你怎么描述"第 3 个价格"?', student: '尝试用文字描述路径' },
      { min: 10, phase: '树与路径', teacher: '用 Elements 面板演示树结构,把学生的文字描述翻译成 CSS 选择器', student: '把描述改写成选择器' },
      { min: 12, phase: '动手定位', teacher: '布置靶站 Level 1:先取全部书名,再取全部价格;巡视时重点看是否误用空格/大于号', student: '实操,遇到行数不符时自查选择器' },
      { min: 10, phase: '文本清洗', teacher: '演示 get_text 带出大量换行,引出 strip=True;强调"1200 元"这类含空格字符串的坑', student: '清洗后再比对输出' },
      { min: 8, phase: '检测与收口', teacher: '概念题(空格 vs >;class_ 冲突)即时检测;回到驱动问题:定位的本质是路径表达', student: '作答并总结自检清单' },
    ],
    pitfalls: ['用空格选择器抓到嵌套子列表,行数翻倍', 'find_all 里写 class= 直接语法错误', 'get_text 不清洗,入库带换行'],
    formative: ['选择器行数核对', '解析结果与页面人工计数比对'],
    transfer: '如果页面结构改版,你的选择器哪些会失效?怎么写才能"抗改版"?',
  },

  '05-xpath': {
    lessonId: '05-xpath',
    driving: '当结构不稳定时,如何用"关系"而不是"位置"来定位?',
    objectives: [
      {
        id: '05-xpath-1',
        statement: '能写出常用 XPath 表达式(//、/、@属性、[谓词])并说明返回值类型',
        bloom: 'apply',
        evidence: '对同一页面写出取文本、取属性、取第 n 项三条表达式且结果正确',
      },
      {
        id: '05-xpath-2',
        statement: '能用 lxml 解析 HTML 并处理"返回列表"带来的取值差异',
        bloom: 'apply',
        evidence: '代码中对空列表做判空,不出现 IndexError',
      },
      {
        id: '05-xpath-3',
        statement: '能针对具体页面在 XPath 与 CSS 之间做出有理由的取舍',
        bloom: 'analyze',
        evidence: '用两条理由说明某页面为何选 XPath(如按文本筛选/取父节点)',
      },
    ],
    prerequisites: ['04-beautifulsoup'],
    timeline: [
      { min: 5, phase: '冲突情境', teacher: '展示一个 class 全是随机串的页面,问:CSS 选择器还能用吗?', student: '发现按 class 定位失效' },
      { min: 10, phase: '语法建构', teacher: '用"文件路径"类比讲 // 与 /,用"筛选条件"类比讲谓词', student: '把上节课的 CSS 选择器逐条翻译成 XPath' },
      { min: 12, phase: '动手取数', teacher: '布置:用 XPath 取 Level 1 全部书名与价格;巡视重点看返回值未取 [0] 的报错', student: '实操并处理空列表' },
      { min: 8, phase: '对照实验', teacher: '同一目标分别用 CSS 与 XPath 实现,比较可读性与稳定性', student: '填写取舍对照表(两条理由)' },
      { min: 5, phase: '检测与收口', teacher: '概念题(返回值是列表/属性值)检测;收口到"定位 = 关系表达"', student: '作答并总结适用场景' },
    ],
    pitfalls: ['以为 xpath 返回单个节点,直接 .text 报错', '把 /div 当 //div 用,路径一变全空', '忘记处理空列表导致中途崩溃'],
    formative: ['CSS→XPath 翻译练习', '取舍对照表'],
    transfer: '同一份代码,网站改版后 XPath 更稳还是 CSS 更稳?取决于什么?',
  },

  '06-single-page': {
    lessonId: '06-single-page',
    driving: '把"能抓一条"变成"能交一份表",中间差了什么?',
    objectives: [
      {
        id: '06-single-page-1',
        statement: '能按"取—解—存"三段式组织一个完整脚本',
        bloom: 'apply',
        evidence: '代码中三个函数职责清晰,可单独替换其中一段',
      },
      {
        id: '06-single-page-2',
        statement: '能把结果写入 CSV 并解决中文乱码',
        bloom: 'apply',
        evidence: 'Excel 打开无乱码,字段列数正确',
      },
      {
        id: '06-single-page-3',
        statement: '能核对抓取条数与页面标示数量,发现静默漏抓',
        bloom: 'analyze',
        evidence: '主动打印"抓到 24 条 / 页面标注 24 条"的核对结果',
      },
    ],
    prerequisites: ['04-beautifulsoup'],
    timeline: [
      { min: 4, phase: '任务发布', teacher: '给出交付要求:一份 24 行、4 列的 CSV,字段名与页面一致', student: '复述验收标准' },
      { min: 8, phase: '结构设计', teacher: '引导先画骨架再写代码:fetch/parse/save 三个空函数', student: '在纸上写出函数签名' },
      { min: 18, phase: '实现与调试', teacher: '巡视,只回答"你现在卡在哪一段",不直接给代码', student: '分三段实现,每段跑通再进下一段' },
      { min: 10, phase: '验收与互评', teacher: '组织两两交换 CSV,按"行数/列数/中文/空值"四项互检', student: '互检并记录对方的问题' },
      { min: 5, phase: '检测与收口', teacher: '概念题(CSV 编码/抓取流程)检测;收口到"可交付"标准', student: '作答并修正自己的表' },
    ],
    pitfalls: ['一行一次请求,把简单任务做成异常流量', 'utf-8 写 CSV 用 Excel 打开乱码', '不核对条数,漏了几行也不知道'],
    formative: ['三段式函数结构检查', 'CSV 互检清单(行数/列数/中文/空值)'],
    transfer: '如果明天页面从 24 行变成 30 行,你的脚本要改哪一行?这说明什么?',
  },

  '07-pagination': {
    lessonId: '07-pagination',
    driving: '数据分布在 10 页上,你怎么保证"一页都没漏"?',
    objectives: [
      {
        id: '07-pagination-1',
        statement: '能从 URL 中识别分页规律并写出正确的循环边界',
        bloom: 'apply',
        evidence: '抓满 10 页且总数与页面标注一致,无重复无缺页',
      },
      {
        id: '07-pagination-2',
        statement: '能为翻页加去重与容错,单页失败不影响整体',
        bloom: 'apply',
        evidence: '人为制造一页 404,脚本仍完成其余 9 页并输出失败清单',
      },
      {
        id: '07-pagination-3',
        statement: '能说明延时与频率控制的目的,并设置合理间隔',
        bloom: 'understand',
        evidence: '口述 sleep 的作用是"降低对方压力"而非"伪装",并在代码中体现',
      },
    ],
    prerequisites: ['06-single-page'],
    timeline: [
      { min: 4, phase: '边界提问', teacher: '问:range(1, 10) 抓几页?为什么这里最容易少一页?', student: '口算并发现左闭右开' },
      { min: 8, phase: '规律识别', teacher: '给三个站点的分页 URL,让学生找出各自的规律(路径/查询参数/游标)', student: '分组归纳三类分页形态' },
      { min: 18, phase: '实现翻页', teacher: '要求先打印所有待抓 URL 再统一抓取,便于肉眼核对', student: '实现循环并核对 URL 列表' },
      { min: 10, phase: '故障演练', teacher: '临时改一页 URL 为不存在,观察谁的脚本整体崩掉', student: '加 try/except 与失败清单' },
      { min: 5, phase: '检测与收口', teacher: '概念题(range 边界/sleep 目的)检测', student: '作答并总结"不漏页"的三道保险' },
    ],
    pitfalls: ['range 边界少抓最后一页', '重复抓同一页导致数据翻倍', '不加延时连续请求被限流'],
    formative: ['待抓 URL 列表人工核对', '故障演练(单页 404)结果对比'],
    transfer: '如果总页数是动态变化的(今天 10 页明天 12 页),你怎么写才不用改代码?',
  },

  '08-multi-level': {
    lessonId: '08-multi-level',
    driving: '列表页只给你"门牌号",你怎么高效地把每间屋子都走一遍?',
    objectives: [
      {
        id: '08-multi-level-1',
        statement: '能设计列表页→详情页的两级抓取流程并说明为什么要分两级',
        bloom: 'apply',
        evidence: '产出 20 条含详情字段的完整记录',
      },
      {
        id: '08-multi-level-2',
        statement: '能在发请求之前完成链接去重',
        bloom: 'apply',
        evidence: '同一链接只请求一次,日志中请求数等于去重后链接数',
      },
      {
        id: '08-multi-level-3',
        statement: '能为单条失败做隔离与重试,使整体任务不被一条超时中断',
        bloom: 'apply',
        evidence: '制造一条超时,任务仍完成其余条目并输出失败清单',
      },
    ],
    prerequisites: ['07-pagination'],
    timeline: [
      { min: 5, phase: '结构提问', teacher: '展示列表页与详情页截图,问:哪些字段只能在详情页拿到?', student: '指认两级页面的字段差异' },
      { min: 8, phase: '流程设计', teacher: '引导画出"列表→URL 集合→详情→合并"的数据流', student: '在纸上画数据流并标出去重位置' },
      { min: 20, phase: '实现', teacher: '重点巡视:是否先收齐 URL 再抓详情(而不是嵌套边抓边请求)', student: '分两步实现,先打印 URL 清单' },
      { min: 12, phase: '容错加固', teacher: '人为让一条详情超时,观察脚本行为,引出失败清单与有限重试', student: '补上 try/except 与重试上限' },
      { min: 5, phase: '检测与收口', teacher: '概念题(去重位置/单条失败处理)检测', student: '作答并复述"部分成功"原则' },
    ],
    pitfalls: ['边爬列表边请求详情,列表失败就全丢', '去重放在入库而不是请求前', '一条异常让 19 条已抓数据作废'],
    formative: ['数据流图检查', '失败清单完整性核对'],
    transfer: '如果详情页还要再链到"评论页"(三级),你的结构要改哪里?',
  },

  '09-json-and-storage': {
    lessonId: '09-json-and-storage',
    driving: '为什么有时候"不用解析 HTML"反而是更专业的做法?',
    objectives: [
      {
        id: '09-json-and-storage-1',
        statement: '能识别 JSON 接口并把响应解析为 Python 对象',
        bloom: 'apply',
        evidence: '从靶站接口取到结构化数据并正确取出嵌套字段',
      },
      {
        id: '09-json-and-storage-2',
        statement: '能遍历嵌套 JSON 并用防御式写法避免 KeyError',
        bloom: 'apply',
        evidence: '代码中对缺失字段使用 .get() 或判空,不因单条异常中断',
      },
      {
        id: '09-json-and-storage-3',
        statement: '能用 SQLite 建表并以 UPSERT 实现可重复执行的入库',
        bloom: 'apply',
        evidence: '同一脚本跑两次,库中记录数不翻倍且数据为最新',
      },
    ],
    prerequisites: ['06-single-page'],
    timeline: [
      { min: 5, phase: '对比切入', teacher: '同时展示"HTML 里找价格"与"接口里直接有 price 字段",问:哪个更可靠?', student: '比较两者取数成本' },
      { min: 8, phase: '接口识别', teacher: '在 Network 面板筛 XHR,演示如何判断响应是 JSON', student: '在靶站找到分页接口' },
      { min: 16, phase: '解析与防御', teacher: '演示 raw["items"][0]["title"] 遇缺字段崩溃,引出 .get() 与判空', student: '实现并处理缺字段条目' },
      { min: 14, phase: '入库', teacher: '讲 UPSERT 时强调"重跑脚本不产生脏数据",现场跑两遍验证', student: '建表 + 跑两次核对记录数' },
      { min: 7, phase: '检测与收口', teacher: '概念题(JSON 解析/UPSERT)检测;回到驱动问题:接口是网站的"原话"', student: '作答并总结"接口优先"的判断条件' },
    ],
    pitfalls: ['把 resp.text 当字典用', '嵌套取值不判空,一条脏数据中断整批', '直接 INSERT,重跑后数据翻倍'],
    formative: ['接口字段清单', '两遍运行的记录数核对'],
    transfer: '接口需要签名参数才能访问时,你该怎么判断"这是技术问题还是合规问题"?',
  },

  '10-dynamic-pages': {
    lessonId: '10-dynamic-pages',
    driving: '页面上的数据是"看不见"还是"还没来"?',
    objectives: [
      {
        id: '10-dynamic-pages-1',
        statement: '能用"源代码 vs Elements"和 Network 面板判断页面是否前端渲染',
        bloom: 'analyze',
        evidence: '对三个页面给出"静态/动态"判断并说明依据',
      },
      {
        id: '10-dynamic-pages-2',
        statement: '能优先寻找并直接请求底层接口,而不是直接上无头浏览器',
        bloom: 'analyze',
        evidence: '先定位 XHR 接口成功取数,并在对比中说明其成本优势',
      },
      {
        id: '10-dynamic-pages-3',
        statement: '能用 Playwright 等待元素出现再提取,而不是固定 sleep',
        bloom: 'apply',
        evidence: '代码中使用 wait_for_selector,失败时有明确超时报错',
      },
    ],
    prerequisites: ['09-json-and-storage'],
    timeline: [
      { min: 6, phase: '矛盾情境', teacher: 'requests 返回的 HTML 里搜不到商品名,但浏览器能看到,问:数据藏在哪?', student: '提出三种假设' },
      { min: 10, phase: '诊断方法', teacher: '演示"查看源代码 vs Elements"对照 + XHR 筛选,给出判断口诀', student: '对靶站 Level 5 做同样判断' },
      { min: 16, phase: '首选方案', teacher: '带学生找到底层接口并用 requests 直接取,对比与浏览器方案的资源消耗', student: '用接口方案取到数据' },
      { min: 14, phase: '兜底方案', teacher: '当确实没有接口时的 Playwright 路径:等待元素而非 sleep', student: '改写为 wait_for_selector' },
      { min: 9, phase: '检测与收口', teacher: '概念题(动态判断/固定等待)检测;收口到"先找接口,再上浏览器"的决策顺序', student: '作答并写出决策流程' },
    ],
    pitfalls: ['用 sleep 赌网速', '一上手就 Playwright,资源与稳定性双输', '把 403 误判为"动态渲染"'],
    formative: ['三页面静态/动态判断表', '接口方案与浏览器方案的资源对比'],
    transfer: '什么情况下"直接上浏览器"是合理选择而不是偷懒?',
  },

  '11-anti-crawling': {
    lessonId: '11-anti-crawling',
    driving: '当网站明确说"慢一点",你该调代码还是调心态?',
    objectives: [
      {
        id: '11-anti-crawling-1',
        statement: '能列举常见反爬手段并说明其检测依据',
        bloom: 'understand',
        evidence: '说出 UA/Cookie/频率/行为特征四类,并各举一个检测点',
      },
      {
        id: '11-anti-crawling-2',
        statement: '能针对 401/403/429 分别给出正确的响应策略',
        bloom: 'analyze',
        evidence: '对三种状态码给出"改什么"的具体动作,含退避而非硬刚',
      },
      {
        id: '11-anti-crawling-3',
        statement: '能实现请求头伪装与频率控制,并说明其合规边界',
        bloom: 'apply',
        evidence: '脚本含合理 UA、随机延时、有限重试,并注明不绕过访问控制',
      },
      {
        id: '11-anti-crawling-4',
        statement: '能判断一个"技术可行"的抓取方案是否越过了合规红线',
        bloom: 'analyze',
        evidence: '对验证码/付费墙/个人信息的三个场景给出拒绝理由',
      },
    ],
    prerequisites: ['03-requests-basics'],
    timeline: [
      { min: 6, phase: '立场澄清', teacher: '先立规矩:本课教"如何被发现并正确处理",不教"如何不被发现"', student: '复述两条红线' },
      { min: 10, phase: '检测原理', teacher: '从服务器视角讲:它凭什么判断你是脚本?(头、频率、行为序列)', student: '反推自己脚本的"破绽清单"' },
      { min: 12, phase: '状态码响应', teacher: '给出 401/403/429 三个场景,让学生写"下一步动作",对比"硬刚"与"退避"', student: '小组产出响应策略卡' },
      { min: 12, phase: '加固实操', teacher: '在靶站上实现 UA + 延时 + 重试上限,观察日志', student: '加固并记录每次请求间隔' },
      { min: 10, phase: '边界判断', teacher: '给三个真实场景(验证码/付费墙/手机号)让学生判断"做还是不做",追问理由', student: '表态 + 给出理由,接受同伴质询' },
      { min: 10, phase: '检测与收口', teacher: '概念题(429 响应/验证码边界)检测;收口到"合规优先于效率"', student: '作答并写下自己的红线清单' },
    ],
    pitfalls: ['遇 429 先换代理而不是降频', '把"能绕过"当成"可以绕过"', '伪装 UA 就以为解决了反爬'],
    formative: ['破绽清单', '响应策略卡互评', '边界情境表态 + 理由'],
    transfer: '如果业务方要求"今天必须抓完 10 万条",你会怎么回应?',
  },

  '12-ethics': {
    lessonId: '12-ethics',
    driving: '合法的技术,为什么会做出违规的事?',
    objectives: [
      {
        id: '12-ethics-1',
        statement: '能读懂 robots.txt 并说明它的效力边界(约定,不是授权)',
        bloom: 'understand',
        evidence: '对一个 robots.txt 说出哪些路径被禁,并指出它不解决什么问题',
      },
      {
        id: '12-ethics-2',
        statement: '能列举爬虫合规的四个判断维度(协议/个人信息/著作权/系统影响)',
        bloom: 'understand',
        evidence: '对给定场景逐条对照四维度给出结论',
      },
      {
        id: '12-ethics-3',
        statement: '能识别"公开可见即可批量收集"这一常见误区',
        bloom: 'analyze',
        evidence: '指出公开手机号名单场景中的法律风险点',
      },
    ],
    prerequisites: ['11-anti-crawling'],
    timeline: [
      { min: 4, phase: '案例切入', teacher: '讲一个真实处罚案例(不点名),问:他技术上做错了什么?', student: '发现"技术上没错"' },
      { min: 7, phase: 'robots 精读', teacher: '现场读本站 robots.txt,逐行解释 User-agent/Disallow/Sitemap;追问"禁了还能不能抓"（能,所以才有合规问题）', student: '判断五个路径是否可抓,并说明理由' },
      { min: 8, phase: '四维框架', teacher: '给出协议/个人信息/著作权/系统影响四维检查表,带学生过一遍', student: '用检查表评估课程靶站' },
      { min: 6, phase: '情境判断', teacher: '给四个情境(公开手机号/付费文章/竞品价格/学术数据),让学生判断并说明依据', student: '小组判断 + 交叉质询' },
      { min: 5, phase: '检测与收口', teacher: '概念题(robots 效力/公开≠可收集)检测;收口到"技术能力不等于行为许可"', student: '写下自己项目的三条合规约束' },
    ],
    pitfalls: ['把 robots.txt 当法律', '认为"公开数据"没有使用限制', '忽略对目标系统可用性的影响'],
    formative: ['robots.txt 路径判断', '四维检查表实操', '情境判断 + 质询'],
    transfer: '毕设要抓某平台数据,导师问你"合规吗",你会用哪四句话回答?',
  },

  '13-final-project': {
    lessonId: '13-final-project',
    driving: '一个"跑得完、跑得住、说得清"的爬虫项目长什么样?',
    objectives: [
      {
        id: '13-final-project-1',
        statement: '能按分层结构组织代码,使取数/解析/入库可独立重跑',
        bloom: 'analyze',
        evidence: '三个模块职责清晰,单独替换解析规则不影响其余部分',
      },
      {
        id: '13-final-project-2',
        statement: '能实现断点续爬与幂等入库',
        bloom: 'apply',
        evidence: '中途 kill 后重跑,不重复抓取、不产生重复记录',
      },
      {
        id: '13-final-project-3',
        statement: '能输出可复盘的运行日志与失败清单',
        bloom: 'apply',
        evidence: '日志含开始/结束/成功数/失败 URL,可直接定位问题条目',
      },
      {
        id: '13-final-project-4',
        statement: '能写出一页项目说明:数据来源、合规判断、字段含义、已知缺陷',
        bloom: 'analyze',
        evidence: 'README 含四部分内容,他人可照此复现',
      },
    ],
    prerequisites: ['07-pagination', '08-multi-level', '09-json-and-storage', '12-ethics'],
    timeline: [
      { min: 8, phase: '需求与验收', teacher: '发布任务书:字段表、条数要求、合规声明、交付物清单', student: '拆解成可执行子任务' },
      { min: 12, phase: '结构设计', teacher: '评审各组的分层草图,重点问"哪一步失败后怎么重跑"', student: '画出模块图 + 重跑策略' },
      { min: 35, phase: '实现', teacher: '巡视只做三件事:问卡点、指出隐患、演示一次断点续爬', student: '分模块实现并逐步联调' },
      { min: 15, phase: '故障注入', teacher: '随机中断一组的进程,要求现场恢复并解释机制', student: '演示恢复过程' },
      { min: 12, phase: '答辩与互评', teacher: '用四维量规(完整性/健壮性/合规性/可读性)组织互评', student: '展示 + 按量规打分并给一条改进建议' },
      { min: 8, phase: '收口', teacher: '回到驱动问题:跑得完是功能,跑得住是工程,说得清是专业', student: '写下自己项目的下一步改进' },
    ],
    pitfalls: ['单文件脚本,一处失败全盘重来', '无日志,出了问题只能靠猜', '交付只有数据没有说明,别人无法复现'],
    formative: ['模块图与重跑策略评审', '故障注入现场恢复', '四维量规互评'],
    transfer: '如果这个项目要交给下一届学弟维护,你现在的代码里最该先改哪一处?',
  },
};

export const designList = Object.values(lessonDesigns);

/** 按 id 查目标(构建期校验与页面渲染共用) */
export function getObjective(objectiveId: string): Objective | undefined {
  for (const d of designList) {
    const hit = d.objectives.find((o) => o.id === objectiveId);
    if (hit) return hit;
  }
  return undefined;
}
