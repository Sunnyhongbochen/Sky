// 下载江汉区 + 汉兴街道行政区划边界(GCJ-02) -> static/quizzes/boundary.json
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

function parsePolyline(str) {
  // "lng,lat;lng,lat;...|lng,lat;..." -> [[[lng,lat],...], ...]
  return (str || '').split('|').filter(Boolean).map(ring =>
    ring.split(';').filter(Boolean).map(pt => pt.split(',').map(Number))
  );
}

(async () => {
  // 1) 江汉区（含下属街道 adcode）
  const dist = await get(`/v3/config/district?key=${KEY}&keywords=420103&subdistrict=1&extensions=all`);
  if (dist.status !== '1' || !dist.districts || !dist.districts.length) throw new Error('江汉区边界获取失败: ' + dist.info);
  const d0 = dist.districts[0];
  const district = {
    name: d0.name, adcode: d0.adcode,
    center: (d0.center || '').split(',').map(Number),
    paths: parsePolyline(d0.polyline)
  };

  // 2) 汉兴街道（keywords 查询，过滤出武汉的那条——江苏睢宁也有同名街道）
  const st = await get(`/v3/config/district?key=${KEY}&keywords=${encodeURIComponent('汉兴街道')}&city=420100&subdistrict=0&extensions=all`);
  if (st.status !== '1' || !st.districts || !st.districts.length) throw new Error('汉兴街道边界获取失败: ' + st.info);
  const s0 = st.districts.find(x => (x.adcode || '').startsWith('420103')) ||
             st.districts.find(x => x.center && x.center.startsWith('114.')) ||
             st.districts[0];
  const street = {
    name: s0.name, adcode: s0.adcode,
    center: (s0.center || '').split(',').map(Number),
    paths: parsePolyline(s0.polyline)
  };

  const out = { district, street };
  const dst = path.join(__dirname, '..', 'static', 'quizzes', 'boundary.json');
  fs.writeFileSync(dst, JSON.stringify(out), 'utf8');
  console.log('江汉区边界环数:', district.paths.length, '| 汉兴街道边界环数:', street.paths.length);
  console.log('区中心:', district.center, '| 街道中心:', street.center);
  console.log('文件大小:', (fs.statSync(dst).size / 1024).toFixed(1) + 'KB ->', dst);
})();
