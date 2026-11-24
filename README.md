# 夏天的小站

个人网站：记录思考，沉淀成长。
线上地址：<https://summer-website.pages.dev/>

## 栏目

| 栏目 | 路径 | 内容 |
|------|------|------|
| 偶得碎语 | `/posts/` | 随笔、灵感、碎片 |
| 知学札记 | `/notes/` | 学习笔记、干货沉淀 |
| 时光印记 | `/moments/` | 生活纪事、小确幸 |
| AI 成长 | `/ai-growth/` | 技术应用、资讯情报、工作日志 |
| 链接 | `/links/` | 友链、作品、GIS地图 |

导航与首页卡片共用 `config.toml` 里的 `[[menu.main]]`，新增栏目改一处即可。

## 技术栈

- **生成器**：Hugo（0.166.0，extended）
- **托管**：Cloudflare Pages（`public/` 静态资源 + `functions/` 中间件）
- **主题**：`themes/summer`（自研，青蓝配色，支持暗色模式）
- **访问控制**：Cloudflare Pages Functions 密码中间件（`functions/_middleware.js`）
- **子应用**：`huiji/`（会记，Flutter Web，挂载到 `/huiji/`）、`city-platform/`、`voice-knowledge-hub-deploy/`（本地演示）

## 目录结构

```
summer-website/
├── config.toml                 站点配置（语言、菜单、分页、模块挂载）
├── content/                    文章（posts / notes / moments / ai-growth / links）
├── data/links.yaml             友链、作品、GIS地图数据
├── themes/summer/
│   ├── assets/css/style.css    全部样式
│   └── layouts/                模板（_default / links / partials / 404 / robots / RSS）
├── static/                     favicon、og 图、login.html、GIS 专题地图页面
├── functions/_middleware.js    访问密码中间件
├── huiji/                      会记 Flutter Web 构建产物（挂载到 /huiji/）
├── .github/workflows/deploy.yml GitHub Actions 自动部署
├── tests/                      中间件回归测试
└── start.bat                   一键启动本地三个服务
```

## 本地开发

```bash
# 预览（含草稿）
hugo server -D --port 1313

# 完整构建（与线上一致）
hugo --minify --gc
```

Windows 双击 `start.bat` 可同时启动：站点 `:1313`、城市部件平台 `:3000`、音译 `:4173`。

## 写文章

```bash
hugo new posts/2026-11-20-标题.md
hugo new notes/2026-11-20-标题.md
hugo new moments/2026-11-20-标题.md
```

发布前把 front matter 里的 `draft` 改成 `false`。

## 部署

推送到 `master` 后由 `.github/workflows/deploy.yml` 自动构建并发布到 Cloudflare Pages。

需要的仓库 Secret：

| 名称 | 用途 |
|------|------|
| `CLOUDFLARE_API_TOKEN` | 具备 Pages 编辑权限的 API Token |

## 访问密码

线上整站受 `functions/_middleware.js` 保护，流程：未登录 → 302 到 `/login` → `POST /api/login` 校验 → 写入 `HttpOnly + Secure` 的 `site_auth` Cookie（值为 SHA-256 摘要，不含密码原文，有效期 7 天）。`/api/logout` 退出。

**修改密码（推荐做法）**

在 Cloudflare Pages → Settings → Environment variables 添加 `SITE_PASSWORD`，重新部署即生效（优先级高于代码里的回退值）。

**回归测试**

```bash
node tests/middleware-auth.test.mjs   # 24 项断言，覆盖跳转、放行、Cookie、开放跳转防护
```

> 注意：`huiji/*.apk` 体积 150MB，已被 `.gitignore` 和 Hugo `excludeFiles` 排除，不会进入仓库与线上产物。

## 主题改造要点

- `head.html`：canonical、OG/Twitter、JSON-LD、favicon、RSS
- `single.html`：目录（长文自动出现）、阅读时长、字数、更新时间、上下篇
- `list.html`：分区页聚合子栏目最新 5 篇，子栏目页做真分页
- `links/list.html`：读 `data/links.yaml`，`localhost` 链接自动打「本地演示」标
- `_markup/`：图片自动懒加载 + 图注，外链自动 `target=_blank rel=noopener`
- `style.css`：AA 对比度、暗色模式、移动端导航横向滑动、打印样式
