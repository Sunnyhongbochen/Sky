// 计算全部候选小区族到最近地铁口距离
// 输出: scripts/community-metro.json [{family, station, dist, lng, lat}]
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';
const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'community-shortlist.json'), 'utf8'));

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

(async () => {
  const out = [];
  let i = 0;
  for (const f of list) {
    i++;
    const url = `https://restapi.amap.com/v3/place/around?key=${KEY}&location=${f.lng},${f.lat}&radius=1600&types=150500&offset=10&page=1&city=420100`;
    let r;
    try { r = await getJson(url); } catch (e) { console.log('ERR', f.family, e.message); continue; }
    const pois = (r.pois || []).filter((p) => p.location);
    let best = null;
    for (const p of pois) {
      const [plng, plat] = p.location.split(',').map(Number);
      const d = Math.round(haversine(f.lng, f.lat, plng, plat));
      if (!best || d < best.dist) best = { station: p.name.replace(/\(.*?\)|（.*?）/g, ''), dist: d };
    }
    out.push({ family: f.family, lng: f.lng, lat: f.lat, station: best ? best.station : null, dist: best ? best.dist : 99999 });
    if (i % 30 === 0) console.log(`进度 ${i}/${list.length}`);
    await sleep(110);
  }
  out.sort((a, b) => a.dist - b.dist);
  fs.writeFileSync(path.join(__dirname, 'community-metro.json'), JSON.stringify(out, null, 1), 'utf8');
  const inRange = out.filter((x) => x.dist <= 1500).length;
  console.log(`完成: ${out.length}个小区, 1.5km内有地铁口 ${inRange}个`);
})();
