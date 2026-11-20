// 拉取30所园所周边1km内的住宅小区POI候选清单
// 输出: scripts/community-candidates.json
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';
const ROOT = path.join(__dirname, '..');
const kg = JSON.parse(fs.readFileSync(path.join(ROOT, 'static', 'quizzes', 'kindergartens.json'), 'utf8'));

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normName(s) {
  return s.replace(/[\s·（）()\-—_]/g, '').toLowerCase();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const store = new Map(); // normName -> record
  let calls = 0;
  for (const k of kg) {
    const loc = k.lng + ',' + k.lat;
    for (let page = 1; page <= 2; page++) {
      const url = `https://restapi.amap.com/v3/place/around?key=${KEY}&location=${loc}&radius=1000&types=120000&offset=25&page=${page}&city=420100&extensions=all`;
      let r;
      try { r = await getJson(url); } catch (e) { console.log('ERR', k.name, e.message); break; }
      calls++;
      const pois = r.pois || [];
      if (pois.length === 0) break;
      for (const p of pois) {
        const tn = p.type || '';
        if (!tn.includes('住宅')) continue; // 保留 住宅小区/住宅区/公寓 等
        if (/酒店|宾馆|招待所|宿舍|停车场|公交|地铁|售楼/.test(p.name)) continue;
        const [plng, plat] = p.location.split(',').map(Number);
        if (!plng || !plat) continue;
        const clean = p.name.replace(/\(.*?\)|（.*?）/g, '').trim();
        const id = normName(clean);
        const dist = haversine(k.lng, k.lat, plng, plat);
        if (dist > 1100) continue; // 高德radius略宽，收紧
        if (!store.has(id)) {
          store.set(id, {
            name: clean,
            amapName: p.name,
            address: p.address || '',
            typename: tn.split(';').pop(),
            lng: plng, lat: plat,
            minDist: Math.round(dist),
            kindergartens: []
          });
        }
        const rec = store.get(id);
        if (dist < rec.minDist) { rec.minDist = Math.round(dist); }
        if (dist <= 1000) rec.kindergartens.push(k.name);
      }
      if (pois.length < 25) break;
      await sleep(120);
    }
    await sleep(120);
  }
  const list = [...store.values()].sort((a, b) => a.minDist - b.minDist);
  for (const c of list) c.kindergartens = [...new Set(c.kindergartens)];
  fs.writeFileSync(path.join(__dirname, 'community-candidates.json'), JSON.stringify(list, null, 1), 'utf8');
  console.log('候选小区数:', list.length, '| API调用:', calls);
  console.log(list.slice(0, 40).map((c) => `${c.name}(${c.minDist}m,近${c.kindergartens.length}所)`).join(' / '));
})();
