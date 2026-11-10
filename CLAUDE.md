# CLAUDE.md

本仓库的协作约定统一维护在 [`AGENTS.md`](AGENTS.md),请以该文件为准:

- 四条必须遵守的硬约束(单一数据源、目标—评价对齐、错误选项诊断、数据迁移)
- 常见任务的改动动线与验证命令
- 编辑器的字体度量约定、自定义元素命名禁忌
- 合规基调:`npm run verify` 必须通过后再提交

快速开始:

```bash
npm install
npm run dev      # http://localhost:4321
npm run verify   # check + typecheck + test + build
```
