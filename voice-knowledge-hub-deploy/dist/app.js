const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const iconPaths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3"/>',
  file: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1h-4v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1v-4H3a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.37.34.71.6 1 .28.28.62.48 1 .6h.1v4H21a1.7 1.7 0 0 0-1.6.4Z"/>',
  upload: '<path d="M12 16V3M7 8l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  tag: '<path d="M20 13 13 20 4 11V4h7z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
  folder: '<path d="M3 5h7l2 3h9v11H3z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  cloud: '<path d="M17.5 19H7a5 5 0 1 1 1-9.9A7 7 0 0 1 21 12a4 4 0 0 1-3.5 7Z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  spark: '<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/>',
  shield: '<path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>'
};

function icon(name, size = 18) {
  return `<span class="icon" style="width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 24 24">${iconPaths[name] || iconPaths.file}</svg></span>`;
}

const DOCUMENT_TYPES = ["会议纪要", "语音通话", "客户沟通", "工作记录", "灵感笔记", "其他"];

const KNOWLEDGE_TEMPLATES = {
  "会议纪要": {
    description: "围绕会议主题、讨论要点、决定、待办和风险形成纪要。",
    fields: [["meetingSummary","会议主题与背景",4],["discussionPoints","讨论要点",7],["decisions","明确决定",5],["actions","待办事项（事项｜负责人｜时间）",5],["risks","风险与待确认事项",4]]
  },
  "语音通话": {
    description: "记录通话目的、关键信息、双方承诺及后续回访。",
    fields: [["callPurpose","通话目的",4],["keyInformation","关键信息",7],["commitments","双方承诺",5],["followUp","后续跟进",5],["openQuestions","未决问题",4]]
  },
  "客户沟通": {
    description: "整理客户背景、需求痛点、方案反馈、异议和下一步。",
    fields: [["customerContext","客户背景与沟通目标",4],["needs","客户需求",6],["painPoints","痛点与约束",5],["solution","建议方案与客户反馈",6],["objections","异议与待确认事项",5],["nextSteps","下一步行动",5]]
  },
  "工作记录": {
    description: "记录当日工作、进展、问题、结论和下一步计划。",
    fields: [["workSummary","工作概述",4],["progress","完成进展",6],["issues","问题与阻塞",5],["conclusions","结论与经验",5],["nextSteps","下一步计划",5]]
  },
  "灵感笔记": {
    description: "保留核心想法、触发背景、价值、假设和验证行动。",
    fields: [["coreIdea","核心想法",5],["inspiration","灵感来源与背景",5],["value","潜在价值",5],["assumptions","关键假设与疑问",5],["possibleActions","可行的验证行动",5]]
  },
  "其他": {
    description: "按通用结构提炼摘要、要点、结论和后续行动。",
    fields: [["summary","内容摘要",5],["keyPoints","关键要点",7],["conclusions","结论",5],["actions","后续行动",5]]
  }
};

function documentTypeOptions(selected = "") {
  return DOCUMENT_TYPES.map(type => `<option ${type === selected ? "selected" : ""}>${type}</option>`).join("");
}

function groupTranscript(segments = []) {
  return segments.reduce((groups, segment) => {
    const previous = groups[groups.length - 1];
    if (previous && previous.speaker === segment.speaker) {
      previous.text += segment.text;
      previous.parts.push(segment.text);
      previous.endSeconds = segment.endSeconds ?? segment.seconds;
      previous.endAt = segment.endAt || secondsLabel(previous.endSeconds);
    } else groups.push({ ...segment, parts: [segment.text], endAt: segment.endAt || secondsLabel(segment.endSeconds ?? segment.seconds) });
    return groups;
  }, []);
}

