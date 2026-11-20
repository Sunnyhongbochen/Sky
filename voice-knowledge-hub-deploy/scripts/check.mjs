import { access, readFile } from "node:fs/promises";

const files = ["dist/index.html", "dist/styles.css", "dist/app.js", "scripts/organize.mjs"];
for (const file of files) await access(file);

const html = await readFile("dist/index.html", "utf8");
const css = await readFile("dist/styles.css", "utf8");
const js = await readFile("dist/app.js", "utf8");
const organizer = await readFile("scripts/organize.mjs", "utf8");

const checks = [
  [html.includes('id="app"'), "缺少应用挂载点"],
  [html.includes("styles.css") && html.includes("app.js"), "静态资源引用不完整"],
  [css.includes("@media") && css.includes(":focus-visible"), "缺少响应式或键盘可访问样式"],
  [js.includes("/api/recordings") && js.includes("renderDashboard"), "真实数据API或仪表盘逻辑缺失"],
  [js.includes("逐字稿") && js.includes("优化整理稿") && js.includes("知识整理"), "三个内容模块未完整实现"],
  [js.includes("delete-record") && js.includes("save-record-metadata"), "删除或元数据编辑能力缺失"],
  [js.includes("语音通话") && !js.includes("访谈记录") && !js.includes("培训课程"), "录音类型未按六类统一"],
  [js.includes("groupTranscript") && js.includes("/organize"), "逐字稿合并或大模型整理能力缺失"],
  [js.includes("KNOWLEDGE_TEMPLATES") && js.includes("templateType"), "分类知识模板未实现"],
  [organizer.includes("/chat/completions") && organizer.includes("getModelConfig"), "通用大模型整理接口未实现"],
  [js.includes("model-base-url") && js.includes("save-model-config") && !js.includes("待配置凭证"), "通用模型配置页面未完成"]
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  failed.forEach(([, message]) => console.error(`✗ ${message}`));
  process.exit(1);
}

console.log(`✓ ${files.length} 个核心文件存在`);
console.log("✓ 响应式、真实API、三模块、编辑删除与转写配置检查通过");
