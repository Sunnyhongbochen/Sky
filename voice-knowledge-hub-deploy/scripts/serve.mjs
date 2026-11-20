import { createServer } from "node:http";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { extname, join, normalize, basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { organizationConfigured, organizeRecording } from "./organize.mjs";
import { getModelConfig, saveModelConfig, testModelConfig } from "./model-config.mjs";

const projectRoot = process.cwd();
const staticRoot = join(projectRoot, "dist");
const dataRoot = process.env.DATA_DIR ? normalize(process.env.DATA_DIR) : join(projectRoot, "data");
const uploadsRoot = join(dataRoot, "uploads");
const dbPath = join(dataRoot, "db.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 1024 * 1024 * 1024);
const venvPython = join(projectRoot, ".venv", "Scripts", "python.exe");
const bundledPython = "C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const pythonBin = process.env.PYTHON_BIN || (existsSync(venvPython) ? venvPython : existsSync(bundledPython) ? bundledPython : "python");
const activeJobs = new Map();
const activeOrganizationJobs = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".m4a": "audio/mp4", ".mp3": "audio/mpeg",
  ".wav": "audio/wav", ".aac": "audio/aac", ".flac": "audio/flac", ".ogg": "audio/ogg", ".mp4": "video/mp4"
};

await mkdir(uploadsRoot, { recursive: true });
if (!existsSync(dbPath)) await writeFile(dbPath, JSON.stringify({ version: 1, recordings: [] }, null, 2), "utf8");

let dbQueue = Promise.resolve();
async function readDb() {
  try { return JSON.parse(await readFile(dbPath, "utf8")); }
  catch { return { version: 1, recordings: [] }; }
}
function mutateDb(mutator) {
  dbQueue = dbQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    const temp = `${dbPath}.tmp`;
    await writeFile(temp, JSON.stringify(db, null, 2), "utf8");
    await rename(temp, dbPath);
    return result;
  });
  return dbQueue;
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
async function jsonBody(req, limit = 1024 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw new Error("请求内容过大"); chunks.push(chunk); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}
function safeHeader(req, name, fallback = "") {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? decodeURIComponent(value).slice(0, 500) : fallback;
}
function parsePath(url) { return decodeURIComponent(new URL(url, "http://localhost").pathname).split("/").filter(Boolean); }
function sanitizeFilename(name) {
  const ext = extname(name).toLowerCase();
  const stem = basename(name, ext).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120) || "recording";
  return { stem, ext: [".m4a", ".mp3", ".wav", ".aac", ".flac", ".ogg", ".mp4"].includes(ext) ? ext : ".audio" };
}

async function handleUpload(req, res) {
  const originalName = safeHeader(req, "x-file-name", "recording.m4a");
  const { stem, ext } = sanitizeFilename(originalName);
  const id = randomUUID();
  const storedName = `${id}${ext}`;
  const finalPath = join(uploadsRoot, storedName);
  const tempPath = `${finalPath}.uploading`;
  const hash = createHash("sha256");
  let size = 0;
  req.on("data", chunk => { size += chunk.length; hash.update(chunk); if (size > maxUploadBytes) req.destroy(new Error("文件超过上传限制")); });
  try {
    await pipeline(req, createWriteStream(tempPath, { flags: "wx" }));
    await rename(tempPath, finalPath);
    const now = new Date().toISOString();
    const record = {
      id, originalName, storedName, title: safeHeader(req, "x-title", stem), date: safeHeader(req, "x-recorded-date", now.slice(0, 10)),
      time: safeHeader(req, "x-recorded-time", now.slice(11, 16)), type: safeHeader(req, "x-document-type", "其他"),
      project: safeHeader(req, "x-project", "未归档"), participants: [], tags: [], provider: "本地 Whisper",
      status: "uploaded", size, sha256: hash.digest("hex"), createdAt: now, updatedAt: now, duration: "待分析", seconds: 0,
      summary: "文件已上传，尚未开始转写。", optimizedText: "", transcript: [], decisions: [], actions: [], knowledge: { topics: [], facts: [], questions: [] }
    };
    await mutateDb(db => { db.recordings.unshift(record); });
    json(res, 201, record);
  } catch (error) {
    if (existsSync(tempPath)) await unlink(tempPath).catch(() => {});
    json(res, 400, { error: error.message || "上传失败" });
  }
}