function transcriptParagraphs(turn, targetLength = 520) {
  const paragraphs = [];
  let current = "";
  for (const part of turn.parts || [turn.text]) {
    current += part;
    if (current.length >= targetLength && /[，。！？；]?$/.test(current)) {
      paragraphs.push(current);
      current = "";
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

function secondsLabel(value = 0) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(n).padStart(2, "0")).join(":");
}

function cleanSpokenText(value = "") {
  return String(value)
    .replace(/\s+/g, "")
    .replace(/(^|[，。！？；：])(?:嗯+|呃+|额+|啊+|哦+|这个|那个|就是|然后|其实|就是说|怎么说呢)+[，、 ]*/g, "$1")
    .replace(/(?:对吧|是吧|你知道吧)(?=[，。！？；]|$)/g, "")
    .replace(/([\u4e00-\u9fff]{2,6})(?:[、， ]*\1){1,}/g, "$1")
    .replace(/([，。！？；])\1+/g, "$1")
    .replace(/^[，、 ]+|[，、 ]+$/g, "");
}

function buildWrittenText(segments = []) {
  const paragraphs = [], paragraphSentences = [], sentenceParts = [];
  let paragraphLength = 0, sentenceLength = 0;
  for (const segment of segments) {
    const text = cleanSpokenText(segment.text);
    if (!text || text === sentenceParts[sentenceParts.length - 1]) continue;
    sentenceParts.push(text.replace(/[，。！？；]+$/g, ""));
    sentenceLength += text.length;
    if (sentenceLength >= 85 || (/[。！？]$/.test(text) && sentenceLength >= 45)) {
      const sentence = `${sentenceParts.splice(0).join("")}。`;
      paragraphSentences.push(sentence);
      paragraphLength += sentence.length;
      sentenceLength = 0;
    }
    if (paragraphLength >= 320) { paragraphs.push(paragraphSentences.splice(0).join("")); paragraphLength = 0; }
  }
  if (sentenceParts.length) paragraphSentences.push(`${sentenceParts.join("")}。`);
  if (paragraphSentences.length) paragraphs.push(paragraphSentences.join(""));
  return paragraphs.join("\n\n");
}

function deriveKnowledge(record, optimizedText = record.optimizedText || "") {
  const compact = optimizedText.replace(/\s+/g, " ").trim();
  const summary = `${compact.slice(0, 260)}${compact.length > 260 ? "……" : ""}`;
  const parts = optimizedText.split(/\n+|(?<=[。！？])/).map(x => x.trim()).filter(Boolean);
  const list = predicate => parts.filter(predicate).slice(0, 8).map(x => `- ${x.slice(0, 180)}`).join("\n");
  const points = parts.slice(0, 6).map(x => `- ${x.slice(0, 180)}`).join("\n");
  const decisions = list(x => /确定|决定|采用|同意|明确/.test(x));
  const actions = list(x => /需要|负责|计划|后续|下一步|完成|提交|联系/.test(x));
  const risks = list(x => /问题|风险|待确认|不确定|困难|阻塞/.test(x));
  const byType = {
    "会议纪要": { meetingSummary: summary, discussionPoints: points, decisions, actions, risks },
    "语音通话": { callPurpose: summary, keyInformation: points, commitments: actions, followUp: actions, openQuestions: risks },
    "客户沟通": { customerContext: summary, needs: points, painPoints: risks, solution: decisions, objections: risks, nextSteps: actions },
    "工作记录": { workSummary: summary, progress: points, issues: risks, conclusions: decisions, nextSteps: actions },
    "灵感笔记": { coreIdea: summary, inspiration: points, value: "", assumptions: risks, possibleActions: actions },
    "其他": { summary, keyPoints: points, conclusions: decisions, actions }
  };
  const type = DOCUMENT_TYPES.includes(record.type) ? record.type : "其他";
  return { templateType: type, sections: byType[type] };
}

const seedRecordings = [
  {
    id: "demo-1", title: "丰图项目周会｜数据接口与测试计划", date: "2026-11-02", time: "09:30", duration: "42:18", seconds: 2538,
    type: "会议纪要", provider: "本地 Whisper", status: "review", project: "丰图FDE", participants: ["陈明", "刘洋", "王晓"], tags: ["接口", "测试", "交付"],
    summary: "团队确认本周完成数据接口联调，优先验证录音上传、转写回调和检索引用三个主链路。周五前形成首轮测试报告。",
    decisions: ["采用对象存储临时签名URL向转写服务提交音频。", "转写结果统一转换为句级时间戳格式。"],
    actions: [{ text: "整理20段真实测试录音", owner: "刘洋", due: "11月4日" }, { text: "完成三家ASR接口参数表", owner: "陈明", due: "11月5日" }],
    transcript: [
      { speaker: "陈明", at: "00:00:08", seconds: 8, text: "今天先对齐一下第一版范围，重点还是上传、转写、整理和检索这四条主链路。" },
      { speaker: "刘洋", at: "00:03:26", seconds: 206, text: "华为电脑可以直接看到手机录音目录，网页端按标准文件拖拽做，不需要先开发鸿蒙客户端。" },
      { speaker: "王晓", at: "00:11:42", seconds: 702, text: "转写供应商先测腾讯、火山和阿里，同一批录音并行跑，重点记录人名、金额、多人分离和时间戳。" },
      { speaker: "陈明", at: "00:23:15", seconds: 1395, text: "所有摘要和待办都要带原文引用，搜索结果点击以后必须能回到录音对应位置。" },
      { speaker: "刘洋", at: "00:37:02", seconds: 2222, text: "周五之前我把二十段测试录音整理好，覆盖会议室、远距离、方言和中英混说。" }
    ]
  },
  {
    id: "demo-2", title: "客户需求沟通｜知识库权限", date: "2026-11-01", time: "14:10", duration: "28:06", seconds: 1686,
    type: "客户沟通", provider: "本地 Whisper", status: "complete", project: "客户A", participants: ["张总", "陈明"], tags: ["权限", "私有化"],
    summary: "客户关注录音数据的私密性、部门权限及离职交接，希望支持内网部署与审计日志。",
    decisions: ["V1采用邀请制账号与录音级授权。"], actions: [{ text: "补充私有化部署说明", owner: "陈明", due: "11月6日" }],
    transcript: [
      { speaker: "张总", at: "00:02:18", seconds: 138, text: "录音只能让项目组成员看到，管理员要能查到谁下载过、谁改过。" },
      { speaker: "陈明", at: "00:08:41", seconds: 521, text: "第一版会有录音级权限、下载审计和软删除，后面也可以部署到公司内网。" },
      { speaker: "张总", at: "00:19:05", seconds: 1145, text: "离职人员的数据要能交接给新的负责人，不能跟着账号一起丢失。" }
    ]
  },
  {
    id: "demo-3", title: "语音转写服务选型讨论", date: "2026-10-30", time: "16:20", duration: "35:44", seconds: 2144,
    type: "其他", provider: "本地 Whisper", status: "complete", project: "丰图FDE", participants: ["陈明", "刘洋"], tags: ["ASR", "供应商"],
    summary: "确定不以单一宣传准确率作为选型依据，建立统一样本集，从准确度、说话人分离、速度、成本和稳定性五方面评估。",
    decisions: ["至少20段录音完成盲测后再决定默认供应商。"], actions: [],
    transcript: [
      { speaker: "陈明", at: "00:04:12", seconds: 252, text: "三家都做成适配器，业务层只认统一分段结构，不直接依赖厂商字段。" },
      { speaker: "刘洋", at: "00:17:36", seconds: 1056, text: "除了字错率，还得看人名、数字、金额、说话人和时间戳，这些更影响实际使用。" }
    ]
  },
  {
    id: "demo-4", title: "个人灵感｜录音整理习惯", date: "2026-10-29", time: "22:15", duration: "08:32", seconds: 512,
    type: "灵感笔记", provider: "本地 Whisper", status: "complete", project: "个人", participants: ["我"], tags: ["产品", "习惯"],
    summary: "建立每天晚间回顾机制，把录音中的未完成事项集中整理，减少信息散落。",
    decisions: [], actions: [{ text: "设置每日晚间录音回顾", owner: "我", due: "每天" }],
    transcript: [{ speaker: "我", at: "00:00:11", seconds: 11, text: "最好每天晚上自动把当天录音汇总出来，我只需要看待办和待确认事项。" }]
  },
  {
    id: "demo-5", title: "产品演示复盘", date: "2026-10-28", time: "11:00", duration: "19:50", seconds: 1190,
    type: "工作记录", provider: "本地 Whisper", status: "processing", project: "丰图FDE", participants: ["陈明"], tags: ["演示", "复盘"],
    summary: "录音正在进行演示处理，完成后将生成复盘文档。", decisions: [], actions: [], transcript: []
  }
];

const state = {
  page: "dashboard",
  recordings: [],
  selectedId: null,
  searchQuery: "",
  searchType: "all",
  sidebarOpen: false,
  pendingFiles: [],
  settingsTab: "providers",
  detailTab: "transcript",
  serverAvailable: false,
  modelConfig: { baseUrl: "", model: "", apiKeyConfigured: false }
};

const providers = [
  { id: "local", name: "本地 Whisper", short: "本", color: "#17483c", model: "faster-whisper · small", accuracy: "本机离线", speed: "已验证", cost: "0元", connected: true }
];

function persist() {
  // 数据由服务端持久化；此函数保留用于兼容旧事件入口。
}

function formatSize(bytes) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

function statusLabel(status) {
  return ({ processing: "处理中", review: "待审核", complete: "已完成", failed: "失败", uploaded: "已上传" })[status] || status;
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("#toast-region").append(el);
  setTimeout(() => el.remove(), 3200);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("voicehub-audio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAudioBlob(id, file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getAudioBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function renderShell() {
  $("#app").innerHTML = `
    <div class="app-shell">
      <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
        <div class="brand">
          <div class="brand-mark">${icon("mic", 22)}</div>
          <div><div class="brand-name">声迹</div><div class="brand-sub">录音知识工作台</div></div>
        </div>
        <div class="nav-section-label">知识工作台</div>
        <nav class="nav-list" aria-label="主导航">
          ${navButton("dashboard", "grid", "总览")}
          ${navButton("recordings", "mic", "录音", state.recordings.filter(r => r.status === "processing").length)}
          ${navButton("documents", "file", "知识文档")}
          ${navButton("search", "search", "检索与问答")}
        </nav>
        <div class="nav-section-label">系统</div>
        <nav class="nav-list">
          ${navButton("lab", "flask", "模型配置")}
          ${navButton("settings", "settings", "设置")}
        </nav>
        <div class="sidebar-bottom">
          <div class="storage-card">
            <div class="storage-top"><span>本机文件存储</span><span>${formatSize(state.recordings.reduce((n,r)=>n+(r.size||0),0))}</span></div>
            <div class="progress"><span style="width:${Math.min(100,state.recordings.length*3)}%"></span></div>
          </div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <button class="icon-button mobile-menu" data-action="toggle-menu" aria-label="打开菜单">${icon("menu")}</button>
          <form class="top-search" id="global-search">
            ${icon("search")}
            <input aria-label="全局搜索" name="q" placeholder="搜索录音、文档、人员或提问…" autocomplete="off" />
            <span class="key-hint">⌘ K</span>
          </form>
          <div class="top-actions">
            <span class="status ${state.serverAvailable ? "complete" : "failed"}">${state.serverAvailable ? "本机运行" : "服务未连接"}</span>
            <button class="icon-button" aria-label="通知">${icon("bell")}</button>
            <div class="avatar" title="当前用户">CM</div>
          </div>
        </header>
        <div id="page-root"></div>
      </main>
    </div>`;
  renderPage();
}

function navButton(page, iconName, label, count = 0) {
  return `<button class="nav-item ${state.page === page ? "active" : ""}" data-page="${page}">${icon(iconName)}<span>${label}</span>${count ? `<span class="badge">${count}</span>` : ""}</button>`;
}

function pageHead(eyebrow, title, subtitle, action = true) {
  return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action ? `<button class="button primary" data-action="open-upload">${icon("upload")} 上传录音</button>` : ""}</div>`;
}

function renderPage() {
  const root = $("#page-root");
  const renderers = { dashboard: renderDashboard, recordings: renderRecordings, documents: renderDocuments, search: renderSearch, lab: renderLab, settings: renderSettings, detail: renderDetail };
  root.innerHTML = `<section class="page">${(renderers[state.page] || renderDashboard)()}</section>`;
  attachPageEnhancements();
}

function renderDashboard() {
  const total = state.recordings.length;
  const review = state.recordings.filter(r => r.status === "review").length;
  const minutes = Math.round(state.recordings.reduce((sum, r) => sum + (r.seconds || 0), 0) / 60);
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - offset));
    const key = date.toISOString().slice(0, 10);
    return { key, label: ["日","一","二","三","四","五","六"][date.getDay()], minutes: Math.round(state.recordings.filter(r => r.date === key).reduce((sum, r) => sum + (r.seconds || 0), 0) / 60) };
  });
  const extractedTasks = state.recordings.flatMap(r => (r.actions || []).map(a => ({ ...a, project: r.project }))).slice(0, 4);
  return `
    ${pageHead("Overview", "把散落的声音，变成可用的知识。", total ? `当前有 ${review} 条录音等待审核，所有内容都可追溯到原声。` : "上传第一条手机录音，开始建立你的知识库。")}
    <div class="grid metrics">
      ${metric("mic", "录音总数", total, "实际入库", `${total} 条`, "#dfeee5")}
      ${metric("clock", "累计时长", `${Math.floor(minutes / 60)}h ${minutes % 60}m`, "已完成转写", `${state.recordings.filter(r=>r.transcript?.length).length} 条`, "#f7ead0")}
      ${metric("file", "知识文档", state.recordings.filter(r => r.status === "review" || r.status === "complete").length, "来自真实录音", "可追溯", "#e5ebf2")}
      ${metric("check", "待我处理", review, "待审核录音", review ? "需关注" : "已清空", "#f5dfda")}
    </div>
    <div class="grid dashboard-main">
      <div class="card">
        <div class="card-head"><div><h2>近七日录音活动</h2><p>共 ${days.reduce((n,d)=>n+d.minutes,0)} 分钟</p></div><button class="text-button" data-page="recordings">查看全部 →</button></div>
        <div class="activity-chart">
          ${days.map((d, i) => `<div class="bar-wrap"><div class="bar ${i === 6 ? "today" : ""}" data-value="${d.minutes}m" style="height:${Math.max(8, Math.min(130, d.minutes * 1.4))}px"></div><span>${d.label}</span></div>`).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h2>待办与提醒</h2><p>来自知识整理</p></div><span class="status ${extractedTasks.length ? "processing" : "complete"}">${extractedTasks.length} 项</span></div>
        <div class="task-list">${extractedTasks.length ? extractedTasks.map(a => task(a.text, `${a.owner || "未指定"} · ${a.due || "待确认"}`, a.project)).join("") : `<div class="empty" style="padding:24px 10px">暂无待办</div>`}</div>
      </div>
    </div>
    <div class="card recent-card">
      <div class="card-head"><div><h2>最近录音</h2><p>按录制时间排序</p></div><button class="text-button" data-page="recordings">全部录音 →</button></div>
      <div class="record-list">${state.recordings.length ? state.recordings.slice(0, 5).map(recordRow).join("") : `<div class="empty"><div class="icon-wrap">${icon("mic",24)}</div><h2>还没有录音</h2><p>上传文件后会在这里显示处理进度。</p></div>`}</div>
    </div>`;
}

function metric(iconName, label, value, foot, delta, tint) {
  return `<div class="metric-card" style="--tint:${tint}"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon(iconName,16)}</span></div><div class="metric-number">${value}</div><div class="metric-foot"><span class="up">${delta}</span><span>${foot}</span></div></div>`;
}

function task(title, date, project) {
  return `<div class="task-row"><span class="task-check">${icon("check",14)}</span><div><strong>${title}</strong><small>${project}</small></div><small>${date}</small></div>`;
}

function recordRow(r, table = false) {
  return `<div class="record-row" data-record-id="${r.id}" role="button" tabindex="0">
    <div class="record-icon">${icon(r.status === "processing" ? "clock" : "mic", 18)}</div>
    <div><div class="record-title">${escapeHTML(r.title)}</div><div class="record-meta">${r.date} ${r.time} · ${r.duration} · ${r.participants?.join("、") || "未标注人员"}</div></div>
    <div><span class="tag">${r.type}</span></div>
    ${table ? `<div class="muted" style="font-size:11px">${r.project}</div>` : ""}
    <div class="muted" style="font-size:11px">${r.provider}</div>
    <div><span class="status ${r.status}">${statusLabel(r.status)}</span></div>
    <button class="text-button" aria-label="打开录音">${icon("arrow",15)}</button>
  </div>`;
}

function renderRecordings() {
  return `
    ${pageHead("Recordings", "录音", "统一管理原始录音、转写任务与审核状态。")}
    <div class="toolbar">
      <input class="field" id="record-filter" placeholder="搜索标题、人员或标签" />
      <select class="select" id="type-filter"><option value="">全部类型</option>${[...new Set(state.recordings.map(r => r.type))].map(t => `<option>${t}</option>`).join("")}</select>
      <select class="select" id="status-filter"><option value="">全部状态</option><option value="complete">已完成</option><option value="review">待审核</option><option value="processing">处理中</option></select>
      <span class="spacer"></span><button class="button secondary">${icon("filter")} 更多筛选</button>
    </div>
    <div class="card table-card">
      <div class="table-head"><span></span><span>录音</span><span>类型</span><span>项目</span><span>转写服务</span><span>状态</span><span></span></div>
      <div id="record-table">${state.recordings.map(r => recordRow(r, true)).join("")}</div>
    </div>`;
}

function renderDocuments() {
  const docs = state.recordings.filter(r => (r.status === "review" || r.status === "complete") && (r.transcript?.length || r.optimizedText));
  return `
    ${pageHead("Documents", "知识文档", "按日期和类型沉淀录音中的决定、事实与待办。")}
    <div class="toolbar"><button class="button soft">全部文档 · ${docs.length}</button><button class="button secondary">会议纪要</button><button class="button secondary">客户沟通</button><button class="button secondary">个人笔记</button><span class="spacer"></span><select class="select"><option>按日期排序</option><option>按最近更新</option></select></div>
    <div class="grid documents-grid">
      ${docs.map(r => `<article class="card doc-card" data-day="${r.date.slice(-2)}" data-record-id="${r.id}" role="button" tabindex="0">
        <span class="doc-type">${r.type}</span><h2>${escapeHTML(r.title)}</h2><p>${escapeHTML(r.summary)}</p>
        <div>${r.tags.map(t => `<span class="tag"># ${t}</span>`).join("")}</div>
        <footer class="doc-footer"><span>${r.date} · ${r.duration}</span><span>${r.status === "review" ? "待审核" : "已审核"} ${icon("arrow",13)}</span></footer>
      </article>`).join("")}
    </div>`;
}

function renderSearch() {
  const q = state.searchQuery.trim();
  const results = q ? searchRecords(q) : [];
  return `
    <div class="search-hero">
      <div class="eyebrow">Search & Ask</div><h1>从每一段声音里，找到准确答案。</h1><p>支持关键词、自然语言问题和多条件筛选；答案都能回到原始录音。</p>
      <form class="ask-box" id="ask-form"><input name="q" value="${escapeAttr(q)}" placeholder="例如：客户对数据权限提出了哪些要求？" autofocus/><button class="button primary" style="background:#17483c">${icon("spark")} 检索</button></form>
      <div class="suggestions"><button class="suggestion">本周有哪些待办？</button><button class="suggestion">客户对权限提出了什么要求？</button><button class="suggestion">关于转写供应商的决定</button></div>
    </div>
    <div class="search-results">
      ${!q ? renderSearchIntro() : renderSearchResults(q, results)}
    </div>`;
}

function renderSearchIntro() {
  return `<div class="grid metrics" style="margin-top:20px">
    ${metric("search", "已索引片段", state.recordings.reduce((n,r)=>n+r.transcript.length,0), "覆盖全部已完成录音", "100%", "#dfeee5")}
    ${metric("users", "已识别人员", new Set(state.recordings.flatMap(r=>r.participants)).size, "支持人员筛选", "可修订", "#e5ebf2")}
    ${metric("tag", "知识标签", new Set(state.recordings.flatMap(r=>r.tags)).size, "项目与主题标签", "自动提取", "#f7ead0")}
    ${metric("link", "可追溯引用", "100%", "结论与原文关联", "句级", "#f5dfda")}
  </div>`;
}

function searchRecords(query) {
  const normalized = query.toLowerCase().replace(/[，。？！、；：]/g, " ");
  const chunks = normalized.split(/\s+/).filter(Boolean);
  const stripped = normalized.replace(/哪些|什么|关于|提出|要求|本周|如何|是否|请问|一个|这个|那个|[的了有吗呢是对与和在]/g, "").replace(/\s+/g, "");
  const chineseBigrams = [...stripped].slice(0, -1).map((char, index) => char + stripped[index + 1]);
  const terms = [...new Set([...chunks.filter(t => t.length > 1), ...chineseBigrams.filter(t => t.length > 1)])];
  const scored = [];
  for (const r of state.recordings) {
    for (const seg of r.transcript) {
      const knowledgeText = Object.values(r.knowledge?.sections || {}).join(" ");
      const haystack = `${r.title} ${r.summary} ${r.optimizedText || ""} ${knowledgeText} ${r.tags.join(" ")} ${r.participants.join(" ")} ${seg.text}`.toLowerCase();
      const score = terms.reduce((n, term) => n + (haystack.includes(term) ? 2 : 0), 0) + (haystack.includes(query.toLowerCase()) ? 5 : 0);
      if (score > 0) scored.push({ r, seg, score });
    }
  }
  return scored.sort((a,b)=>b.score-a.score).slice(0,8);
}

function renderSearchResults(q, results) {
  if (!results.length) return `<div class="card empty"><div class="icon-wrap">${icon("search",24)}</div><h2>没有找到直接证据</h2><p>试试缩短问题、使用人名/项目名，或先上传并完成更多录音。</p></div>`;
  const unique = [...new Map(results.map(x => [x.r.id, x.r])).values()];
  const answer = unique.map(r => r.summary).slice(0,2).join(" ");
  return `<div class="card answer-card"><div class="card-head"><div><div class="eyebrow">证据综合</div><h2>基于 ${unique.length} 条录音的回答</h2></div><span class="status complete">可追溯</span></div><p class="answer-text">${highlight(escapeHTML(answer), q)}</p><div>${results.slice(0,3).map(x => `<button class="citation" data-record-id="${x.r.id}">${icon("play",12)} ${x.r.title} · ${x.seg.at}</button>`).join("")}</div></div>
  <div class="card" style="margin-top:16px"><div class="card-head"><div><h2>相关原文</h2><p>${results.length} 个片段</p></div></div>${results.map(x => `<div class="result-item" data-record-id="${x.r.id}" role="button" tabindex="0"><span class="timecode">${x.seg.at}</span><div><h3>${x.r.title}</h3><p class="muted" style="font-size:12px;line-height:1.75">${highlight(escapeHTML(x.seg.text), q)}</p><span class="tag">${x.seg.speaker}</span><span class="tag">${x.r.date}</span></div><span>${icon("arrow")}</span></div>`).join("")}</div>`;
}

function highlight(text, q) {
  const term = q.split(/[\s，。？、]+/).find(t => t.length > 1);
  if (!term) return text;
  return text.replace(new RegExp(escapeRegExp(term), "gi"), m => `<mark>${m}</mark>`);
}

function renderLab() {
  const config = state.modelConfig;
  return `
    ${pageHead("Model Configuration", "模型配置", "录音离线转写与知识整理模型分开配置，避免绑定具体厂商。")}
    <div class="grid provider-grid">
      <div class="card provider-card"><div class="provider-logo" style="--provider:#17483c">本</div><span class="status complete provider-status">可用</span><h2>语音转文字</h2><p class="muted" style="font-size:11px">本地 Whisper · small</p><div class="provider-stats"><div><strong>离线</strong><span>数据位置</span></div><div><strong>已验证</strong><span>运行状态</span></div><div><strong>0元</strong><span>调用成本</span></div></div></div>
      <div class="card provider-card"><div class="provider-logo" style="--provider:#246b58">文</div><span class="status ${config.apiKeyConfigured ? "complete" : "review"} provider-status">${config.apiKeyConfigured ? "已配置" : "待配置"}</span><h2>知识整理模型</h2><p class="muted" style="font-size:11px">${escapeHTML(config.model || "通用 Chat Completions 接口")}</p><div class="provider-stats"><div><strong>通用</strong><span>接口协议</span></div><div><strong>${config.apiKeyConfigured ? "已加密" : "未配置"}</strong><span>API Key</span></div><div><strong>可更换</strong><span>模型</span></div></div><button class="button secondary" data-action="provider-config">${icon("settings")} 配置模型</button></div>
    </div>`;
}

function renderScoreTable(running = false) {
  if (running) return `<div class="empty"><div class="icon-wrap">${icon("clock",24)}</div><h2>正在创建三家并行任务…</h2><p>演示模式将在短暂等待后展示归一化结果。</p></div>`;
  return `<div class="empty"><div class="icon-wrap">${icon("flask",24)}</div><h2>暂无真实对比结果</h2><p>本地 Whisper 已可使用；配置国内云服务凭证后，同一录音可运行多引擎对比。</p></div>`;
}

function renderSettings() {
  return `
    ${pageHead("Settings", "系统设置", "管理模型接口、知识规则与数据保留策略。", false)}
    <div class="grid settings-layout">
      <div class="card settings-nav">${[["providers","模型配置"],["dictionary","热词词典"],["documents","文档类型"],["privacy","数据与隐私"]].map(([id,label])=>`<button class="${state.settingsTab===id?"active":""}" data-setting-tab="${id}">${label}</button>`).join("")}</div>
      <div class="card" id="settings-content">${renderSettingsContent()}</div>
    </div>`;
}

function renderSettingsContent() {
  if (state.settingsTab === "providers") { const config = state.modelConfig; return `<div class="card-head"><div><h2>通用知识整理模型</h2><p>支持标准 Chat Completions 接口，可随时更换 Base URL 和模型。</p></div><span class="status ${config.apiKeyConfigured ? "complete" : "review"}">${config.apiKeyConfigured ? "已配置" : "待配置"}</span></div>
    <div class="form-grid model-config-form"><div class="form-group full"><label>Base URL</label><input id="model-base-url" value="${escapeAttr(config.baseUrl || "")}" placeholder="https://example.com/v1"/></div><div class="form-group full"><label>Model</label><input id="model-name" value="${escapeAttr(config.model || "")}" placeholder="模型名称"/></div><div class="form-group full"><label>API Key</label><input id="model-api-key" type="password" autocomplete="new-password" placeholder="${config.apiKeyConfigured ? "已加密保存；留空表示不更换" : "请输入 API Key"}"/></div></div>
    <div class="setting-row"><div><h3>密钥保护</h3><p>API Key 使用 Windows 当前用户 DPAPI 加密，只能由当前 Windows 用户在本机解密；前端不会回显明文。</p></div><span class="status complete">本机加密</span></div>
    <div class="modal-actions"><button class="button secondary" data-action="test-model-config">连通性测试</button><button class="button primary" data-action="save-model-config">保存配置</button></div>`; }
  if (state.settingsTab === "dictionary") return `<div class="card-head"><div><h2>热词与术语</h2><p>提高人名、项目名和行业词汇识别率。</p></div><button class="button primary">新增词表</button></div><div class="setting-row"><div><h3>丰图FDE项目词表</h3><p>12个词 · 更新于今天</p></div><div>${["丰图","FDE","对象存储","向量检索","说话人分离"].map(t=>`<span class="tag">${t}</span>`).join("")}</div></div><div class="setting-row"><div><h3>客户与人员</h3><p>8个词 · 自动同步已确认人名</p></div><div>${["陈明","刘洋","王晓","客户A"].map(t=>`<span class="tag">${t}</span>`).join("")}</div></div>`;
  if (state.settingsTab === "documents") return `<div class="card-head"><div><h2>文档类型</h2><p>六种录音类型均使用独立知识整理模板。</p></div><span class="status complete">6 个模板已启用</span></div>${DOCUMENT_TYPES.map(type=>`<div class="setting-row"><div><h3>${type}</h3><p>${KNOWLEDGE_TEMPLATES[type].description}</p></div><div style="text-align:right"><span class="status complete">专用模板</span></div></div>`).join("")}`;
  return `<div class="card-head"><div><h2>数据与隐私</h2><p>控制本地数据、模型处理和保留期限。</p></div>${icon("shield",24)}</div><div class="setting-row"><div><h3>当前存储位置</h3><p>原始录音和转写数据均保存在工程目录的 data 文件夹。</p></div><code>data/uploads</code></div><div class="setting-row"><div><h3>录音转写</h3><p>本地 Whisper 离线处理，原始录音不会发送到第三方。</p></div><span class="status complete">本机离线</span></div><div class="setting-row"><div><h3>知识整理</h3><p>只有点击“重新整理/重新提炼”时，逐字稿文本才会发送到你配置的模型接口；原始音频不会上传。</p></div><span class="status review">按需调用</span></div><div class="setting-row"><div><h3>删除策略</h3><p>录音详情页的删除操作会同步删除原始音频和转写结果，且不可恢复。</p></div><span class="status complete">已启用</span></div>`;
}

function renderDetail() {
  const r = state.recordings.find(x => x.id === state.selectedId) || state.recordings[0];
  if (!r) return `<div class="empty"><div class="icon-wrap">${icon("mic",24)}</div><h2>录音不存在</h2><button class="button secondary" data-page="recordings">返回录音列表</button></div>`;
  const waves = Array.from({length: 95}, (_,i)=>`<i style="height:${14 + ((i*17)%46)}px"></i>`).join("");
  return `
    <div class="page-head"><div><button class="text-button" data-page="recordings">← 返回录音</button><div class="eyebrow" style="margin-top:16px">${r.type} · ${r.date}</div><h1>${escapeHTML(r.title)}</h1><p>${(r.participants || []).join("、") || "未标注人员"} · ${r.duration} · ${r.provider}</p></div><div class="detail-actions"><button class="button secondary" data-action="edit-record">${icon("edit")} 编辑信息</button><button class="button danger" data-action="delete-record">删除录音</button></div></div>
    <div class="grid detail-layout">
      <div>
        <div class="audio-player"><div style="display:flex;justify-content:space-between"><strong>原始录音</strong><span class="status ${r.status}">${statusLabel(r.status)}</span></div><div class="waveform">${waves}</div><audio id="audio-player" controls preload="metadata"></audio><div id="audio-note" style="font-size:10px;color:rgba(255,255,255,.58);margin-top:8px">原始文件保存在本机工程数据目录中。</div></div>
        <div class="content-tabs" role="tablist">
          ${contentTab("transcript", "逐字稿", groupTranscript(r.transcript || []).length)}
          ${contentTab("optimized", "优化整理稿")}
          ${contentTab("knowledge", "知识整理")}
        </div>
        ${renderDetailModule(r)}
      </div>
      <aside class="card">
        <div class="card-head"><div><div class="eyebrow">Recording</div><h2>录音信息</h2></div><span class="status ${r.status}">${statusLabel(r.status)}</span></div>
        <div class="metadata-list"><div><span>项目</span><strong>${escapeHTML(r.project || "未归档")}</strong></div><div><span>人员</span><strong>${escapeHTML((r.participants || []).join("、") || "未标注")}</strong></div><div><span>类型</span><strong>${escapeHTML(r.type)}</strong></div><div><span>录制时间</span><strong>${r.date} ${r.time}</strong></div><div><span>文件大小</span><strong>${formatSize(r.size)}</strong></div><div><span>转写工具</span><strong>${escapeHTML(r.provider)}</strong></div></div>
        ${(r.status === "uploaded" || r.status === "failed") ? `<button class="button primary" style="width:100%;margin-top:18px" data-action="start-transcription">${icon("spark")} ${r.status === "failed" ? "重新" : "开始"}真实转写</button>` : ""}
        ${r.error ? `<div class="error-box">${escapeHTML(r.error)}</div>` : ""}
      </aside>
    </div>`;
}

function contentTab(id, label, count = null) {
  return `<button class="content-tab ${state.detailTab === id ? "active" : ""}" data-detail-tab="${id}" role="tab">${label}${count !== null ? `<span>${count}</span>` : ""}</button>`;
}

function renderDetailModule(r) {
  if (state.detailTab === "optimized") return `<div class="card transcript"><div class="card-head"><div><h2>优化整理稿</h2><p>删除语气词、相邻重复和冗余口语，整理成相对规范的书面段落；不会覆盖逐字稿。</p></div><div class="card-actions"><button class="button secondary" data-action="regenerate-organization">${icon("spark")} 重新整理</button><button class="button primary" data-action="save-optimized">保存整理稿</button></div></div><textarea class="editor-area" id="optimized-text" placeholder="转写完成后自动生成，也可以继续人工编辑。">${escapeHTML(r.optimizedText || "")}</textarea></div>`;
  if (state.detailTab === "knowledge") {
    const type = DOCUMENT_TYPES.includes(r.type) ? r.type : "其他";
    const template = KNOWLEDGE_TEMPLATES[type];
    const knowledge = r.knowledge?.templateType === type && r.knowledge?.sections ? r.knowledge : deriveKnowledge(r);
    const fields = template.fields.map(([key,label,rows]) => `<label>${label}<textarea data-knowledge-key="${key}" rows="${rows}">${escapeHTML(knowledge.sections[key] || "")}</textarea></label>`).join("");
    return `<div class="card transcript"><div class="card-head"><div><div class="template-badge">${type}模板</div><h2>知识整理</h2><p>${template.description}</p></div><div class="card-actions"><button class="button secondary" data-action="regenerate-organization">${icon("spark")} 重新提炼</button><button class="button primary" data-action="save-knowledge">保存知识整理</button></div></div><div class="knowledge-form">${fields}</div></div>`;
  }
  const grouped = groupTranscript(r.transcript || []);
  return `<div class="card transcript"><div class="card-head"><div><h2>逐字稿</h2><p>${grouped.length} 个连续说话段 · 同一说话人的相邻片段已合并，长发言仅在同一段内分段阅读</p></div><span class="status ${r.status}">${statusLabel(r.status)}</span></div>${grouped.length ? grouped.map(s=>`<div class="segment" data-seconds="${s.seconds}" role="button" tabindex="0"><div><span class="segment-speaker">${escapeHTML(s.speaker)}</span><span class="segment-time">${s.at}${s.endAt && s.endAt !== s.at ? `—${s.endAt}` : ""}</span></div><div class="segment-copy">${transcriptParagraphs(s).map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join("")}</div></div>`).join("") : `<div class="empty"><div class="icon-wrap">${icon(r.status === "failed" ? "x" : "clock",24)}</div><h2>${r.status === "failed" ? "转写失败" : r.status === "uploaded" ? "尚未开始转写" : "真实转写处理中"}</h2><p>${r.status === "processing" ? "本地模型已就绪，正在离线转写；完成后会自动刷新。" : "可在右侧启动或重新运行本地转写。"}</p></div>`}</div>`;
}

function attachPageEnhancements() {
  if (state.page === "detail") loadDetailAudio();
  if (state.page === "recordings") {
    const applyFilters = () => {
      const q = $("#record-filter").value.toLowerCase();
      const type = $("#type-filter").value;
      const status = $("#status-filter").value;
      $("#record-table").innerHTML = state.recordings.filter(r => (!q || `${r.title} ${r.tags.join(" ")} ${r.participants.join(" ")}`.toLowerCase().includes(q)) && (!type || r.type === type) && (!status || r.status === status)).map(r=>recordRow(r,true)).join("") || `<div class="empty">没有符合条件的录音</div>`;
    };
    ["#record-filter", "#type-filter", "#status-filter"].forEach(s => $(s)?.addEventListener("input", applyFilters));
  }
}

async function loadDetailAudio() {
  const player = $("#audio-player");
  if (!player || !state.selectedId) return;
  player.src = `/api/recordings/${state.selectedId}/audio`;
}

function openUploadModal() {
  state.pendingFiles = [];
  const today = new Date().toISOString().slice(0,10);
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.id = "upload-modal";
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><div class="modal-head"><div><div class="eyebrow">New Recording</div><h2 id="upload-title">上传手机录音</h2><p class="muted" style="font-size:12px">从鸿蒙电脑可访问的手机目录直接拖入，支持批量文件。</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon("x")}</button></div>
    <label class="drop-zone" id="drop-zone"><input type="file" id="file-input" accept="audio/*,.m4a,.mp3,.wav,.aac,.flac,.ogg,.mp4" multiple/><div class="drop-icon">${icon("upload",24)}</div><strong>拖拽录音到这里</strong><p class="muted" style="font-size:11px;margin:7px 0 0">或点击选择文件 · M4A / MP3 / WAV / AAC / FLAC / OGG</p></label>
    <div class="pending-files" id="pending-files"></div>
    <div class="form-grid">
      <div class="form-group"><label>录制日期</label><input id="upload-date" type="date" value="${today}"/></div>
      <div class="form-group"><label>文档类型</label><select id="upload-type">${documentTypeOptions("会议纪要")}</select></div>
      <div class="form-group"><label>项目</label><input id="upload-project" value="丰图FDE" placeholder="项目或主题"/></div>
      <div class="form-group"><label>转写方式</label><select id="upload-provider"><option value="local">本地 Whisper（离线）</option></select></div>
      <div class="form-group full"><label>参与人 / 标签（可稍后补充）</label><input id="upload-note" placeholder="例如：陈明、刘洋；接口、测试"/></div>
    </div>
    <div class="modal-actions"><button class="button secondary" data-action="close-modal">取消</button><button class="button primary" id="submit-upload" disabled>${icon("upload")} 上传并处理</button></div></div>`;
  document.body.append(wrap);
  const input = $("#file-input");
  const drop = $("#drop-zone");
  input.addEventListener("change", () => setPendingFiles([...input.files]));
  ["dragenter","dragover"].forEach(e => drop.addEventListener(e, event => { event.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave","drop"].forEach(e => drop.addEventListener(e, event => { event.preventDefault(); drop.classList.remove("dragging"); }));
  drop.addEventListener("drop", event => setPendingFiles([...event.dataTransfer.files]));
  $("#submit-upload").addEventListener("click", processUploads);
}

function setPendingFiles(files) {
  const allowed = /\.(m4a|mp3|wav|aac|flac|ogg|mp4)$/i;
  state.pendingFiles = files.filter(f => f.type.startsWith("audio/") || allowed.test(f.name)).slice(0,20);
  $("#pending-files").innerHTML = state.pendingFiles.map(f => `<div class="pending-file"><span class="record-icon" style="width:32px;height:32px">${icon("mic",14)}</span><div><strong>${escapeHTML(f.name)}</strong><div class="muted">${formatSize(f.size)}</div></div><span class="status complete">可上传</span></div>`).join("");
  $("#submit-upload").disabled = !state.pendingFiles.length;
  if (files.length && !state.pendingFiles.length) toast("请选择支持的音频文件");
}

async function processUploads() {
  const button = $("#submit-upload");
  button.disabled = true;
  button.innerHTML = `${icon("clock")} 正在保存…`;
  try {
  const date = $("#upload-date").value;
  const type = $("#upload-type").value;
  const project = $("#upload-project").value || "未归档";
  const providerChoice = $("#upload-provider").value;
  const added = [];
  for (const file of state.pendingFiles) {
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    const response = await fetch("/api/recordings", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-Title": encodeURIComponent(title),
        "X-Recorded-Date": encodeURIComponent(date),
        "X-Recorded-Time": encodeURIComponent(new Date().toTimeString().slice(0,5)),
        "X-Document-Type": encodeURIComponent(type),
        "X-Project": encodeURIComponent(project)
      },
      body: file
    });
    if (!response.ok) throw new Error((await response.json()).error || `上传 ${file.name} 失败`);
    const record = await response.json();
    added.push(record);
    if (providerChoice === "local") await fetch(`/api/recordings/${record.id}/transcribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "small", language: "zh" }) });
  }
  await refreshRecordings(false);
  $("#upload-modal").remove();
  state.page = "recordings";
  renderShell();
  toast(`已保存 ${added.length} 个录音，真实离线转写已开始`);
  } catch (error) {
    button.disabled = false;
    button.innerHTML = `${icon("upload")} 重试上传`;
    toast(error.message || "上传失败");
  }
}

