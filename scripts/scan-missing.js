// 扫查江汉区全部幼儿园 POI，与现有名单对比，判定遗漏园的街道归属
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';
const DATA = path.join(__dirname, '..', 'static', 'quizzes', 'kindergartens.json');

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function norm(s) {
  return (s || '').replace(/武汉市|江汉区|幼儿园|园|（|）|\(|\)|\s/g, '');
}

(async () => {
  const known = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const knownNorm = new Set(known.map(k => norm(k.name)));

  // 1) 拉全量江汉区幼儿园 POI (types=141204, city=420103)
  let all = [];
  for (let page = 1; page <= 4; page++) {
    const r = await get(`https://restapi.amap.com/v3/place/text?types=141204&city=420103&key=${KEY}&offset=25&page=${page}`);
    if (r.status !== '1' || !r.pois || !r.pois.length) break;
    all = all.concat(r.pois);
    await sleep(350);
  }
  console.log('江汉区幼儿园POI总数:', all.length);

  // 2) 与现有名单对比，找出不在名单中的 POI
  const missing = all.filter(p => {
    const n = norm(p.name);
    // 已知名单任一园名与 POI 名做双向包含匹配
    for (const k of known) {
      const kn = norm(k.name);
      if (n.includes(kn) || kn.includes(n)) return false;
    }
    return true;
  });
  console.log('不在现有名单的POI数:', missing.length);

  // 3) regeo 判定每个遗漏 POI 的街道(township)
  const out = [];
  for (const p of missing) {
    const [lng, lat] = p.location.split(',');
    await sleep(350);
    const rg = await get(`https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${KEY}&extensions=base`);
    const t = rg.regeo && rg.regeo.addressComponent ? rg.regeo.addressComponent.township : '?';
    out.push({ name: p.name, address: Array.isArray(p.address) ? '' : p.address, township: t, tel: Array.isArray(p.tel) ? '' : p.tel, location: p.location, adname: p.adname });
  }
  out.sort((a, b) => (a.township < b.township ? -1 : 1));
  out.forEach(o => console.log(`[${o.township}] ${o.name} | ${o.address} | ${o.tel} | ${o.location}`));
  fs.writeFileSync(path.join(__dirname, 'missing-pois.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log('已写入 scripts/missing-pois.json');
})();