async function serveAudio(req, res, record) {
  const filePath = join(uploadsRoot, record.storedName);
  if (!existsSync(filePath)) return json(res, 404, { error: "录音文件不存在" });
  const info = await stat(filePath);
  const range = req.headers.range;
  const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
  if (range) {
    const [startText, endText] = range.replace(/bytes=/, "").split("-");
    const start = Number(startText); const end = endText ? Number(endText) : info.size - 1;
    if (!Number.isFinite(start) || start < 0 || end >= info.size) { res.writeHead(416); return res.end(); }
    res.writeHead(206, { "Content-Type": contentType, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": end - start + 1 });
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": contentType, "Accept-Ranges": "bytes", "Content-Length": info.size });
    createReadStream(filePath).pipe(res);
  }
}

async function startTranscription(recordId, options = {}) {
  if (activeJobs.has(recordId)) return;
  const db = await readDb(); const record = db.recordings.find(r => r.id === recordId);
  if (!record) throw new Error("录音不存在");
  const audioPath = join(uploadsRoot, record.storedName);
  if (!existsSync(audioPath)) throw new Error("原始录音文件不存在");
  const outputPath = join(dataRoot, `${recordId}.transcript.json`);
  await mutateDb(db2 => { const item = db2.recordings.find(r => r.id === recordId); item.status = "processing"; item.provider = "本地 Whisper"; item.updatedAt = new Date().toISOString(); item.error = null; });
  const args = [join(projectRoot, "scripts", "transcribe.py"), "--input", audioPath, "--output", outputPath, "--model", options.model || process.env.WHISPER_MODEL || "small", "--language", options.language || "zh", "--record-type", record.type || "其他"];
  const child = spawn(pythonBin, args, { cwd: projectRoot, env: { ...process.env, HF_HOME: process.env.HF_HOME || join(dataRoot, "models") }, windowsHide: true });
  activeJobs.set(recordId, child);
  let stderr = "";
  child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-12000); });
  child.on("close", async code => {
    activeJobs.delete(recordId);
    if (code === 0 && existsSync(outputPath)) {
      const result = JSON.parse(await readFile(outputPath, "utf8"));
      await mutateDb(db2 => {
        const item = db2.recordings.find(r => r.id === recordId);
        Object.assign(item, result, { status: "review", provider: `本地 Whisper · ${result.model || options.model || "small"}`, updatedAt: new Date().toISOString(), error: null });
      });
    } else {
      await mutateDb(db2 => { const item = db2.recordings.find(r => r.id === recordId); item.status = "failed"; item.error = stderr || `转写进程退出码 ${code}`; item.updatedAt = new Date().toISOString(); });
    }
  });
}

