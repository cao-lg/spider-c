# 教师学情数据：三个阶段的使用与部署

> 适用场景：学生均为成年人（18 岁以上）、2 个班约 120 人。
> 三个阶段可以**只用阶段 0**，也可以逐级开通；后一阶段都不改变前一阶段的数据格式。

---

## 0. 先说结论

| 阶段 | 教师怎么拿数据 | 要不要开云 | 代码位置 |
| --- | --- | --- | --- |
| **0 · 离线汇总** | 收学生导出的 JSON，多选后浏览器内出报告 | 不需要，零账号零费用 | `src/pages/teacher.astro`、`src/lib/class-report.ts` |
| **1 · 在线看板** | 教师填口令直接拉全班，学生换设备自动恢复 | D1 + Pages Functions | `functions/api/`、`schema.sql` |
| **2 · 周快照归档** | 一键或定时把聚合报告存进 R2，可回看 | R2（仅归档） | `functions/api/archive.ts`、`scripts/archive-weekly.ts` |

**R2 不是主库，浏览器也不能直连 R2。** 静态站的前端代码是公开的，把对象存储密钥放进去等于公开发布；
且 R2 没有查询与事务，每生一个 JSON 整包覆盖写，同一学生两台设备同步必然互相覆盖丢记录。
所以主数据在 D1，R2 只放「某一周的班级报告长什么样」。

三个阶段**共用同一套报告引擎** `src/lib/class-report.ts`：离线文件、D1 快照、定时归档算出来的数字口径完全一致，
不会出现「教师当天看到的」和「归档里存的」对不上。

---

## 1. 阶段 0：离线汇总（今天就能用，无需任何配置）

1. 打开 `/teacher/`（主导航最后一项「学情报告」），保持默认的「阶段 0 · 离线汇总」标签。
2. 学生在「学习中心 → 数据管理 → 导出备份(JSON)」生成文件，交给教师。
3. 教师点「选择备份文件(可多选)」，一次选完全班。
4. 在「核对学号与班级」表里补齐匿名学号与班级（如 `S01` / `1班`），改动立即重算报告。
5. 用班级下拉切换「全部 / 1班 / 2班」，导出三张 CSV 或「打印 / 存 PDF」。

细节约定：

- **身份推断顺序**：备份内 `roster` → 昵称里的 `班级/学号` → 文件名。开启过阶段 1 的学生，导出文件会自带 `roster`，教师不用再手填。
- **同一学号的多份备份自动合并**（按 `ts` 去重、错题不复活），报告里的「学生数」是去重后的**人数**，不是文件数。
- **坏文件不会污染报告**：非 JSON、结构不认识、空备份分别给出原因并跳过。
- **全程零网络请求**：文件只在浏览器里用 `File.text()` 读取，`/teacher/` 还带 `noindex`，不进 sitemap。
- 想先试效果：点「载入示例班级」生成 10 人 / 2 班的合成数据，只在内存里，刷新即消失。

报告的四层内容（都不是排行榜）：

1. **目标达成矩阵**：44 条可观测目标 × 达成率，标红 <60%，回链到课与 `anchor`。
   - 直接证据 = 新版备份的逐题作答明细；
   - 间接证据 = 旧备份只有卷面总分时的推断，或该目标由**代码实战**评价（44 个里有 17 个没有概念题），以实操是否通过为准；
   - 无数据 = 检测与实战都没做过，**绝不按「没错题」算成达成**。
2. **共性误区热力图**：28 个标签按「命中人数」去重聚合，附累计错误次数、已消除人数、关联课程。
3. **进度与掌握度分布**：13 课完成率、5 个技能维度、掉队清单（只显示匿名学号）。
4. **教学决策建议**：重讲哪一段、下节课加哪道辨析题、怎么按误区分组补救，每条都有可点击入口。

---

## 2. 阶段 1：D1 + Pages Functions

### 2.1 在网页上开通（Cloudflare 控制台）

> 前提：Pages 项目 `spider-c` **必须是 Git 集成**（连 `cao-lg/spider-c` 的 `main`），Node ≥ 22.12。
> 绑定名必须是 `DB`，变量名必须是 `TEACHER_TOKEN` / `SYNC_SALT`，大小写不能改。

