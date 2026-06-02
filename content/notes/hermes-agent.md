---
title: "Hermes Agent 核心知识提炼：自我进化的 AI Agent"
date: 2026-06-02
description: "从 Nous Research 打造的 Hermes Agent 深度学习笔记：架构、技能自我进化、与 OpenClaw 对比、实战要领"
tags: ["AI Agent", "Hermes", "自我进化"]
---

## 一、Hermes Agent 是什么？

Hermes Agent 由 **Nous Research**（Hermes / Nomos / Psyche 模型背后的实验室）打造，是一个**会自我进化的 AI Agent**。它运行时间越长，能力越强。

核心定位：**Agent-first 架构**——以单个 Python Agent 为中心，向外扩展消息网关、ACP、MCP、Cron、Skills 等能力。

与 OpenClaw 的定位差异：Hermes 更像"自进化工作型 Agent"，OpenClaw 更像"本地 AI 操作系统 / Control Plane"。

## 二、五大核心特性

### 1. 闭合学习闭环（最核心的优势）

这是 Hermes 与所有其他 Agent 最本质的区别：

- **自主创建 Skill**：复杂任务成功后、踩坑后、修正后，自动沉淀为 Skill
- **自我完善**：发现 Skill 过时或有问题，主动 patch 修正
- **周期性记忆持久化**：主动提示知识固化，防止遗忘
- **跨 Session 检索**：基于 SQLite FTS5 检索历史，结合 LLM 总结
- **辩证式用户建模**：基于 Honcho 构建对你的深度理解

用一句话概括就是：Hermes 把 Skill 视为"程序性记忆"（procedural memory），Agent 有正式运行时接口去创建、编辑、补丁自己的技能。

### 2. 随处运行，不依赖本地电脑

6 种终端后端：本地、Docker、SSH、Daytona、Singularity、Modal。其中 Daytona 和 Modal 提供**无服务器持久化**——环境闲置时自动休眠，几乎零成本。

### 3. 跨平台消息网关

内置支持 15+ 个平台：CLI、Telegram、Discord、Slack、WhatsApp、Signal、Matrix、Mattermost、Email、SMS、钉钉、飞书、企业微信、BlueBubbles、Home Assistant。

### 4. 委托与并行

通过 `delegate_task` 派生隔离的子 Agent 执行并行工作流，`execute_code` 实现编程式工具调用，将多步骤 pipeline 压缩为单次推理调用。

### 5. 完整的 Web 控制 + MCP 支持

搜索、提取、浏览、视觉识别、图像生成、TTS、MCP 服务器连接，全部内置。

## 三、Hermes vs OpenClaw 核心差异速查

| 维度 | Hermes Agent | OpenClaw |
|------|-------------|----------|
| **语言** | Python | TypeScript |
| **定位** | Agent-first，自进化工作型 | Control-plane-first，本地 AI 操作系统 |
| **架构复杂度** | 中等，主干清晰，容易通读 | 高，层次多，子系统多 |
| **核心优势** | **Skill 自我进化**（创建/编辑/补丁） | 平台化（多 Agent 编排、插件生态、分发） |
| **记忆系统** | 内生化 Memory + FTS5 检索 | 多维度检索记忆 + 会话 transcript |
| **适用场景** | 个人深度协作、养成型工作搭子 | 多 Agent 运营、复杂团队协作 |

**一句话结论**：想要一个越用越强的工作搭子 → 选 Hermes；想要一个多脑并存的 AI 操作系统 → 选 OpenClaw。

## 四、为什么 Hermes 值得关注？

1. **GitHub 两个月冲上 3.5 万星**，增长曲线陡峭
2. **OpenRouter 消耗量**同时登顶 Coding Agent 榜和 Productivity 榜
3. **Nous Research 迭代光速**：Karpathy 的 LLM Wiki 发布次日即被集成
4. **透明度带来可信度**：所有工作过程打印在聊天界面，像靠谱员工一样可追溯

## 五、实战要领

- **上手后先做十件事**：安装 → 配置 LLM → 创建 SOUL.md → 接入消息平台 → 安装基础 Skills → 跑第一个任务 → 让它沉淀第一个 Skill → 配置定时任务 → 设置子 Agent → 定期复盘
- **从经验中学习**：每次任务成功或失败都是 Hermes 的学习素材，别跳过它的 Skill 创建提示
- **Hermes 擅长长程无监管运行**：实测 2 小时以上任务仍然稳定

## 六、学习资源

- 官方文档：https://hermes-agent.nousresearch.com/docs/
- 中文文档（日更）：https://hermes-doc.aigc.green/
- 创始人推特：@Teknium（Nous Research 联合创始人）
- 百度网盘保姆级教程：Hermes-Agent 从入门到精通