async function handleApi(req, res, parts) {
  if (parts[1] === "health" && req.method === "GET") { const modelConfig = await getModelConfig(); return json(res, 200, { ok: true, storage: dataRoot, transcription: "faster-whisper", organization: modelConfig.apiKeyConfigured ? "configured" : "not-configured", model: modelConfig.model || null, python: pythonBin }); }
  if (parts[1] === "model-config" && parts.length === 2 && req.method === "GET") return json(res, 200, await getModelConfig());
  if (parts[1] === "model-config" && parts.length === 2 && req.method === "PUT") return json(res, 200, await saveModelConfig(await jsonBody(req)));
  if (parts[1] === "model-config" && parts[2] === "test" && req.method === "POST") return json(res, 200, await testModelConfig(await jsonBody(req).catch(() => ({}))));
  if (parts[1] !== "recordings") return false;
  if (parts.length === 2 && req.method === "GET") return json(res, 200, (await readDb()).recordings);
  if (parts.length === 2 && req.method === "POST") return handleUpload(req, res);
  const id = parts[2]; const db = await readDb(); const record = db.recordings.find(r => r.id === id);
  if (!record) return json(res, 404, { error: "录音不存在" });
  if (parts.length === 3 && req.method === "GET") return json(res, 200, record);
  if (parts.length === 3 && req.method === "PATCH") {
    const allowed = ["title", "date", "time", "type", "project", "participants", "tags", "optimizedText", "summary", "decisions", "actions", "knowledge"];
    const body = await jsonBody(req);
    const updated = await mutateDb(db2 => { const item = db2.recordings.find(r => r.id === id); for (const key of allowed) if (key in body) item[key] = body[key]; item.updatedAt = new Date().toISOString(); return item; });
    return json(res, 200, updated);
  }
  if (parts.length === 3 && req.method === "DELETE") {
    await unlink(join(uploadsRoot, record.storedName)).catch(() => {});
    await unlink(join(dataRoot, `${id}.transcript.json`)).catch(() => {});
    await mutateDb(db2 => { db2.recordings = db2.recordings.filter(r => r.id !== id); });
    return json(res, 200, { ok: true });
  }
  if (parts[3] === "audio" && req.method === "GET") return serveAudio(req, res, record);
  if (parts[3] === "transcribe" && req.method === "POST") {
    const body = await jsonBody(req).catch(() => ({}));
    if (record.status === "processing") return json(res, 409, { error: "该录音正在转写" });
    await startTranscription(id, body);
    return json(res, 202, { ok: true, status: "processing", provider: "local" });
  }
  if (parts[3] === "organize" && req.method === "POST") {
    if (!record.transcript?.length) return json(res, 409, { error: "请先完成逐字稿转写" });
    if (activeOrganizationJobs.has(id)) return json(res, 409, { error: "该录音正在整理" });
    activeOrganizationJobs.add(id);
    await mutateDb(db2 => { const item = db2.recordings.find(r => r.id === id); item.organizationStatus = "processing"; item.organizationError = null; item.updatedAt = new Date().toISOString(); });
    try {
      const result = await organizeRecording(record);
      const updated = await mutateDb(db2 => {
        const item = db2.recordings.find(r => r.id === id);
        Object.assign(item, {
          optimizedText: result.optimizedText,
          summary: result.summary,
          knowledge: { templateType: result.templateType, sections: result.sections, confidenceNotes: result.confidenceNotes },
          decisions: result.decisions,
          actions: result.actions,
          organizationStatus: "complete",
          organizationProvider: `${new URL(result.baseUrl).hostname} · ${result.model}`,
          organizationError: null,
          updatedAt: new Date().toISOString()
        });
        return item;
      });
      return json(res, 200, updated);
    } catch (error) {
      await mutateDb(db2 => { const item = db2.recordings.find(r => r.id === id); item.organizationStatus = "failed"; item.organizationError = error.message; item.updatedAt = new Date().toISOString(); });
      return json(res, 502, { error: error.message || "大模型整理失败" });
    } finally {
      activeOrganizationJobs.delete(id);
    }
  }
  return false;
}

async function serveStatic(req, res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = normalize(join(staticRoot, relative));
  if (!filePath.startsWith(staticRoot)) throw new Error("Invalid path");
  let target = filePath;
  try { if ((await stat(target)).isDirectory()) target = join(target, "index.html"); }
  catch { target = join(staticRoot, "index.html"); }
  const body = await readFile(target);
  res.writeHead(200, { "Content-Type": mimeTypes[extname(target)] || "application/octet-stream" });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const parts = parsePath(req.url);
    if (parts[0] === "api") {
      const handled = await handleApi(req, res, parts);
      if (handled === false && !res.headersSent) json(res, 404, { error: "接口不存在" });
    } else await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: error.message || "服务器错误" }); else res.end();
  }
}).listen(port, host, () => {
  console.log(`声迹知识库：http://${host}:${port}`);
  console.log(`工程目录：${projectRoot}`);
  console.log(`数据目录：${dataRoot}`);
});
