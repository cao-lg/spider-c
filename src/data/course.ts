// 课程元数据 —— 全站单一数据源
// 导航、教程页面、综合测试页面、学习中心均由此生成

export interface Unit {
  id: string; // 单元标识,如 "unit-1"
  number: number; // 单元序号
  title: string; // 单元名称
  description: string; // 单元简介
}

export interface Lesson {
  id: string; // 标识,如 "01-environment"
  unitId: string; // 所属单元
  order: number; // 单元内顺序
  title: string; // 中文标题
  slug: string; // URL 中使用的英文 slug
  duration: number; // 预计学习时长(分钟)
  summary: string; // 一句话简介
  goals: string[]; // 学习目标
  /** 涉及技能维度(用于掌握度雷达图),取值见 skillDomains */
  skills: string[];
  practiceTarget?: string; // 关联的靶站路径
}

export interface UnitTest {
  id: string; // 如 "unit-test-1"
  unitId: string;
  title: string;
  minutes: number; // 考试模式限时(分钟)
}

export const siteName = '爬虫学堂';
export const siteTagline = '从零到实战,系统学习 Python 爬虫';

export const units: Unit[] = [
  {
    id: 'unit-1',
    number: 1,
    title: '爬虫基础',
    description: '环境搭建、HTTP 原理、requests 库入门,建立爬虫的底层认知。',
  },
  {
    id: 'unit-2',
    number: 2,
    title: '数据解析',
    description: 'BeautifulSoup 与 XPath 两大解析利器,把网页变成可用的数据。',
  },
  {
    id: 'unit-3',
    number: 3,
    title: '进阶爬取',
    description: '分页翻页、多级页面、JSON 接口与数据库存储,应对真实网站结构。',
  },
  {
    id: 'unit-4',
    number: 4,
    title: '反爬与动态页面',
    description: '动态渲染与常见反爬手段,学会与网站规则打交道的正确姿势。',
  },
  {
    id: 'unit-5',
    number: 5,
    title: '规范与综合实战',
    description: '爬虫伦理与合规,并用一个完整项目串联全部知识。',
  },
];

