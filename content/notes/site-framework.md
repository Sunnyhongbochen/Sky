---
title: "夏天的小站 — 技术框架全览"
date: 2026-06-02
description: "从静态生成到自动部署，记录夏天的小站完整技术框架与实施路径"
tags: ["个人网站", "Hugo", "Cloudflare", "技术框架"]
---

## 一、访问地址

**🌐 主域名：** [https://summer-website.pages.dev](https://summer-website.pages.dev)

**特性：**
- Cloudflare 全球 CDN 加速，国内访问流畅
- 自动 SSL 证书，HTTPS 加密
- 免费无限带宽、无限请求、无限站点
- GitHub 推送代码自动触发部署

## 二、整体架构

网站采用**静态生成 + CDN 分发 + Git 驱动的自动部署**三层架构：

```
┌──────────────────────────────────────────┐
│                 用户访问                   │
│     https://summer-website.pages.dev      │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│          Cloudflare Pages CDN             │
│     全球边缘节点分发 · 自动 SSL · 缓存     │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│          GitHub Actions 自动构建           │
│   push → Setup Hugo → hugo --minify      │
│        → wrangler pages deploy           │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│            GitHub 代码仓库                │
│    Sunnyhongbochen/summer-website         │
│    Gitee 镜像：sunny_hongbo/summer-website│
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│          Hugo 静态网站生成器               │
│  Markdown 内容 → 自定义 summer 主题 → HTML │
└──────────────────────────────────────────┘
```

### 各层职责

| 层 | 技术 | 职责 |
|----|------|------|
| 内容层 | Markdown | 文章编写，纯文本，Git 版本管理 |
| 生成层 | Hugo v0.123.7 extended | 将 Markdown + 主题模板编译为静态 HTML/CSS |
| 主题层 | 自定义 `summer` 主题 | 青蓝配色、单页五模块卡片、响应式布局 |
| 代码层 | GitHub + Gitee 双推 | 版本控制 + 协作 + 备份 |
| 构建层 | GitHub Actions | push 触发自动编译部署 |
| 分发层 | Cloudflare Pages | 全球 CDN，免费无限流量 |

## 三、技术路线

### 3.1 选型理由

| 维度 | 选择 | 为什么 |
|------|------|--------|
| 静态生成器 | **Hugo** | Go 语言编写，毫秒级编译，单二进制文件，零依赖 |
| 托管平台 | **Cloudflare Pages** | 免费无限带宽/请求，国内可访问，自动 SSL |
| 主题 | **自定义开发** | 放弃 PaperMod，从零手写，完全可控 |
| 自动部署 | **GitHub Actions + wrangler** | push 即部署，无需手动操作 |
| 代码托管 | **GitHub 主 + Gitee 备** | 双保险，国内访问备用 |

### 3.2 对比：旧方案 vs 新方案

| 维度 | 旧方案 | 新方案 |
|------|--------|--------|
| 托管 | Netlify（100GB 流量限制）| Cloudflare Pages（**无限**）|
| 主题 | PaperMod（暗色，臃肿）| 自定义 summer（青蓝，轻量）|
| 部署 | 手动 wrangler 上传 | GitHub Actions **自动触发** |
| 配色 | 灰暗单调 | 青蓝系，清新明快 |
| 布局 | 传统博客列表 | 单页五模块卡片，一目了然 |
| 域名 | summer-website-599.netlify.app | summer-website.pages.dev |

## 四、技术路线的实现

### 4.1 Hugo 自定义主题开发

从零搭建 `themes/summer/` 目录，核心文件结构：

```
themes/summer/
├── theme.toml                     # 主题元数据
├── assets/css/style.css           # 样式（CSS 变量 + 响应式网格）
└── layouts/
    ├── _default/
    │   ├── baseof.html            # HTML 骨架
    │   ├── home.html              # 首页（模块卡片 + 最新文章）
    │   ├── list.html              # 分区列表页
    │   └── single.html            # 文章详情页
    └── partials/
        ├── head.html              # <head> 元数据
        ├── header.html            # Hero 头图
        └── footer.html            # 页脚
```

**配色方案（青蓝系）：**

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 | `#2B8CBE` | 青蓝色，标题/链接/强调 |
| 辅色 | `#5BB5D6` | 浅青色，hover/高亮 |
| 背景 | `#F5F9FC` | 淡青白底 |
| 卡片 | `#FFFFFF` | 纯白 + `box-shadow` 投影 |
| 文字 | `#2C3E50` | 深蓝灰，比纯黑柔和 |

**布局方案：**
- Hero 头图（青蓝渐变背景 + 站名/副标题）
- 五模块导航卡片横排（偶得碎语 / 知学札记 / 时光印记 / AI成长 / 链接）
- 最新文章列表（取最近 6 篇）
- Footer 页脚
- 响应式：桌面 5 列 → 平板 3 列 → 手机 2 列

**字体策略：** 系统字体栈，不加载外部字体文件，零额外请求，确保国内访问速度。

### 4.2 Cloudflare Pages 部署配置

通过 Cloudflare API 完成项目创建和构建配置：

- **项目名：** summer-website
- **生产分支：** master
- **构建命令：** `hugo`
- **输出目录：** `public`
- **环境变量：** `HUGO_VERSION = 0.145.0`

### 4.3 GitHub Actions 自动部署流水线

`.github/workflows/deploy.yml` 实现 push 自动部署：

```yaml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [master]
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4    # 拉代码
      - uses: peaceiris/actions-hugo@v3  # 安装 Hugo
      - run: hugo --minify           # 构建
      - uses: cloudflare/wrangler-action@v3  # 部署到 Cloudflare
```

**Secret 配置：** `CLOUDFLARE_API_TOKEN` 通过 GitHub API 加密写入仓库 Secrets，保障安全。

### 4.4 内容管理

所有文章以 Markdown 格式存放在 `content/` 目录：

```
content/
├── posts/      → 「偶得碎语」随笔灵感
├── notes/      → 「知学札记」学习笔记
├── moments/    → 「时光印记」生活纪事
└── ai-growth/  → 「AI成长」学习记录
```

每篇文章包含 Front Matter 元数据（标题、日期、描述、标签），Hugo 自动生成页面和索引。

### 4.5 发布流程

**最简单的发布流程：**
1. 在 `content/` 对应目录写好 Markdown 文章
2. `git add → commit → push` 推送到 GitHub
3. GitHub Actions 自动触发：Hugo 构建 → wrangler 部署
4. 几分钟后 Cloudflare Pages CDN 全球生效

全程**不需要手动构建、不需要登录服务器、不需要操作 Cloudflare 后台**。

---

## 总结

夏天的小站从 Netlify + PaperMod 迁移到 Cloudflare Pages + 自定义 summer 主题后：

- **零成本托管**，告别 100GB 流量焦虑
- **自定义青蓝主题**，告别灰暗丑
- **Git 驱动全自动部署**，告别手动上传
- **GitHub + Gitee 双备份**，数据安全
- **3 篇 AI 知识文章上线**，开始内容积累

下一步：持续输出内容，让夏天的小站真正"活"起来 🌸
