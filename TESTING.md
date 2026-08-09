# 爬虫学堂 · 测试计划

本文档描述「爬虫学堂」网站的测试策略、用例清单与执行方式,配套自动化脚本位于
[`tests/e2e/`](../tests/e2e/)。目标是覆盖从构建到交互到数据持久化的完整链路。

## 1. 范围与目标

验证以下核心能力可正常工作、可回归:

- 静态站点构建与全部页面的可访问性
- 站点导航与课程/靶站/测试/学习中心页面结构
- 浏览器运行器(Pyodide + BeautifulSoup/lxml/requests)离线可用
- 课程实操题:运行→判定→加分→自动标记课程完成
- 单元测试实操题:补全代码→判定→记录到 `unitTest`
- 学习中心:统计、进度、雷达图、趋势图、最近动态
- 数据管理:导出 / 合并导入(按时间戳去重)/ 覆盖导入 / 重置
- 靶站(Level 1~5)与 robots.txt 数据一致性
- 全站无 JS 运行时错误

## 2. 环境与工具

| 项 | 值 |
| --- | --- |
| 运行时 | Node ≥ 22.12,Python ≥ 3.10 |
| 构建 | `npm run build`(astro build,静态输出到 `dist/`) |
| 预览 | `npm run preview -- --port 4321`(静态产物) |
| E2E | Playwright(Python)+ 本地 Chrome headless |
| Pyodide 离线冒烟 | `scripts/pyodide-smoke.mjs`(验证自托管 wheel 可加载) |

执行:`python tests/e2e/run_all.py`(内部自动:build → preview → 各用例 → 汇总)。

## 3. 测试分层

| 层 | 说明 | 脚本 |
| --- | --- | --- |
| L1 构建/静态 | 构建成功、页面数、关键路由 200 | `e2e_site.py` |
| L2 结构与导航 | 标题、导航高亮、链接完整、无死链(站内) | `e2e_site.py` |
| L5 靶站结构 | Level1~5 关键数据断言、robots.txt | `e2e_site.py` |
| L3 运行器 | CodeRunner 演示可运行、SITE_BASE 注入 | `e2e_lessons.py` |
| L3 课程实操 | 13 门课实操题全部判 PASS 并完成课程 | `e2e_lessons.py` |
| L3 单元测实操 | 5 个单元 15 道实操题填答案后判 PASS | `e2e_unittests.py` |
| L3 学习中心 | 统计/进度/图表/最近动态 | `e2e_report.py` |
| L4 数据管理 | 导出/合并导入/覆盖导入/重置/昵称 | `e2e_report.py` |
| L4 数据层 | 记录结构、掌握度归因、防误标 | `e2e_unittests.py` |

## 4. 用例清单

### L1 · 构建与静态
- T-001 构建成功,输出 22 个页面,无 ERROR。
- T-002 `/` `/tutorials/` `/practice/` `/report/` 返回 200 且标题含站点名。
- T-003 每门课 `/tutorials/<slug>/` 返回 200,含本课目标 callout。
- T-004 每个单元 `/tests/<unitId>/` 返回 200,含 3 道实操题。

### L2 · 结构导航
- T-005 首页导航 4 项存在;访问 `/report/` 时「学习中心」高亮。
- T-006 首页统计数字为课程 13 / 时长(分钟)合计。
- T-007 课程目录页列出 5 个单元、13 门课。
- T-008 靶站索引页列出 Level 1~5 卡片与「打开靶站」链接。
- T-009 单元测页顶部说明实操题数、满分,并给出 SITE_BASE 提示。

### L3 · 运行器与实操题
- T-010 `/practice/` 就地运行器运行通过,打印状态码 200 与 24 本书。
- T-011 课程实操题(13 门)逐门点击运行,全部 `pass`,得分与 maxScore 一致。
- T-012 课程实操题通过后,该课在 localStorage 中 `status == "completed"`。
- T-012b 13 门实操满分合计 145(5 + 10×9 + 15×2 + 20)。
- T-013 单元测实操题(15 道)填入答案后运行全部 `pass`。
- T-014 单元测作答只记录 `unitTests[unit-test-N-tX]`,不把课程标记为完成。
- T-015 课程页不再渲染理论 Quiz(0 个 `py-quiz`)。

