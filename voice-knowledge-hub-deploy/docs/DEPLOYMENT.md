# 个人网站服务器部署指南

## 环境要求

- Node.js 20 或更高版本
- Python 3.10 或更高版本
- 可写且可持久化的 `data` 目录
- 建议至少 4 GB 内存；本地 Whisper `small` 模型建议 8 GB 内存

## 1. 解压并安装转写依赖

Windows PowerShell：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts\download_whisper_model.py --model small
```

Linux：

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python scripts/download_whisper_model.py --model small
```

## 2. 配置服务器环境变量

```text
HOST=0.0.0.0
PORT=4173
DATA_DIR=/你的持久化目录/data
PYTHON_BIN=/应用目录/.venv/bin/python
WHISPER_MODEL=small

MODEL_BASE_URL=https://你的模型服务地址
MODEL_NAME=你的模型名称
MODEL_API_KEY=通过服务器密钥管理填写
MODEL_TIMEOUT_MS=300000
```

`MODEL_API_KEY` 不要写进网页、代码仓库或公开配置文件。Windows 本机使用时也可以在“设置 → 模型配置”中保存，系统会使用当前 Windows 用户的加密机制保护密钥。

## 3. 启动

```bash
npm start
```

健康检查：

```text
GET /api/health
```

## 4. 反向代理

将个人网站的子域名或路径反向代理到 `127.0.0.1:4173`。录音文件可能较大，请把代理层上传限制和超时设置为：

- 上传大小：至少 1 GB
- 请求超时：至少 10 分钟
- WebSocket：不要求

建议使用独立子域名，例如 `voice.example.com`。如果个人网站只能上传 HTML/CSS/JS 静态文件，则只能展示界面，无法使用上传、转写、删除、检索和大模型整理功能。

## 5. 数据与备份

需要备份：

```text
data/db.json
data/uploads/
data/*.transcript.json
data/model-config.json（仅 Windows 本机加密配置）
```

服务器通过环境变量配置模型时，不需要备份 `model-config.json`。

