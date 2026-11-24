// 单文件打包: 内联三个JSON, 替换fetch为内联读取, 输出到 E:\Coding\school\
// 用法: node scripts/pack-single.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_HTML = path.join(ROOT, 'static', 'quizzes', 'wuhan-thematic-map.html');
const OUT_DIR = 'E:\\Coding\\school';
const OUT_FILE = path.join(OUT_DIR, '武汉专题地图.html');

const kg = fs.readFileSync(path.join(ROOT, 'static', 'quizzes', 'kindergartens.json'), 'utf8');
const cm = fs.readFileSync(path.join(ROOT, 'static', 'quizzes', 'communities.json'), 'utf8');
const bd = fs.readFileSync(path.join(ROOT, 'static', 'quizzes', 'boundary.json'), 'utf8');

let html = fs.readFileSync(SRC_HTML, 'utf8');

// 1) 注入内联数据与加载函数(主业务脚本之前)
const inline = `<script>
        // ===== 单文件打包内联数据(由 scripts/pack-single.js 生成, 勿手改) =====
        window.__INLINE__ = {
            kindergartens: ${kg.trim()},
            communities: ${cm.trim()},
            boundary: ${bd.trim()}
        };
        function loadInline(name) { return Promise.resolve(window.__INLINE__[name]); }
    </script>
    <script>`;
if (!html.includes('window.__INLINE__')) {
  html = html.replace('    <script>\n        var colorMap', inline + '\n        var colorMap');
}

// 2) 三处 fetch(...).then(r=>r.json()).then( 替换为 loadInline(...).then(
const re = /fetch\('(kindergartens|boundary|communities)[^']*'\)\.then\(function\(r\)\s*\{[\s\S]*?return r\.json\(\);\s*\}\)\.then\(function\((\w+)\)\s*\{/g;
let n = 0;
html = html.replace(re, (m, key, arg) => { n++; return `loadInline('${key}').then(function(${arg}) {`; });
if (n !== 3) { console.error('!! fetch替换数异常:', n, '(应为3)'); process.exit(1); }

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, html, 'utf8');
console.log('已生成:', OUT_FILE);
console.log('大小:', (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1), 'KB | fetch替换:', n, '处');
console.log('残留fetch检查:', (html.match(/fetch\('/g) || []).length, '处(应为0)');
