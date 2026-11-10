# 爬虫学堂 · spider-c

面向初学者到进阶者的 **Python 爬虫课程站**。纯静态(Astro),浏览器内用 Pyodide 跑真实 Python,
所有练习打的是本站自建的「靶站」,不依赖任何外部网站,也不收集学生数据。

> v2 的改造重点不是加页面,而是把「讲什么」变成「**凭什么说学生学会了**」:
> 每节课都有可观测目标、配套的概念诊断题、可自动判分的代码实操,以及给教师看的
> 目标—活动—评价一致性矩阵([`/design/`](https://spider-c.pages.dev/design/))。

---

## 一、这门课怎么设计的

四条原则贯穿全部 13 节课,写作与改稿时请遵守:

| 原则 | 落地方式 | 检查手段 |
| --- | --- | --- |
| 目标是行为,不是态度 | 目标用「能写出 / 能判断 / 能修复」开头,标注 Bloom 层级 | `tests/unit/catalog.test.ts` 禁用「理解/掌握」等不可测动词 |
| 先诊断,后讲解 | 每课由一个「答不上来但想知道」的驱动性问题开场 | `/design/` 每张设计卡的 `driving` 字段 |
| 错误要归因 | 概念题每个**错误选项**都写诊断文本,学生看到的是「你为什么会这么想」 | 构建期强制校验 `optionFeedback` 逐项非空 |
| 练习要能重跑 | 代码在浏览器内真跑真判分;入库任务要求幂等(UPSERT) | 单元测 5 题/单元,可无限次重试 |

**三类评价互不替代**:

1. **概念检查点**(每课 2–3 题,即时诊断)→ 回答「讲得清吗」
2. **代码实操**(每课 1 题)→ 回答「做得对吗」
3. **单元卷**(概念卷 + 实操卷,分开记分)→ 回答「这一单元稳不稳」

答错的概念题会进入[错题本](https://spider-c.pages.dev/mistakes/),按**误区标签**聚合,
排序依据是「错得多 + 放得久」(间隔复习的工程近似),答对一次即消除。

---

## 二、技术结构

```
src/
├─ data/                  ← 内容与评估的"单一数据源",几乎全部教学逻辑在这里
│  ├─ course.ts           课程目录:单元 / 课时 / 时长 / 技能维度 / 单元测 / 综合测试
│  ├─ design.ts           教学设计:可观测目标、课堂时间轴、误区预警、迁移问题
│  ├─ questions.ts        概念题库:选项级诊断反馈 + 误区标签
│  └─ tasks.ts            代码实操题:starter / check 判分逻辑 / 分步提示
├─ content/tutorials/*.mdx 课程正文(frontmatter 只有 id,元数据一律走 course.ts)
├─ components/
│  ├─ Quiz.astro + quiz-client.ts       概念题(服务端渲染 + 客户端诊断判分)
│  ├─ CodeRunner.astro + runner-client.ts      演示/引导/挑战三种运行器
│  ├─ CodeExercise.astro + code-exercise-client.ts  自动判分的实操题
│  ├─ code-editor.ts     零依赖代码编辑器(textarea + 高亮层)
│  └─ runner-runtime.ts  Pyodide worker 单例,串行执行 + 超时强杀
├─ lib/
│  ├─ schema.ts           localStorage schema 与迁移(v1 → v2 不丢数据)
│  ├─ store.ts            学习数据读写、订阅、导入导出合并
│  ├─ scoring.ts          判分、掌握度(指数滑动平均)、复习优先级
│  └─ types.ts            共享类型
├─ pages/                 路由:课程、靶站、单元测、综合测试、错题本、学习中心、教学设计
public/
├─ practice/             靶站(Level 1–5 + 10 套综合测试同构站,全部虚构数据)
└─ pyodide/              自托管 Python 运行时与 wheel(16MB,离线可用)
scripts/
├─ check-catalog.ts      构建前目录一致性校验(prebuild 自动执行)
└─ gen-*.py              靶站/题目生成脚本
```

### 单数据源的边界

- 课程元数据只在 `course.ts`。mdx 里再写 `title`/`duration` 会被构建**拦下**——
  v1 曾出现「导航 30 分钟、正文 35 分钟」的静默漂移。
- 题目的 `objectiveId` 必须指向 `design.ts` 里存在的目标;没被任何题或实操覆盖的目标会让
  构建失败(防止「教了但不评」)。
- 设计卡的时间轴合计必须等于课时时长,否则构建失败(保证备课稿能直接用)。

---

## 三、常用命令

```bash
npm install
npm run dev          # 本地开发 (localhost:4321)
npm run check        # 目录一致性校验(构建前自动跑)
npm run typecheck    # 主站 + functions/ 两套 tsconfig 分别检查 .ts(不含 .astro 模板)
npm test             # 纯逻辑快测:判分/迁移/题库/报告引擎/后端链路(秒级,含内存 D1/R2)
npm run build        # 静态构建 → dist/(36 页)
npm run verify       # check + typecheck + test + build,提交前跑这个
npm run test:e2e     # Playwright 端到端(需要 pip install playwright)
npm run archive:weekly  # 阶段 2 定时归档,需 SITE_URL + TEACHER_TOKEN 环境变量
```

## 四、加一节课要动哪些文件

1. `src/data/course.ts` — 在 `lessons` 里加一条(unitId / order / duration / skills)。
2. `src/content/tutorials/<id>.mdx` — 新建正文,frontmatter 只写 `id`,文件名必须与 id 一致。
3. `src/data/design.ts` — 加一张设计卡:驱动性问题、可观测目标、时间轴(合计=课时)、误区、迁移问题。
4. `src/data/questions.ts` — 至少 2 道概念题,每题写 `anchor`、`explanation`、逐项 `optionFeedback`。
5. `src/data/tasks.ts` — 可选,加一个代码实操(check 里写断言,失败时抛异常并给出可读原因)。
6. `npm run verify` — 校验脚本会告诉你哪一处对不上。

## 五、学生数据与隐私

- **默认无后端**。学习记录只在浏览器 `localStorage`(key `crawler-course:v2`),可导出 JSON 备份。
- 升级 schema 时走 `src/lib/schema.ts` 的 `migrate()`,**不允许**直接改 key 丢掉旧数据。
- 昵称仅用于报告文案,不上传;逐题作答明细只用于「凭什么说学会了」的证据链。
- **云同步是可选功能**:「学习中心 → 云同步」默认关闭,启用后才向 `/api/*` 上报匿名学号 + 学习快照,
  服务端只存加盐哈希与聚合记录,学生可随时删除。不开通不影响任何课程功能。
- 教师端聚合报告不做个人排名,学生明细只出现匿名学号;无证据的目标显示「无数据」而非 0 分。

## 六、已知限制(请在对外说明中保留)

1. **前端判分不适合正式考试**:题目答案与诊断文本随页面下发,可被查看源码获取。
   适合日常形成性评价;若用于学分认定,需另配线下或服务端监考。
2. **Pyodide 不等于本机 Python**:首次加载约 5–10 秒;`requests` 在浏览器里受同源策略限制,
   只能打本站靶站;`playwright` 无法在浏览器内运行(第 10 课以演示 + 本地实践为主)。
3. **robots.txt 与合规**:靶站是虚构数据。课程反复强调「技术可行 ≠ 行为许可」,
   第 11、12 课专门处理这条边界,不要为了「教学效果」加入绕过验证码/付费墙的内容。
   本站 `robots.txt` 允许抓取靶站 `/practice/`、禁止 `/private/`;而 `/private/` 仍返回 200,
   这不是 bug,是第 12 课的实物教具(说明 robots 是声明而非屏障)。该文件保持纯 ASCII、
   不写裸 `Allow: /`、规则紧跟 `User-agent`,原因见第 12 课「三个真实的坑」。

## 七、部署

静态产物 `dist/` 可直接托管。当前配置面向 Cloudflare Pages(`astro.config.mjs` 的 `site`
与 `public/_headers` 的 MIME 规则);`public/pyodide/` 必须整目录上传,worker 从
`/pyodide/` 根路径取 wheel。详见 [docs/DEPLOY.md](docs/DEPLOY.md)。

若要启用在线看板,项目根的 `functions/` 会被 Pages 自动识别成 `/api/*`,静态构建无需改动;
需另建 D1 并绑定 `DB`、设置 `TEACHER_TOKEN` / `SYNC_SALT` 两个 secret,详见
[docs/TEACHER-DATA.md](docs/TEACHER-DATA.md)。

## 八、教师学情数据(三个阶段)

| 阶段 | 入口 | 是否需要云 |
| --- | --- | --- |
| 0 · 离线汇总 | `/teacher/`(主导航「学情报告」),多选学生 JSON 出报告 | 否,零账号零费用 |
| 1 · 在线看板 | 同页切「云端看板」,学生端「学习中心 → 云同步」 | D1 + Pages Functions |
| 2 · 周快照归档 | 教师端一键 / `npm run archive:weekly` | R2(仅归档,不是主库) |

三阶段共用 `src/lib/class-report.ts` 一套口径;报告包含目标达成矩阵(44 目标,标注证据强度)、
共性误区热力图(28 标签)、进度与技能分布、教学决策建议,支持两班对比、CSV 导出与打印。
**R2 不是主存储**:浏览器不能直连对象存储,且整包覆盖写会在多设备同步时丢记录;主数据在 D1,
服务端用 `mergeLearningData()` 合并后 UPSERT。完整部署、合规与故障排查见
[docs/TEACHER-DATA.md](docs/TEACHER-DATA.md)。
