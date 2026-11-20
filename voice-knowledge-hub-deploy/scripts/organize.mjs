import { getModelConfig } from "./model-config.mjs";

const DOCUMENT_TEMPLATES = {
  "会议纪要": ["meetingSummary", "discussionPoints", "decisions", "actions", "risks"],
  "语音通话": ["callPurpose", "keyInformation", "commitments", "followUp", "openQuestions"],
  "客户沟通": ["customerContext", "needs", "painPoints", "solution", "objections", "nextSteps"],
  "工作记录": ["workSummary", "progress", "issues", "conclusions", "nextSteps"],
  "灵感笔记": ["coreIdea", "inspiration", "value", "assumptions", "possibleActions"],
  "其他": ["summary", "keyPoints", "conclusions", "actions"]
};

const TEMPLATE_GUIDANCE = {
  "会议纪要": "重点区分讨论过程、已确认决定、待办事项和未决风险。",
  "语音通话": "重点记录通话目的、对方提供的信息、双方承诺、回访安排和未决问题。",
  "客户沟通": "重点记录客户背景、明确需求、痛点约束、方案反馈、异议和下一步行动。",
  "工作记录": "重点记录完成进展、问题阻塞、工作结论、经验和下一步计划。",
  "灵感笔记": "重点保留核心想法、触发背景、潜在价值、关键假设和验证行动。",
  "其他": "按摘要、关键要点、结论和行动形成通用知识记录。"
};

function transcriptText(segments = []) {
  const turns = [];
  for (const segment of segments) {
    const speaker = String(segment.speaker || "说话人").trim();
    const text = String(segment.text || "").replace(/\s+/g, "").trim();
    if (!text) continue;
    const previous = turns[turns.length - 1];
    if (previous?.speaker === speaker) previous.text += text;
    else turns.push({ speaker, text });
  }
  return turns.map(turn => `${turn.speaker}：${turn.text}`).join("\n\n");
}

function splitLongText(text, maxChars = 2600) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > maxChars) {
    let cut = Math.max(800, remaining.lastIndexOf("。", maxChars));
    if (cut < maxChars * 0.65) cut = maxChars;
    chunks.push(remaining.slice(0, cut + (remaining[cut] === "。" ? 1 : 0)).trim());
    remaining = remaining.slice(cut + (remaining[cut] === "。" ? 1 : 0)).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function responseSchema(type) {
  const keys = DOCUMENT_TEMPLATES[type] || DOCUMENT_TEMPLATES["其他"];
  const sectionProperties = Object.fromEntries(keys.map(key => [key, { type: "string" }]));
  return {
    type: "object",
    additionalProperties: false,
    required: ["optimizedText", "summary", "sections", "decisions", "actions", "confidenceNotes"],
    properties: {
      optimizedText: { type: "string", description: "在保留事实和逻辑的前提下形成的完整书面整理稿，不是简短摘要。" },
      summary: { type: "string", description: "两至四句话的内容摘要。" },
      sections: {
        type: "object",
        additionalProperties: false,
        required: keys,
        properties: sectionProperties
      },
      decisions: { type: "array", items: { type: "string" } },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "owner", "due"],
          properties: { text: { type: "string" }, owner: { type: "string" }, due: { type: "string" } }
        }
      },
      confidenceNotes: { type: "array", items: { type: "string" }, description: "转写中疑似错词或无法确认的专名；没有则为空数组。" }
    }
  };
}

function metadataResponseSchema(type) {
  const schema = responseSchema(type);
  schema.required = schema.required.filter(key => key !== "optimizedText");
  delete schema.properties.optimizedText;
  return schema;
}

function extractOutputText(response) {
  for (const item of response.output || []) {
    for (const content of item.content || []) if (content.type === "output_text" && content.text) return content.text;
  }
  throw new Error("大模型没有返回可解析的整理结果");
}

