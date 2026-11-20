// 对 missing-pois.json 中的 POI 逐个 regeo 判定街道（带重试），按街道分组输出
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function regeoTown(lng, lat) {
  for (let i = 0; i < 3; i++) {
    const rg = await get(`https://restapi.amap.com/v3/geocode/regeo?location=${lng},${lat}&key=${KEY}&extensions=base`);
    if (rg.status === '1' && rg.regeocode && rg.regeocode.addressComponent) {
      const ac = rg.regeocode.addressComponent;
      return { township: ac.township || '?', towncode: ac.towncode || '' };
    }
    await sleep(800);
  }
  return { township: '?', towncode: '' };
}

(async () => {
  const pois = JSON.parse(fs.readFileSync(path.join(__dirname, 'missing-pois.json'), 'utf8'));
  const out = [];
  for (const p of pois) {
    const [lng, lat] = p.location.split(',');
    await sleep(500);
    const t = await regeoTown(lng, lat);
    out.push({ ...p, ...t });
    console.log(`[${t.township}] ${p.name}`);
  }
  fs.writeFileSync(path.join(__dirname, 'missing-pois.json'), JSON.stringify(out, null, 2), 'utf8');

  const groups = {};
  out.forEach(o => { (groups[o.township] = groups[o.township] || []).push(o.name); });
  console.log('\n=== 按街道分组 ===');
  Object.keys(groups).sort().forEach(k => console.log(`${k}: ${groups[k].length} 所\n  ${groups[k].join(' | ')}`));
})();
