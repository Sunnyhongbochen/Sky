# 声迹知识库个人网站部署包

这是经过隐私清理的完整部署工程，可用于支持 Node.js 服务的个人网站服务器。

## 快速入口

- 项目交付说明：`docs/DELIVERY.md`
- 完整部署步骤：`docs/DEPLOYMENT.md`
- Docker 部署：`Dockerfile`、`docker-compose.example.yml`
- 网站前端：`dist/`
- 后端与转写脚本：`scripts/`
- 空白数据目录：`data/`

## 重要说明

1. 本包不包含真实录音、真实逐字稿、联系人信息、模型缓存或 API Key。
2. 服务器必须能长期运行 Node.js；纯静态网页空间不能使用上传、转写、删除、检索等功能。
3. 大模型密钥请通过服务器环境变量 `MODEL_API_KEY` 配置。
4. 首次使用本地 Whisper 前，需要按部署指南安装 Python 依赖并下载模型。