function validateResult(result, type) {
  const keys = DOCUMENT_TEMPLATES[type] || DOCUMENT_TEMPLATES["其他"];
  if (!result || typeof result.optimizedText !== "string" || result.optimizedText.length < 80) throw new Error("大模型返回的优化稿不完整");
  if (!result.sections || keys.some(key => typeof result.sections[key] !== "string")) throw new Error("大模型返回的知识模板不完整");
  result.decisions = Array.isArray(result.decisions) ? result.decisions.filter(Boolean) : [];
  result.actions = Array.isArray(result.actions) ? result.actions.filter(item => item?.text) : [];
  result.confidenceNotes = Array.isArray(result.confidenceNotes) ? result.confidenceNotes.filter(Boolean) : [];
  return result;
}

export function organizationConfigured() {
  return true;
}

export async function organizeRecording(record) {
  const config = await getModelConfig({ includeSecret: true });
  if (!config.apiKeyConfigured || !config.apiKey) throw new Error("尚未配置通用整理模型");
  const source = transcriptText(record.transcript);
  if (!source) throw new Error("逐字稿为空，无法整理");
  const type = DOCUMENT_TEMPLATES[record.type] ? record.type : "其他";
  const model = config.model;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.MODEL_TIMEOUT_MS || 300000));
  const user = `录音标题：${record.title || "未命名"}\n项目：${record.project || "未归档"}\n参与人：${(record.participants || []).join("、") || "未标注"}\n录音类型：${type}\n\n以下是原始逐字稿：\n${source}`;
  try {
    const callModel = async ({ messages, maxTokens, json = false, acceptLength = false }) => {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, thinking: { type: "disabled" }, reasoning_effort: "none", ...(json ? { response_format: { type: "json_object" } } : {}), max_tokens: maxTokens, stream: false }),
        signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || `模型接口请求失败（${response.status}）`);
      const content = payload?.choices?.[0]?.message?.content;
      if (!content) throw new Error("模型没有返回内容");
      if (payload?.choices?.[0]?.finish_reason === "length" && !acceptLength) throw new Error("模型输出达到长度限制，请更换支持更长输出的模型");
      return content.trim();
    };

    const sourceChunks = splitLongText(source);
    const optimizedChunks = [];
    for (let index = 0; index < sourceChunks.length; index += 1) {
      const chunk = await callModel({
        maxTokens: 1800,
        acceptLength: true,
        messages: [
          { role: "system", content: `你是严谨的中文录音编辑。下面是长录音的第 ${index + 1}/${sourceChunks.length} 段。请将本段整理为 400—700 个汉字的规范书面内容：删除语气词、口头禅、无意义重复和自我修正，合并同义内容，补充标点和自然段；完整保留事实、数字、分歧、条件和行动信息，不得编造。只输出正文，不要 JSON、Markdown 标题或解释。` },
          { role: "user", content: sourceChunks[index] }
        ]
      });
      if (chunk.length < 180) throw new Error(`模型返回的第 ${index + 1} 段优化稿过短`);
      optimizedChunks.push(chunk);
    }
    const optimizedText = optimizedChunks.join("\n\n");
    if (optimizedText.length < 500) throw new Error("模型返回的优化稿过短");

    const schema = metadataResponseSchema(type);
    const metadataText = await callModel({
      json: true,
      maxTokens: 6000,
      messages: [
        { role: "system", content: `你是中文知识整理助手。根据书面整理稿提炼“${type}”知识。${TEMPLATE_GUIDANCE[type]} 不得编造未出现的责任人、日期或决定；未明确的信息用空字符串或“录音中未明确”。每个 sections 字段控制在 3—5 条简洁要点，使用换行和“- ”列表；actions 不超过 6 项，confidenceNotes 不超过 5 项。只输出 JSON，不要代码块。必须严格符合此 JSON Schema：${JSON.stringify(schema)}` },
        { role: "user", content: `录音标题：${record.title || "未命名"}\n项目：${record.project || "未归档"}\n参与人：${(record.participants || []).join("、") || "未标注"}\n\n书面整理稿：\n${optimizedText}` }
      ]
    });
    const metadata = JSON.parse(metadataText.replace(/^```json\s*|\s*```$/g, ""));
    const result = validateResult({ ...metadata, optimizedText }, type);
    return { ...result, templateType: type, model, baseUrl: config.baseUrl };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("大模型整理超时，请稍后重试");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