**两个前置检查**（不做会白忙）：

1. Cloudflare 官方明确 **Direct Upload（控制台拖拽 `dist` 上传）不支持 Functions**。
   若现有项目是拖拽建的，新建 `Create application → Pages → Connect to Git`，
   构建设置 `npm run build` / 输出目录 `dist` / 生产分支 `main`。
2. 删掉仓库 `wrangler.toml` 里的 `pages_build_output_dir = "dist"` 这一行。
   该字段会让 Wrangler 文件随 Git 部署后成为项目配置的唯一来源，控制台绑定会被覆盖且不可编辑，
   而文件里的 `database_id` 是占位符、`ARCHIVE` 桶尚未创建 → 阶段 1 直接失效。

然后按顺序在控制台操作：

| # | 位置 | 操作 |
| --- | --- | --- |
| ① | Workers & Pages → **D1 SQL Database** → Create database | 名称 `spider-c-learning`，Location hint 留默认 |
| ② | 进入该库 → **Console** | 粘贴 `schema.sql` **全文** → Execute。文件里没有行内 `--` 注释，粘贴时换行被压平也不会出错。验证：`SELECT name FROM sqlite_master WHERE type='table';` 应返回 4 张表 |
| ③ | Pages 项目 → **Settings → Bindings → Add → D1 database bindings** | Variable name 填 `DB`，选 `spider-c-learning` → Save；Production / Preview 各设一次 |
| ④ | Pages 项目 → **Settings → Variables and Secrets → Add** | `TEACHER_TOKEN`（≥8 位，教师保管，不要发给学生）、`SYNC_SALT`（随机长串），两条都要勾 **Encrypt** → Save；Production / Preview 各设一次，保存后不可再查看 |
| ⑤ | Settings → Builds & deployments / Functions | 确认 `npm run build` / `dist` / 根目录 `/`；Compatibility date 填 `2026-11-10`。v3 构建镜像默认 Node 22.23.4，已满足要求 |
| ⑥ | **Deployments → Retry / Create new deployment** | 顺序：先绑定 + Secret，再重新部署。官方明确 D1 绑定需 redeploy 才生效、Secret 需在使用它的部署之前设好 |

命令行等价做法（可选，网页上做完就不必执行）：

```bash
npx wrangler d1 create spider-c-learning
npx wrangler d1 execute spider-c-learning --remote --file=./schema.sql
npx wrangler pages secret put TEACHER_TOKEN
npx wrangler pages secret put SYNC_SALT
```

项目根目录的 `functions/` 会被自动识别成 `/api/*` 路由；Astro 静态构建不需要任何改动，`dist/` 仍是 36 个静态页。

### 2.2 验证后端已就位

```bash
curl https://spider-c.pages.dev/api/health
# {"ok":true,"service":"spider-c-functions","phase":"1+2"}
```

返回 404 说明 Functions 没被识别（检查部署日志里是否有 `functions/`）；返回 401 说明口令不对。

### 2.3 学生端与教师端

- **学生**：「学习中心 → 云同步」填匿名学号、班级、教师分发的**班级同步口令** → 「启用 / 登录」。启用时自动上传一次；之后换设备用同一学号 + 口令登录，点「从云端恢复」即可取回。口令不存本机，服务端只存 `SHA-256(SYNC_SALT + ':' + 口令)`。
  ⚠️ 三个口令不要混：`TEACHER_TOKEN`（≥8 位，教师看板专用，**绝不发给学生**）、`SYNC_SALT`（只存服务端）、班级同步口令（≥6 位，课堂上统一发布；`/api/enroll` 只校验长度与「同学号重登时一致」）。
- **教师**：`/teacher/` → 「阶段 1/2 · 云端看板」→ 填 `TEACHER_TOKEN` → 「拉取班级数据」。
- **删除权**：学生可点「删除云端数据」清除自己的快照、会话与注册记录；教师可用 `DELETE /api/student?id=<学号>` 按学校要求清理。本机数据不受影响。

### 2.4 接口一览

