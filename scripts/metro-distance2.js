// 用固定地铁站坐标集合, 对全部候选小区重算最近地铁口距离(补around API漏返), 合并取最小值
// 输出: scripts/community-metro.json
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';
const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'community-shortlist.json'), 'utf8'));
const old = fs.existsSync(path.join(__dirname, 'community-metro.json'))
  ? JSON.parse(fs.readFileSync(path.join(__dirname, 'community-metro.json'), 'utf8')) : [];
const oldMap = new Map(old.map((x) => [x.family, x]));

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stationNames = ['长港路地铁站', '常青花园地铁站', '金银潭地铁站', '石桥地铁站', '杨汊湖地铁站', '轻工大学地铁站', '汉口火车站地铁站', '唐家墩地铁站'];

(async () => {
  const stations = [];
  for (const n of stationNames) {
    const url = `https://restapi.amap.com/v3/place/text?key=${KEY}&keywords=${encodeURIComponent(n)}&city=420100&citylimit=true&types=150500&offset=3&page=1`;
    let r;
    try { r = await getJson(url); } catch (e) { console.log('station ERR', n, e.message); continue; }
    const p = (r.pois || [])[0];
    if (p && p.location) {
      const [lng, lat] = p.location.split(',').map(Number);
      stations.push({ name: n.replace('地铁站', ''), lng, lat });
      console.log('station', n, '->', lng, lat, p.name);
    }
    await sleep(120);
  }
  const out = list.map((f) => {
    let best = null;
    for (const s of stations) {
      const d = Math.round(haversine(f.lng, f.lat, s.lng, s.lat));
      if (!best || d < best.dist) best = { station: s.name + '地铁站', dist: d };
    }
    const prev = oldMap.get(f.family);
    if (prev && prev.dist < best.dist) best = { station: prev.station, dist: prev.dist };
    return { family: f.family, lng: f.lng, lat: f.lat, station: best.station, dist: best.dist };
  });
  out.sort((a, b) => a.dist - b.dist);
  fs.writeFileSync(path.join(__dirname, 'community-metro.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(`完成: ${out.length}个小区, 1.5km内 ${out.filter((x) => x.dist <= 1500).length}个`);
})();
