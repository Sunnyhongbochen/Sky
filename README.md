# 夏天的小站

一个记录思考、沉淀成长的个人网站。

## 🌐 网站栏目

| 栏目 | 路径 | 说明 |
|------|------|------|
| 偶得碎语 | `/posts/` | 随笔，记录一闪而过的灵感、情绪碎片与零散感悟 |
| 知学札记 | `/notes/` | 笔记，整理学习工作的干货收获，沉淀知识点 |
| 时光印记 | `/moments/` | 纪事，记录生活中的新体验，留存有温度的小确幸 |
| 工作日志 | `/worklog/` | 工作，记录每天的工作进展和成果 |

## 🛠️ 技术栈

- **静态网站生成器**：Hugo
- **托管平台**：Gitee Pages
- **主题**：PaperMod
- **访问控制**：Gitee 私有仓库 + 密码保护（方案B）

## 📁 项目结构

```
summer-website/
├── config.toml              # 网站配置文件
├── README.md                # 项目说明
├── archetypes/              # 文章模板
│   ├── posts.md            # 偶得碎语模板
│   ├── notes.md            # 知学札记模板
│   ├── moments.md          # 时光印记模板
│   └── worklog.md          # 工作日志模板
├── content/                 # 内容目录
│   ├── posts/              # 偶得碎语
│   ├── notes/              # 知学札记
│   ├── moments/            # 时光印记
│   └── worklog/            # 工作日志
├── static/                  # 静态资源
│   ├── images/             # 图片
│   └── files/              # 文件
└── themes/                  # 主题（后续安装）
```

## 🚀 快速开始

### 1. 安装 Hugo

```bash
# macOS
brew install hugo

# Linux
sudo apt-get install hugo

# 或从官网下载：https://gohugo.io/getting-started/installing/
```

### 2. 安装主题

```bash
cd summer-website
git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
```

### 3. 本地预览

```bash
hugo server -D
```

然后访问：http://localhost:1313

### 4. 生成静态文件

```bash
hugo
```

生成的文件在 `public/` 目录

### 5. 部署到 Gitee Pages

1. 创建 Gitee 仓库（设为私有）
2. 将项目推送到仓库
3. 在仓库设置中启用 Gitee Pages
4. 选择 `gh-pages` 分支作为源

## ✍️ 写文章

### 创建新文章

```bash
# 偶得碎语
hugo new posts/文章标题.md

# 知学札记
hugo new notes/文章标题.md

# 时光印记
hugo new moments/文章标题.md

# 工作日志
hugo new worklog/文章标题.md
```

### 文章模板

每个栏目都有专门的模板，包含预设的结构和提示，直接套用即可。

## 🔐 访问控制（方案B）

Public仓库 + 密码保护

实现方式：
1. 使用 Hugo 生成静态文件
2. 使用第三方工具添加密码保护
3. 推荐方案：
   - Netlify Password Protection
   - Cloudflare Access
   - 或使用静态密码保护脚本

## 📝 注意事项

- 所有文章使用 Markdown 格式
- 图片放在 `static/images/` 目录
- 附件放在 `static/files/` 目录
- 草稿设置 `draft: true`，正式发布设为 `false`

## 🎨 自定义

### 修改网站信息

编辑 `config.toml` 文件：
- `title`：网站名称
- `params.description`：网站描述
- `params.profileMode`：首页配置

### 更换主题

在 `config.toml` 中修改 `theme` 字段，然后将主题放到 `themes/` 目录。

---

**记录思考，沉淀成长** 🌸