| 方法 | 路径 | 鉴权 | 作用 |
| --- | --- | --- | --- |
| GET | `/api/health` | 无 | 存活探针 |
| POST | `/api/enroll` | 无（校验同步口令） | 注册 / 换设备登录，签发 180 天令牌 |
| GET/POST/DELETE | `/api/sync` | 学生令牌 | 拉取 / 上报 / 删除自己的快照 |
| GET | `/api/overview` | 教师口令 | 班级列表、人数、最后同步时间 |
| GET | `/api/class?classId=` | 教师口令 | 全班快照（教师端在浏览器内聚合） |
| DELETE | `/api/student?id=` | 教师口令 | 删除指定学号 |
| GET/POST | `/api/archive` | 教师口令 | 阶段 2 归档 |

### 2.5 关键实现约定

- **服务端合并**：`POST /api/sync` 先读已有快照，用与 `store.importJSON`、教师离线汇总**同一个** `mergeLearningData()` 合并后 UPSERT。这是「两台设备不丢记录」的保证，单测 `tests/unit/functions.test.ts` 专门验证。
- **名册以服务端为准**：客户端上报的 `roster` 会被覆盖，不能冒用别人学号。
- **最小必要字段**：只收匿名学号、班级代号、`LearningData` 快照；学号正则 `^[A-Za-z0-9_-]{2,24}$`，填真实姓名会被拒。单次请求上限 256 KB。
- **会话令牌**只以哈希存 D1，180 天过期；教师口令用常量时间比较，未配置时一律拒绝。

---

## 3. 阶段 2：R2 周快照归档

### 3.1 开通

> ⚠️ Cloudflare 开通 R2 通常需要先在控制台绑定付款方式（信用卡），**即使只用免费额度**。
> 这与 Workers、Pages 不同，是这一步最常见的卡点。

```bash
npx wrangler r2 bucket create spider-c-archive
```

在 Pages → Settings → Functions → R2 bucket bindings 添加：`ARCHIVE` → `spider-c-archive`。
未绑定时 `/api/archive` 返回 503 并给出提示，**阶段 0/1 完全不受影响**。

### 3.2 两种归档方式

**手动**：教师端「云端看板 → 归档本周报告」。归档内容 = 聚合快照 JSON + 目标达成 CSV，键名形如
`snapshots/2026-W46/1班/<时间戳>.json`；索引写进 D1 的 `archives` 表，列归档时不消耗 R2 的 A 类操作。

**定时**（推荐）：`scripts/archive-weekly.ts` 会拉全部班级 → 复用 `class-report.ts` 生成报告 → 归档「全量 + 每班」各一份。

```bash
SITE_URL=https://spider-c.pages.dev TEACHER_TOKEN=<口令> npm run archive:weekly
```

GitHub Actions 每周一跑的示例（放进 `.github/workflows/archive.yml`，注意工作流文件需要 token 带 `workflow` 权限才能推送）：

```yaml
name: weekly-class-archive
on:
  schedule:
    - cron: '0 2 * * 1'   # UTC 周一 02:00 = 北京时间周一 10:00
  workflow_dispatch:
jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run archive:weekly
        env:
          SITE_URL: https://spider-c.pages.dev
          TEACHER_TOKEN: ${{ secrets.TEACHER_TOKEN }}
```

> 仓库里的 `.github/workflows/ci.yml` 目前因令牌缺 `Workflows: Read and write` 未能推送；
> 新建归档工作流时请一并补上该权限，否则会出现 `refusing to allow a Personal Access Token to create or update workflow`。

**归档里没有什么**：不含原始作答文本、不含昵称、不含 `answers` 明细，只有聚合结果与匿名学号指标
（见 `archivePayload()`）。这是刻意设计——长期留存不该留学生的逐题轨迹。

---

## 4. 合规与运维（18 岁以上仍要做）

