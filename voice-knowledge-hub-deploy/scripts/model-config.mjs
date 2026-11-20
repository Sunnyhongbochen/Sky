import { existsSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const configPath = join(process.env.DATA_DIR || join(process.cwd(), "data"), "model-config.json");
const protectScript = `$value=[Console]::In.ReadToEnd();$secure=ConvertTo-SecureString $value -AsPlainText -Force;[Console]::Out.Write((ConvertFrom-SecureString $secure))`;
const unprotectScript = `$value=[Console]::In.ReadToEnd();$secure=ConvertTo-SecureString $value;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);try{[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}`;

function dpapi(script, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PSModulePath: "C:\\Windows\\system32\\WindowsPowerShell\\v1.0\\Modules" }
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.on("close", code => code === 0 ? resolve(stdout) : reject(new Error(stderr || "Windows 凭证加密失败")));
    child.stdin.end(input);
  });
}

function normalizeBaseUrl(value) {
  const url = new URL(String(value || "").trim());
  if (!/^https?:$/.test(url.protocol)) throw new Error("Base URL 必须使用 http 或 https");
  return url.toString().replace(/\/$/, "");
}

export async function getModelConfig({ includeSecret = false } = {}) {
  const environmentConfig = {
    baseUrl: String(process.env.MODEL_BASE_URL || "").trim(),
    model: String(process.env.MODEL_NAME || "").trim(),
    apiKey: String(process.env.MODEL_API_KEY || "").trim()
  };
  let stored = {};
  if (existsSync(configPath)) stored = JSON.parse(await readFile(configPath, "utf8"));
  const result = {
    baseUrl: environmentConfig.baseUrl || stored.baseUrl || "",
    model: environmentConfig.model || stored.model || "",
    apiKeyConfigured: Boolean(environmentConfig.apiKey || stored.encryptedApiKey),
    source: environmentConfig.apiKey ? "environment" : stored.encryptedApiKey ? "local-encrypted" : "none",
    updatedAt: stored.updatedAt || null
  };
  if (includeSecret && environmentConfig.apiKey) result.apiKey = environmentConfig.apiKey;
  else if (includeSecret && stored.encryptedApiKey) result.apiKey = await dpapi(unprotectScript, stored.encryptedApiKey);
  return result;
}

export async function saveModelConfig(input) {
  if (process.platform !== "win32") throw new Error("服务器部署请通过 MODEL_BASE_URL、MODEL_NAME、MODEL_API_KEY 环境变量配置模型");
  const suppliedApiKey = String(input.apiKey || "").trim();
  const existing = await getModelConfig({ includeSecret: !suppliedApiKey });
  const baseUrl = normalizeBaseUrl(input.baseUrl || existing.baseUrl);
  const model = String(input.model || existing.model || "").trim();
  const apiKey = suppliedApiKey || String(existing.apiKey || "").trim();
  if (!model) throw new Error("Model 不能为空");
  if (!apiKey) throw new Error("API Key 不能为空");
  const encryptedApiKey = await dpapi(protectScript, apiKey);
  const stored = { baseUrl, model, encryptedApiKey, updatedAt: new Date().toISOString() };
  const tempPath = `${configPath}.tmp`;
  await writeFile(tempPath, JSON.stringify(stored, null, 2), "utf8");
  await rename(tempPath, configPath);
  return { baseUrl, model, apiKeyConfigured: true, updatedAt: stored.updatedAt };
}

export async function testModelConfig(input = {}) {
  const existing = await getModelConfig({ includeSecret: true });
  const config = {
    baseUrl: normalizeBaseUrl(input.baseUrl || existing.baseUrl),
    model: String(input.model || existing.model || "").trim(),
    apiKey: String(input.apiKey || existing.apiKey || "").trim()
  };
  if (!config.model || !config.apiKey) throw new Error("请先完整配置模型");
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: "仅回复：连接成功" }], thinking: { type: "disabled" }, reasoning_effort: "none", max_tokens: 16, stream: false })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `模型接口返回 ${response.status}`);
  return { ok: true, model: config.model, message: payload?.choices?.[0]?.message?.content || "连接成功" };
}
