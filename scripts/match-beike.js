// 贝壳"2010年后建成"名单 ∩ 候选小区族 -> 待入库清单
// 用法: node scripts/match-beike.js <beike.json路径>   (格式: [{"name":"..","year":"2015"},...])
const fs = require('fs');
const path = require('path');

const beikeFile = process.argv[2];
if (!beikeFile || !fs.existsSync(beikeFile)) { console.log('用法: node match-beike.js <beike.json>'); process.exit(1); }
const beike = JSON.parse(fs.readFileSync(beikeFile, 'utf8'));
const short = JSON.parse(fs.readFileSync(path.join(__dirname, 'community-shortlist.json'), 'utf8'));

function norm(s) {
  return (s || '').replace(/[\s·\-—_（）()]/g, '')
    .replace(/(一期|二期|三期|四期|五期|六期|[0-9]期)$/g, '').toLowerCase();
}
// 常见前缀/后缀噪音
function loose(s) {
  return norm(s).replace(/^(武汉|武汉城建|武汉城投|福星惠誉|金融街|万科|保利|新世界|金地|融创|绿城|远洋|信达|华发)/, '')
    .replace(/(小区|住宅小区|社区|花园小区)$/g, '');
}
const bmap = new Map();
for (const b of beike) {
  if (!b.name) continue;
  const n = norm(b.name), l = loose(b.name);
  if (!bmap.has(n)) bmap.set(n, b);
  if (!bmap.has(l)) bmap.set(l, b);
}

const matched = [];
const unmatched = [];
for (const f of short) {
  const n = norm(f.family), l = loose(f.family);
  let hit = bmap.get(n) || bmap.get(l);
  if (!hit) { // 包含匹配(双向, 长度>=4)
    for (const [key, b] of bmap) {
      if (key.length >= 4 && (n.includes(key) || key.includes(n))) { hit = b; break; }
    }
  }
  if (hit) matched.push({ family: f.family, beikeName: hit.name, year: hit.year, minDist: f.minDist, nearKg: f.kindergartens.length, address: f.address, variants: f.variants, hasApartmentVariant: f.hasApartmentVariant });
  else unmatched.push(f);
}

matched.sort((a, b) => a.minDist - b.minDist);
console.log('=== 交集(2010年后建成,按最近园所距离) ===');
console.log(matched.map((m) => `${m.family} [贝壳:${m.beikeName}|${m.year}] ${m.minDist}m 近${m.nearKg}所`).join('\n'));
console.log(`\n交集 ${matched.length} / 短名单 ${short.length} / 贝壳 ${beike.length}`);
console.log('\n=== 未匹配(前80, 按距离) 需二次核查 ===');
console.log(unmatched.slice(0, 80).map((f) => `${f.family}(${f.minDist}m,近${f.kindergartens.length}所)`).join(' / '));
fs.writeFileSync(path.join(__dirname, 'beike-matched.json'), JSON.stringify(matched, null, 1), 'utf8');
fs.writeFileSync(path.join(__dirname, 'beike-unmatched.json'), JSON.stringify(unmatched.map((f) => ({ family: f.family, minDist: f.minDist, address: f.address, variants: f.variants, nearKg: f.kindergartens })), null, 1), 'utf8');