| 事项 | 做法 |
| --- | --- |
| 告知与同意 | 首次启用云同步前，明确告知采集内容、用途、保留期限、删除方式；页面已写明，建议课堂上再口头说明一次 |
| 最小必要 | 只用匿名学号，不收姓名/手机号/邮箱；学号格式在服务端强制校验 |
| 删除通道 | 学生端「删除云端数据」；教师端 `DELETE /api/student`；归档建议在学期结束后统一清理 |
| 保留期限 | 会话 180 天；D1 快照与 R2 归档建议按学校规定设定期限，脚本里可加清理步骤 |
| 数据出境 | Cloudflare 存储可能涉及数据出境，是否适用、需要什么手续请交学校信息化/法务确认，不要凭技术方案自行判定 |
| 课堂可用性 | 国内访问 Cloudflare 的稳定性请在实际教室网络里实测；阶段 0 离线汇总不依赖网络，可作为兜底 |
| 口令管理 | `TEACHER_TOKEN` / `SYNC_SALT` 只放服务端 secret；轮换 `SYNC_SALT` 会使所有已签发会话失效，需通知学生重新登录 |

**别把报告做成排行榜**：学生明细只出现匿名学号与跟进状态；目标达成率用于决定「重讲哪一段」，
不用于给学生打分或排名。证据不足的目标显示「无数据」而不是 0 分。

---

## 5. 免费额度与容量估算（2026-11 核对，以官方文档为准）

| 产品 | 免费额度 | 120 人用量估计 |
| --- | --- | --- |
| Workers / Pages Functions | 10 万请求/天 | 每生每天几次同步，几百到几千次 |
| D1 | 5 GB 总、500 万行读/天、10 万行写/天 | 120 份快照 × 数十 KB ≈ 几 MB；每天几百次写 |
| R2 | 10 GB·月存储、A 类 100 万次/月、B 类 1000 万次/月、出站免费 | 每周 3 份报告，一年 < 1 MB |

结论：**容量和费用完全不是约束**，约束在鉴权、隐私告知与国内访问稳定性上。

---

## 6. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 教师端提示 `/api/* 返回静态 404 页面` | Pages 没识别 `functions/`，或还没重新部署 | 检查部署日志；`functions/` 必须在项目根、路由文件用 `onRequestGet/Post` 导出 |
| 教师端 401 | `TEACHER_TOKEN` 不一致 / 少于 8 位 / 未配置 | 重新 `wrangler pages secret put`，注意 secret 更新后需重新部署 |
| 学生「启用失败：网络不可达」 | 教室网络访问不通 | 先用阶段 0 离线汇总；换网络后重试 |
| 归档 503 | 未绑定 `ARCHIVE` | 绑定 R2 后重试；不影响阶段 1 |
| 报告里大量「无数据」 | 学生用的是旧版备份（没有逐题明细），且没做过该课实操 | 属正常且诚实的结果；让学生重新做一次课内检测即可补上直接证据 |
| 学生看不到云同步卡片 | 页面还是旧构建 | 重新 `npm run build` 并部署，卡片在「学习中心」末尾 |
| 两设备同步后记录变少 | 不该发生；说明有人绕过了 `/api/sync` 直接改库 | 检查 `snapshots.revision` 是否递增；服务端合并逻辑见 `backend.ts` |
| D1 Console 执行 `schema.sql` 报 `incomplete input: SQLITE_ERROR` | 旧版 SQL 的行内 `--` 中文注释吞掉了闭合括号：粘贴时换行被压平，`--` 会注释掉它后面的一切 | 用仓库里已去掉行内注释的新版 `schema.sql` 全文重粘；或按分号逐条执行。已用 SQLite 验证「正常 / 压平」两种输入都能建成 4 表 3 索引 |

---

## 7. 相关文件

```
src/lib/class-report.ts          报告引擎(三阶段共用,纯函数)
src/lib/merge.ts                 合并规则(本机 / 教师端 / Workers 共用)
src/lib/demo-data.ts             示例班级(仅内存)
src/pages/teacher.astro          教师端页面
src/components/teacher-client.ts 教师端交互(离线 + 在线 + 归档)
src/components/sync-client.ts    学生端云同步
functions/_shared/backend.ts     存储接口 / D1 实现 / 业务逻辑
functions/_shared/http.ts        HTTP 薄层
functions/api/*.ts               7 个路由
schema.sql                       D1 表结构
wrangler.toml                    本地联调绑定示例
scripts/archive-weekly.ts        定时归档脚本
tests/unit/class-report.test.ts  报告引擎单测
tests/unit/functions.test.ts     后端全链路单测(内存 D1/R2)
tests/e2e/e2e_teacher.py         教师端 + 降级 E2E
```
