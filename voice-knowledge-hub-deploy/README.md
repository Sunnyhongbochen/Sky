# 声迹知识库 V1

一个可实际使用的本机单用户录音知识管理系统。录音、元数据、逐字稿和整理结果持久保存在工程目录中；默认使用 `faster-whisper` 离线转写，不把原始录音发送给第三方。

## 工程位置

```text
E:\Agent\chatgpt\丰图FDE
```

数据位置：

```text
data/db.json        录音元数据、转写和知识整理
data/uploads/       原始录音文件
data/models/        Whisper离线模型
```

## 启动

当前工程已经创建 `.venv` 并安装转写依赖：

```powershell
npm run check
npm start
```

浏览器访问：<http://127.0.0.1:4173>

## 实际功能

- 批量上传 M4A、MP3、WAV、AAC、FLAC、OGG、MP4
- 录音文件和元数据服务端持久保存
- 本地 `faster-whisper small` 真实离线转写
- 原始录音播放及时间戳定位
- 修改标题、人员、项目、类型、日期和标签
- 永久删除原始录音及转写结果
- 逐字稿、优化整理稿、知识整理三个模块
- 通用 Chat Completions 接口生成完整书面整理稿和六类专用知识模板
- 关键词和自然语言式检索
- 转写状态自动刷新及失败重试
- 可在设置页更换 Base URL、Model 和 API Key

## 转写环境

重新安装依赖时执行：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

默认使用的 `small` 模型已预下载到 `data/models`。转写脚本只加载工程内的模型文件，不会在每次启动或转写时重新联网下载。

如模型文件被清理，可手动重新下载并校验：

```powershell
.\.venv\Scripts\python.exe scripts\download_whisper_model.py --model small
```

如需通过 `WHISPER_MODEL` 切换其他模型，必须先用上面的命令下载对应模型。

## 大模型整理

“重新整理 / 重新提炼”通过通用 Chat Completions 接口调用知识整理模型。在网站“设置 → 模型配置”中填写 Base URL、Model 和 API Key；密钥会使用 Windows 当前用户加密机制保存，网页和接口不会回显明文。

大模型会删除语气词、口头重复和无意义自我修正，生成完整书面整理稿，并按录音类型填充对应知识模板。逐字稿始终保留，不会被覆盖，原始音频不会发送给整理模型。

## 模型说明

- 语音转文字：固定使用已经验证可工作的本地 Whisper，不上传原始录音。
- 优化整理与知识提炼：使用设置页配置的通用文本模型接口，可随时更换服务商和模型。

## 安全说明

- 系统当前只监听 `127.0.0.1`，局域网和公网无法直接访问。
- 删除录音会同步删除原始音频与单独转写结果，且不可恢复。
- `data` 目录包含个人录音和转写文本，应纳入备份和访问控制。
