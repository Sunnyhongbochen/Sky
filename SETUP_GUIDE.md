# 网站搭建指南

## ✅ 已完成

### 第一阶段：基础结构（已完成）
- ✅ 创建网站目录结构
- ✅ 配置网站基本信息
- ✅ 创建四个栏目模板
- ✅ 写第一篇示例文章
- ✅ 编写项目说明文档
- ✅ 初始化 Git 仓库
- ✅ 提交第一版代码

### 第二阶段：Gitee 准备（已完成）
- ✅ Gitee 仓库已创建：https://gitee.com/sunny_hongbo/summer-website
- ✅ 配置文件已更新为 Gitee Pages

---

## 📋 待完成

### 第三阶段：推送代码到 Gitee
- [ ] 在本地配置 Git 凭据
- [ ] 推送代码到 Gitee

### 第四阶段：安装 Hugo 和主题
- [ ] 安装 Hugo 静态网站生成器
- [ ] 安装 PaperMod 主题
- [ ] 本地预览网站

### 第五阶段：部署到 Gitee Pages
- [ ] 生成静态文件（hugo）
- [ ] 创建 gh-pages 分支
- [ ] 推送 public 目录到 gh-pages 分支
- [ ] 在 Gitee 仓库设置中开启 Gitee Pages
- [ ] 配置访问密码（方案B）

### 第六阶段：正式发布
- [ ] 测试网站访问
- [ ] 配置自定义域名（可选）
- [ ] 正式发布！

---

## 🎯 完整操作步骤

### 步骤 1：推送代码到 Gitee

在你本地电脑上操作：

```bash
# 1. 先把 summer-website 文件夹复制到你的电脑
# 可以从服务器下载，或者直接接收我发给你的文件

# 2. 进入目录
cd summer-website

# 3. 配置远程仓库（如果还没配置）
git remote add origin https://gitee.com/sunny_hongbo/summer-website.git

# 4. 推送代码
git push -u origin master
```

### 步骤 2：安装 Hugo 和主题

```bash
# 安装 Hugo（以 macOS 为例）
brew install hugo

# 或者 Linux
sudo apt-get install hugo

# 安装 PaperMod 主题
cd summer-website
git submodule add https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod

# 本地预览
hugo server -D
# 然后访问 http://localhost:1313
```

### 步骤 3：部署到 Gitee Pages

#### 方式一：手动部署（推荐，简单直接）

```bash
# 1. 生成静态文件
hugo

# 2. 进入 public 目录
cd public

# 3. 初始化 git 并推送到 gh-pages 分支
git init
git add .
git commit -m "Deploy to Gitee Pages"
git remote add origin https://gitee.com/sunny_hongbo/summer-website.git
git checkout -b gh-pages
git push -u origin gh-pages
```

#### 方式二：使用脚本自动部署

创建一个 `deploy.sh` 脚本：

```bash
#!/bin/bash

echo "🚀 开始部署到 Gitee Pages..."

# 1. 生成静态文件
hugo

# 2. 进入 public 目录
cd public

# 3. 初始化 git
git init
git add .
git commit -m "Deploy to Gitee Pages $(date '+%Y-%m-%d %H:%M:%S')"
git remote add origin https://gitee.com/sunny_hongbo/summer-website.git

# 4. 强制推送到 gh-pages 分支
git push -f origin master:gh-pages

echo "✅ 部署完成！"
```

### 步骤 4：开启 Gitee Pages

1. 访问：https://gitee.com/sunny_hongbo/summer-website
2. 点击顶部的「服务」→「Gitee Pages」
3. 选择分支：`gh-pages`
4. 点击「启动」
5. 等待部署完成，会给你一个访问地址：`https://sunny_hongbo.gitee.io/summer-website`

### 步骤 5：配置访问控制（方案B）

因为 Gitee Pages 不支持直接密码保护，我们用 **Gitee 私有仓库 + 访问密码** 的方案：

#### 方案：静态密码保护脚本

1. 使用 `pagecrypt` 工具加密：

```bash
# 安装 pagecrypt
npm install -g pagecrypt

# 加密 index.html
pagecrypt public/index.html public/index.html 你的密码
```

2. 或者使用简单的 JavaScript 密码保护：

在 `static/` 目录下创建 `password.html`，然后在网站入口添加密码验证。

---

## 🔐 Gitee Pages 的优势

| 特性 | 说明 |
|------|------|
| 国内访问速度 | ⚡⚡⚡⚡⚡ 很快 |
| 免费额度 | ✅ 完全免费 |
| 自定义域名 | ✅ 支持 |
| HTTPS | ✅ 自动提供 |
| 自动部署 | ⚠️ 需要手动或脚本 |

---

## 💡 日常使用流程

### 写新文章

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

### 发布更新

```bash
# 1. 写好文章
# 2. 本地预览确认
hugo server -D

# 3. 生成静态文件并部署
./deploy.sh
```

---

## 🎉 总结

现在的方案：
- ✅ **代码托管**：Gitee
- ✅ **网站托管**：Gitee Pages
- ✅ **访问控制**：Gitee 私有仓库 + 密码保护

后续你只需要：
1. 在本地电脑上把代码推送到 Gitee
2. 安装 Hugo 和主题
3. 生成静态文件并推送到 gh-pages 分支
4. 在 Gitee 开启 Pages 服务

需要我把完整的文件打包发给你吗？或者需要我帮你写部署脚本？

---

**记录思考，沉淀成长** 🌸

---

*创建于 2026年04月12日*
*更新于 2026年04月13日 - 改为 Gitee Pages 方案*
