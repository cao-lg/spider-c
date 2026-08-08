# 部署指南:Cloudflare Pages(GitHub 集成)

## 1. 推送代码到 GitHub

在 [github.com](https://github.com) 新建一个空仓库(例如 `spider-c`,不要勾选生成 README),然后在本机执行:

```bash
cd C:\crawler-course
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> 首次推送若提示登录,在浏览器完成 GitHub 授权即可。

## 2. 在 Cloudflare 面板接入

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com),登录免费账号
2. 左侧菜单 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 授权 Cloudflare 访问你的 GitHub 仓库,选择刚推送的仓库
4. 构建配置:
   - **Production branch**: `main`
   - **Framework preset**: `Astro`(自动识别)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. **Save and Deploy**

约 1 分钟后部署完成,访问 `https://spider-c.pages.dev`。

## 3. 后续自动部署

此后每次 `git push origin main`,Cloudflare 都会自动重新构建部署;
推送其他分支会生成独立的预览部署 URL,可用于提前验证。

## 4. 自定义域名(可选)

Pages 项目 → **Custom domains** → 添加你自己的域名,按提示在域名服务商处添加 CNAME 解析到 `spider-c.pages.dev`,自动签发免费 HTTPS 证书。

## 5. 常见问题

| 问题 | 处理 |
|------|------|
| 构建失败 Node 版本 | 在项目 **Settings → Environment variables** 添加 `NODE_VERSION=22` 或提交 `.nvmrc` |
| 本地可跑但线上 404 | 确认 Build output directory 为 `dist`,且 `astro.config.mjs` 中 `output: 'static'` |
| 需要清缓存强刷 | 浏览器硬刷新,或在面板 Deployment 右上角点 `Clear cache` 后重新部署 |