### L4 · 数据与持久化
- T-016 学习记录含 `lessons/exercises/practice/unitTests` 四张表,`schemaVersion=1`。
- T-017 掌握度归因:课程页答题后该课 `mastery > 0`。
- T-018 导出文件为合法 JSON 且不含内部 `pendingLesson` 字段。
- T-019 清空数据后各表为空;覆盖导入恢复数据。
- T-020 合并导入按 `ts` 去重:同 ts 不重复,新记录保留。
- T-021 昵称保存后出现在 localStorage `profile.name`。

### L5 · 靶站一致性
- T-022 Level1 表格 24 行、7 列,价格列含 `¥`。
- T-023 Level2 共 10 页 × 10 行 = 100 本,书名唯一。
- T-024 Level3 列表 20 条详情链接,详情页含 `h2` 与 `td.price`。
- T-025 Level4 JSON `data.total == 200`,`totalPages == 10`。
- T-026 Level5 源码不含书籍数据,`api/books.json` 返回 56 本。
- T-027 `/robots.txt` 允许 `/practice/`、禁止 `/private/`。

### L6 · 学习中心
- T-028 无数据时显示空态提示,不崩溃。
- T-029 有数据时统计数字正确(课程完成/作答次数/平均得分率/单元测最佳)。
- T-030 单元进度条宽度 = 完成课数 / 总课数。
- T-031 雷达图与趋势图渲染出 SVG polygon / polyline。
- T-032 最近动态标题正确解析(课程实战 / 单元测实操#N)。
- T-033 全站各页面无 `pageerror`。

### L7 · 刻意练习机制(M5)
- T-036 课程实操 starter 必须含 `# TODO` 占位符(数据层强制)。
- T-037 `<py-runner variant="challenge">` 代码默认折叠(`details` 未展开)。
- T-037b 未展开代码时点击运行被拦截,提示先展开。
- T-038 直接运行未完成的 starter 不应 PASS(刻意练习屏障)。
- T-039 PASS 后展示「解题思路」(explanation 默认可见)。

### L8 · 课程综合测试(M5)
- T-040 索引页列出 10 套综合测试入口。
- T-041 每套 3 道实践题(列表解析/字段提取/JSON 直连)注入答案后全部 PASS。
- T-042 10 套 × 3 题共 30 个 courseTest 记录写入 `unitTests`。
- T-043 30 个靶站资源(列表/JSON/详情)HTTP 200。
- T-013 单元综合测试扩充为每单元 5 题(共 25 道)。

### L9 · 测试用例式判定 + 题干区外(M6)
- T-044 完整题干显示在代码区外(`.ce-question`),代码区只留 starter/TODO。
- T-045 伪造数据(如 `rows=[None]*24`)无法通过——判分时独立重新抓取靶站,
  将学生变量与真实数据逐项比对(类型、数量、内容),杜绝"数行数蒙混"。
- 68 道题(13 课程实操 + 25 单元测 + 30 综合测)全部升级为测试用例式判定;
  弱数量断言(len==N)替换为"重新请求靶站解析真实数据逐项比对"。

## 5. 已知说明

- 浏览器运行器每次整页刷新都会重建 Pyodide worker(首载约 5~10 秒),脚本对每个首次运行等待至多 150 秒。
- 学习数据存于 `localStorage["crawler-course:v1"]`,E2E 用全新浏览器上下文隔离。
- 靶站为静态生成的教学假数据,数据量断言依赖生成脚本,若调整数据规模需同步更新 T-022~T-026。
- `pyodide-smoke.mjs` 在 Node 中 requests 网络段需要 `--experimental-wasm-stack-switching`(Node<24)
  或 `runPythonAsync` 配合,属 Node 环境限制;浏览器内 requests 由 E2E T-010 已验证正常,
  smoke 的核心目的(自托管 wheel 可加载、bs4/lxml 可用)不受影响。

## 6. 快速迭代流程

1. `npm run build`(L1 门槛)
2. `python tests/e2e/run_all.py`(L1~L6 全量)
3. 失败用例:先看脚本定位的 `pageerror`/状态文本,修复后重跑对应单文件
4. 全绿后收尾