export const lessons: Lesson[] = [
  {
    id: '01-environment',
    unitId: 'unit-1',
    order: 1,
    title: '环境搭建',
    slug: '01-environment',
    duration: 20,
    summary: '安装 Python、创建虚拟环境、安装 requests 与 BeautifulSoup。',
    goals: ['安装并验证 Python 环境', '学会使用 pip 安装第三方库', '用 venv 创建隔离的虚拟环境'],
    skills: [],
  },
  {
    id: '02-http-basics',
    unitId: 'unit-1',
    order: 2,
    title: 'HTTP 基础',
    slug: '02-http-basics',
    duration: 30,
    summary: '请求与响应、状态码、请求头,理解浏览器与服务器如何对话。',
    goals: ['理解 HTTP 请求与响应结构', '认识常见状态码的含义', '理解 User-Agent 与请求头的作用'],
    skills: ['请求'],
  },
  {
    id: '03-requests-basics',
    unitId: 'unit-1',
    order: 3,
    title: 'requests 入门',
    slug: '03-requests-basics',
    duration: 40,
    summary: 'GET/POST、参数、请求头、Session、超时与异常处理。',
    goals: ['发起 GET 与 POST 请求', '携带参数与请求头', '使用 Session 保持状态', '正确处理超时与异常'],
    skills: ['请求'],
  },
  {
    id: '04-beautifulsoup',
    unitId: 'unit-2',
    order: 1,
    title: 'BeautifulSoup 解析',
    slug: '04-beautifulsoup',
    duration: 45,
    summary: '用 BeautifulSoup + CSS 选择器从 HTML 中提取数据。',
    goals: ['解析 HTML 文档结构', '使用 find / find_all 定位元素', '使用 CSS 选择器', '提取文本与属性'],
    skills: ['解析'],
  },
  {
    id: '05-xpath',
    unitId: 'unit-2',
    order: 2,
    title: 'XPath 解析',
    slug: '05-xpath',
    duration: 40,
    summary: 'lxml 与 XPath 表达式,用路径精确定位网页元素。',
    goals: ['理解 XPath 路径语法', '使用 lxml 进行解析', '对比 XPath 与 CSS 选择器的取舍'],
    skills: ['解析'],
  },
  {
    id: '06-single-page',
    unitId: 'unit-2',
    order: 3,
    title: '单页数据实战',
    slug: '06-single-page',
    duration: 45,
    summary: '完整爬取一个图书列表页,并保存为 CSV。',
    goals: ['独立完成单页爬取流程', '将结果保存为 CSV', '结合靶站 Level 1 实操'],
    skills: ['解析'],
    practiceTarget: '/practice/level1-books/',
  },
  {
    id: '07-pagination',
    unitId: 'unit-3',
    order: 1,
    title: '分页与翻页',
    slug: '07-pagination',
    duration: 45,
    summary: '循环翻页,应对分页结构的网站。',
    goals: ['识别分页 URL 规律', '循环遍历所有页面', '控制请求频率防止误伤'],
    skills: ['分页'],
    practiceTarget: '/practice/level2-pagination/',
  },
  {
    id: '08-multi-level',
    unitId: 'unit-3',
    order: 2,
    title: '多级页面爬取',
    slug: '08-multi-level',
    duration: 50,
    summary: '列表页 + 详情页的组合爬取策略。',
    goals: ['设计列表到详情的两级抓取', '维护已抓取集合去重', '合理并发提速'],
    skills: ['分页', '请求'],
    practiceTarget: '/practice/level3-detail/',
  },
  {
    id: '09-json-and-storage',
    unitId: 'unit-3',
    order: 3,
    title: 'JSON 接口与数据存储',
    slug: '09-json-and-storage',
    duration: 50,
    summary: '直接请求 JSON 接口,并用 SQLite 持久化数据。',
    goals: ['识别并请求 JSON 接口', '解析嵌套 JSON 结构', '使用 SQLite 存储结构化数据'],
    skills: ['存储', '请求'],
    practiceTarget: '/practice/level4-json-api/',
  },
  {
    id: '10-dynamic-pages',
    unitId: 'unit-4',
    order: 1,
    title: '动态页面与 Playwright',
    slug: '10-dynamic-pages',
    duration: 55,
    summary: '用无头浏览器处理 JS 动态渲染的页面。',
    goals: ['判断页面是否动态渲染', '使用 Playwright 自动化浏览器', '等待元素出现并提取数据'],
    skills: ['反爬', '请求'],
    practiceTarget: '/practice/level5-dynamic/',
  },
  {
    id: '11-anti-crawling',
    unitId: 'unit-4',
    order: 2,
    title: '反爬对抗',
    slug: '11-anti-crawling',
    duration: 60,
    summary: 'UA 伪装、请求头、延时、代理与请求频率控制。',
    goals: ['理解常见反爬机制', '学会 UA 与请求头伪装', '掌握延时与频率控制', '了解代理与 IP 池的原理'],
    skills: ['反爬'],
  },
  {
    id: '12-ethics',
    unitId: 'unit-5',
    order: 1,
    title: '爬虫伦理与合规',
    slug: '12-ethics',
    duration: 30,
    summary: 'robots.txt、访问频率与国内数据合规红线。',
    goals: ['读懂并尊重 robots.txt', '遵循合理的访问频率', '了解国内数据相关法规底线'],
    skills: [],
  },
  {
    id: '13-final-project',
    unitId: 'unit-5',
    order: 2,
    title: '综合项目实战',
    slug: '13-final-project',
    duration: 90,
    summary: '从需求分析到数据落库,完成一个完整的爬虫项目。',
    goals: ['独立完成完整爬虫项目', '串联请求、解析、存储全部技能', '编写健壮的异常处理与日志'],
    skills: ['请求', '解析', '分页', '反爬', '存储'],
  },
];

export const unitTests: UnitTest[] = [
  { id: 'unit-test-1', unitId: 'unit-1', title: '单元一 综合测试 · 爬虫基础', minutes: 15 },
  { id: 'unit-test-2', unitId: 'unit-2', title: '单元二 综合测试 · 数据解析', minutes: 15 },
  { id: 'unit-test-3', unitId: 'unit-3', title: '单元三 综合测试 · 进阶爬取', minutes: 20 },
  { id: 'unit-test-4', unitId: 'unit-4', title: '单元四 综合测试 · 反爬与动态', minutes: 20 },
  { id: 'unit-test-5', unitId: 'unit-5', title: '单元五 综合测试 · 规范与综合', minutes: 15 },
];

export const totalLessons = lessons.length;
export const totalMinutes = lessons.reduce((sum, l) => sum + l.duration, 0);

export function getUnit(id: string): Unit {
  return units.find((u) => u.id === id)!;
}

export function getLessonById(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}

export function lessonsOfUnit(unitId: string): Lesson[] {
  return lessons.filter((l) => l.unitId === unitId);
}

export function unitIndexOfLesson(lessonId: string): number {
  return lessons.findIndex((l) => l.id === lessonId);
}

export function getUnitTestByUnitId(unitId: string): UnitTest | undefined {
  return unitTests.find((t) => t.unitId === unitId);
}

// 技能维度 —— 用于掌握度雷达图
export const skillDomains = ['请求', '解析', '分页', '反爬', '存储'] as const;
export type SkillDomain = (typeof skillDomains)[number];
