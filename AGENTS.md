# AGENTS.md — 在这个仓库里工作前请先读

这是 Astro 静态站,但**不是普通的内容站**:它同时是课程、评估系统和一个可离线运行的
Python 沙箱。改动前请先理解下面四条硬约束,它们都有自动化检查在守。

## 一、不要破坏的约束(invariant)

1. **元数据单一来源 = `src/data/course.ts`**
   mdx 的 frontmatter 只允许 `id`。若在那里补 `title`/`duration`/`goals`,`npm run check`
   会直接失败——v1 就是因为两处各写一份而漂移过。

2. **目标—评价必须对齐**
   `src/data/design.ts` 里每个 `objective.id` 至少要被 `questions.ts` 的一道题、
   或该课的 `tasks.ts` 实操覆盖。新增目标必须同时补题,否则构建失败。

3. **概念题的错误选项必须写诊断**
   `optionFeedback` 长度 = 选项数,且每个非正确项都要有 ≥8 字的说明(「为什么有人会这么选」)。
   只报答案不算诊断,会被 `tests/unit/catalog.test.ts` 拦下。

4. **学习数据升级必须走迁移**
   `src/lib/schema.ts` 的 `migrate()` 负责老数据升级。禁止直接改 localStorage key 或
   删字段——那会静默丢掉学生几个月的记录。

## 二、常见任务的正确动线

| 想做什么 | 改哪里 | 之后跑什么 |
| --- | --- | --- |
| 改课程说明/时长 | `course.ts` | `npm run verify` |
| 写/改正文 | `content/tutorials/<id>.mdx`(只动正文) | `npm run check` |
| 加概念题 | `questions.ts`(记得 `anchor`/`explanation`/逐项 `optionFeedback`) | `npm test` |
| 加代码实操 | `tasks.ts`(`check` 用断言,失败消息要能指导学生) | `npm run build` |
| 调整课堂设计 | `design.ts`(时间轴合计必须等于课时) | `npm test` |
| 改判分/掌握度 | `lib/scoring.ts`(纯函数,先写测试) | `npm test` |
| 改编辑器 | `components/code-editor.ts`(**字体度量必须与高亮层一致**) | 手动在浏览器检查光标对齐 |
| 加页面 | `src/pages/*.astro`;导航在 `layouts/Site.astro` | `npm run verify` |

## 三、代码风格与工程约定

- 编辑器是「透明 textarea + 高亮层」。改 `.ce-input` 与 `.ce-highlight` 的
  font-size / line-height / padding / font-family 必须**成对修改**,只改一边会让光标与文字错层。
- 自定义元素里不要用 `id` / `title` 作为私有字段名:它们与 `HTMLElement` 的属性冲突
  (v1 就踩过,TS 会报 `incorrectly extends base class`)。
- 浏览器端代码不引入运行时依赖(离线可用是产品特性)。语法高亮是自己写的分词器。
- 新增文案遵循教学设计原则:目标用可观测动词;提示分步给,不要一次抛出完整答案。
- 涉及爬虫内容时保持合规基调:可以讲「网站如何检测」「遇到 429 怎么退让」,
  不写「如何绕过验证码/付费墙/风控」的操作细节。

## 四、命令

```bash
npm run dev        # 开发服务器(需要后台运行时用 run_in_background)
npm run check      # 目录一致性校验(构建前自动执行)
npm run typecheck  # tsc --noEmit(仅 .ts;.astro 模板由 astro build 兜底)
npm test           # node --test,秒级
npm run build      # 输出 dist/
npm run verify     # 提交前跑这个
npm run test:e2e   # Playwright(需本机 Chrome + pip install playwright)
```

## 五、文档

- 产品与教学设计总览:`README.md`
- 评估设计、误区库、限制:[`docs/DESIGN.md`](docs/DESIGN.md)
- 测试策略与用例清单:[`TESTING.md`](TESTING.md)
- 部署:[`docs/DEPLOY.md`](docs/DEPLOY.md)
- Astro 文档:https://docs.astro.build