async function refreshRecordings(render = true) {
  const response = await fetch("/api/recordings", { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取录音数据");
  state.recordings = await response.json();
  state.serverAvailable = true;
  if (state.selectedId && !state.recordings.some(r => r.id === state.selectedId)) state.selectedId = state.recordings[0]?.id || null;
  if (render) renderShell();
}

async function refreshModelConfig(render = false) {
  const response = await fetch("/api/model-config", { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取模型配置");
  state.modelConfig = await response.json();
  if (render) renderShell();
}

async function initialize() {
  try {
    await Promise.all([refreshRecordings(false), refreshModelConfig(false)]);
  } catch {
    state.serverAvailable = false;
    state.recordings = [];
  }
  renderShell();
  setInterval(async () => {
    if (!state.recordings.some(r => r.status === "processing")) return;
    try { await refreshRecordings(true); } catch {}
  }, 4000);
}

function currentModelConfigInput() {
  return {
    baseUrl: $("#model-base-url")?.value.trim() || "",
    model: $("#model-name")?.value.trim() || "",
    apiKey: $("#model-api-key")?.value.trim() || ""
  };
}

async function saveModelConfig() {
  const response = await fetch("/api/model-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentModelConfigInput()) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "保存模型配置失败");
  state.modelConfig = payload;
  renderShell();
  toast("模型配置已加密保存");
}

async function testModelConfig() {
  const button = document.querySelector('[data-action="test-model-config"]');
  if (button) { button.disabled = true; button.textContent = "测试中…"; }
  const response = await fetch("/api/model-config/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentModelConfigInput()) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "模型连接失败");
  if (button) { button.disabled = false; button.textContent = "连通性测试"; }
  toast(`连接成功：${payload.model}`);
}

function openEditRecordModal() {
  const r = state.recordings.find(x => x.id === state.selectedId);
  if (!r) return;
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.id = "edit-record-modal";
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">Metadata</div><h2>修改录音信息</h2><p class="muted" style="font-size:12px">修改人员、项目、类型和录制时间，不改变原始音频。</p></div><button class="icon-button" data-action="close-modal">${icon("x")}</button></div><div class="form-grid"><div class="form-group full"><label>标题</label><input id="edit-title" value="${escapeAttr(r.title)}"/></div><div class="form-group"><label>项目</label><input id="edit-project" value="${escapeAttr(r.project || "")}"/></div><div class="form-group"><label>人员（顿号或逗号分隔）</label><input id="edit-participants" value="${escapeAttr((r.participants || []).join("、"))}"/></div><div class="form-group"><label>文档类型</label><select id="edit-type">${documentTypeOptions(r.type)}</select></div><div class="form-group"><label>标签（顿号或逗号分隔）</label><input id="edit-tags" value="${escapeAttr((r.tags || []).join("、"))}"/></div><div class="form-group"><label>录制日期</label><input id="edit-date" type="date" value="${r.date}"/></div><div class="form-group"><label>录制时间</label><input id="edit-time" type="time" value="${r.time}"/></div></div><div class="modal-actions"><button class="button secondary" data-action="close-modal">取消</button><button class="button primary" data-action="save-record-metadata">保存修改</button></div></div>`;
  document.body.append(wrap);
}

async function patchSelectedRecord(payload) {
  const response = await fetch(`/api/recordings/${state.selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error((await response.json()).error || "保存失败");
  await refreshRecordings(false);
  renderShell();
}

async function saveRecordMetadata() {
  const split = value => value.split(/[、,，]/).map(x=>x.trim()).filter(Boolean);
  await patchSelectedRecord({ title: $("#edit-title").value.trim(), project: $("#edit-project").value.trim(), participants: split($("#edit-participants").value), type: $("#edit-type").value, tags: split($("#edit-tags").value), date: $("#edit-date").value, time: $("#edit-time").value });
  $("#edit-record-modal")?.remove();
  toast("录音信息已保存");
}

async function saveOptimizedText() {
  await patchSelectedRecord({ optimizedText: $("#optimized-text").value });
  toast("优化整理稿已保存");
}

async function saveKnowledge() {
  const record = state.recordings.find(r => r.id === state.selectedId);
  if (!record) return;
  const sections = Object.fromEntries($$("[data-knowledge-key]").map(field => [field.dataset.knowledgeKey, field.value.trim()]));
  const firstValue = Object.values(sections).find(Boolean) || "";
  const decisionsText = sections.decisions || sections.conclusions || sections.solution || "";
  const actionsText = sections.actions || sections.followUp || sections.nextSteps || sections.possibleActions || "";
  const decisions = decisionsText.split(/\n+/).map(line => line.replace(/^-\s*/, "").trim()).filter(Boolean);
  const actions = actionsText.split(/\n+/).map(line => { const [text, owner, due] = line.replace(/^-\s*/, "").split("｜").map(x => x.trim()); return { text, owner: owner || "", due: due || "" }; }).filter(item => item.text);
  await patchSelectedRecord({ knowledge: { templateType: DOCUMENT_TYPES.includes(record.type) ? record.type : "其他", sections }, summary: firstValue, decisions, actions });
  toast("知识整理已保存");
}

async function regenerateOrganization() {
  const record = state.recordings.find(r => r.id === state.selectedId);
  if (!record?.transcript?.length) { toast("请先完成逐字稿转写"); return; }
  const button = document.querySelector('[data-action="regenerate-organization"]');
  if (button) { button.disabled = true; button.innerHTML = `${icon("clock")} 大模型整理中…`; }
  toast("正在调用大模型整理完整逐字稿，长录音可能需要一两分钟");
  const response = await fetch(`/api/recordings/${state.selectedId}/organize`, { method: "POST" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "大模型整理失败");
  await refreshRecordings(false);
  renderShell();
  toast("优化整理稿和对应类型的知识模板已生成");
}

async function startSelectedTranscription() {
  const response = await fetch(`/api/recordings/${state.selectedId}/transcribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "small", language: "zh" }) });
  if (!response.ok) throw new Error((await response.json()).error || "无法启动转写");
  await refreshRecordings(false); renderShell(); toast("真实离线转写已启动");
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[c]);
}
function escapeAttr(value = "") { return escapeHTML(value); }
function escapeRegExp(value = "") { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

document.addEventListener("click", event => {
  const pageTarget = event.target.closest("[data-page]");
  if (pageTarget) { state.page = pageTarget.dataset.page; state.sidebarOpen = false; renderShell(); window.scrollTo(0,0); return; }
  const recordTarget = event.target.closest("[data-record-id]");
  if (recordTarget) { state.selectedId = recordTarget.dataset.recordId; state.page = "detail"; state.detailTab = "transcript"; renderShell(); window.scrollTo(0,0); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "open-upload") openUploadModal();
  if (action === "close-modal") event.target.closest(".modal-backdrop")?.remove();
  if (action === "toggle-menu") { state.sidebarOpen = !state.sidebarOpen; renderShell(); }
  if (action === "provider-config") { state.page = "settings"; state.settingsTab = "providers"; renderShell(); }
  if (action === "save-model-config") saveModelConfig().catch(error => toast(error.message));
  if (action === "test-model-config") testModelConfig().catch(error => { const button = document.querySelector('[data-action="test-model-config"]'); if (button) { button.disabled = false; button.textContent = "连通性测试"; } toast(error.message); });
  if (action === "edit-record") openEditRecordModal();
  if (action === "save-record-metadata") saveRecordMetadata().catch(error => toast(error.message));
  if (action === "save-optimized") saveOptimizedText().catch(error => toast(error.message));
  if (action === "save-knowledge") saveKnowledge().catch(error => toast(error.message));
  if (action === "regenerate-organization") regenerateOrganization().catch(error => toast(error.message));
  if (action === "start-transcription") startSelectedTranscription().catch(error => toast(error.message));
  if (action === "delete-record") {
    const record = state.recordings.find(r => r.id === state.selectedId);
    if (record && confirm(`确定永久删除“${record.title}”及其原始音频、转写结果吗？此操作不可恢复。`)) {
      fetch(`/api/recordings/${record.id}`, { method: "DELETE" }).then(async response => {
        if (!response.ok) throw new Error((await response.json()).error || "删除失败");
        state.selectedId = null; state.page = "recordings"; await refreshRecordings(false); renderShell(); toast("录音已永久删除");
      }).catch(error => toast(error.message));
    }
  }
  const settingTab = event.target.closest("[data-setting-tab]")?.dataset.settingTab;
  if (settingTab) { state.settingsTab = settingTab; renderPage(); }
  const detailTab = event.target.closest("[data-detail-tab]")?.dataset.detailTab;
  if (detailTab) { state.detailTab = detailTab; renderPage(); }
  if (event.target.closest(".switch")) event.target.closest(".switch").classList.toggle("on");
  if (event.target.closest(".segment")) {
    const player = $("#audio-player");
    if (player?.src) { player.currentTime = Number(event.target.closest(".segment").dataset.seconds); player.play(); }
    else toast("演示录音没有音频；上传真实文件后可跳转播放。");
  }
  if (event.target.closest("#run-compare")) {
    $("#compare-results").innerHTML = renderScoreTable(true);
    event.target.closest("#run-compare").disabled = true;
    setTimeout(() => { if ($("#compare-results")) { $("#compare-results").innerHTML = renderScoreTable(); toast("演示对比已完成；指标用于展示界面流程。"); } }, 1500);
  }
  const suggestion = event.target.closest(".suggestion");
  if (suggestion) { state.searchQuery = suggestion.textContent; renderPage(); }
});

document.addEventListener("submit", event => {
  if (event.target.id === "global-search" || event.target.id === "ask-form") {
    event.preventDefault();
    state.searchQuery = new FormData(event.target).get("q")?.toString() || "";
    state.page = "search";
    renderShell();
  }
});

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $(".top-search input")?.focus(); }
  if (event.key === "Escape") $(".modal-backdrop")?.remove();
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[role='button'][data-record-id]")) event.target.click();
});

initialize();
