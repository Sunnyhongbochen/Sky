// 修正 3 条可疑坐标
const https = require('https');
const fs = require('fs');
const path = require('path');
const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';

function get(p) {
  return new Promise((res, rej) => {
    https.get({ host: 'restapi.amap.com', path: p, headers: { 'User-Agent': 'node' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const file = path.join(__dirname, '..', 'static', 'quizzes', 'kindergartens.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const fix = async (name, attempts) => {
    for (const kw of attempts) {
      const j = await get(`/v3/place/text?key=${KEY}&keywords=${encodeURIComponent(kw)}&city=420100&citylimit=true&output=json`);
      const pois = (j.status === '1' && j.pois) || [];
      const p = pois.find(x => x.location && (x.adname || '').includes('江汉') && !/停车场|车位/.test(x.name));
      if (p) {
        const [lng, lat] = p.location.split(',').map(Number);
        const rec = data.find(d => d.name === name);
        rec.lng = lng; rec.lat = lat; rec.src = 'poi-fixed';
        rec.matched = p.name + ' @ ' + (p.address || '');
        console.log(`[FIX] ${name} -> ${lng},${lat} | ${p.name} @ ${p.address}`);
        return;
      }
      await sleep(350);
    }
    console.log(`[STILL] ${name}`);
  };
  await fix('稚雅幼儿园金雅分园', ['武汉市江汉区稚雅幼儿园金雅分园', '金色雅园幼儿园', '江汉区红旗渠路88号幼儿园', '红旗渠路88号']);
  await fix('柏拉图之友幼儿园', ['华中师范大学附属柏拉图之友幼儿园', '柏拉图之友幼儿园']);
  await fix('福星幼儿园', ['福星惠誉福星城南区幼儿园', '江汉区福星幼儿园']);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log('已更新 ' + file);
})();
