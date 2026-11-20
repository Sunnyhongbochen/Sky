// 合成小区数据: 交付信息输入 + 高德定位 + OSM边界(降级为示意范围) -> static/quizzes/communities.json
// 输入: scripts/community-delivery.json  [{ name, amapKeyword?, delivery, deliveryNote?, elevator, note?, sources:[], altNames?:[] }]
// 所有输出坐标为 GCJ-02（高德系），上图无偏移。
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'static', 'quizzes', 'communities.json');
const kg = JSON.parse(fs.readFileSync(path.join(ROOT, 'static', 'quizzes', 'kindergartens.json'), 'utf8'));

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function postOverpass(q) {
  return new Promise((resolve, reject) => {
    const pathQ = '/api/interpreter?data=' + encodeURIComponent(q);
    const hosts = ['overpass-api.de', 'overpass.kumi.systems'];
    const tryHost = (i) => {
      if (i >= hosts.length) { reject(new Error('overpass all hosts failed')); return; }
      const req = https.get({
        hostname: hosts[i], path: pathQ, method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) summer-website-community-boundary',
          'Accept': '*/*'
        }
      }, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => {
          if (r.statusCode !== 200) { tryHost(i + 1); return; }
          try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('overpass parse: ' + d.slice(0, 200))); }
        });
      });
      req.on('error', () => tryHost(i + 1));
      req.setTimeout(30000, () => req.destroy(new Error('overpass timeout')));
    };
    tryHost(0);
  });
}

// ---- GCJ-02 <-> WGS-84 ----
const PI = Math.PI, A = 6378245, EE = 0.00669342162296594323;
function outOfChina(lng, lat) { return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271; }
function transLat(x, y) { let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x)); r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3; r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3; r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3; return r; }
function transLng(x, y) { let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x)); r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3; r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3; r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3; return r; }
function wgs2gcj(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat];
  let dLat = transLat(lng - 105, lat - 35), dLng = transLng(lng - 105, lat - 35);
  const radLat = lat / 180 * PI; let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic; const sq = Math.sqrt(magic);
  dLat = (dLat * 180) / ((A * (1 - EE)) / (magic * sq) * PI);
  dLng = (dLng * 180) / (A / sq * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}
function gcj2wgs(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat];
  let wlng = lng, wlat = lat;
  for (let i = 0; i < 3; i++) {
    const [glng, glat] = wgs2gcj(wlng, wlat);
    wlng -= glng - lng; wlat -= glat - lat;
  }
  return [wlng, wlat];
}

function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function norm(s) { return (s || '').replace(/[\s·\-—_（）()]/g, '').replace(/(一期|二期|三期|四期|五期|[0-9]+期)$/g, '').toLowerCase(); }
function ringArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return Math.abs(s / 2);
}
function pip(pt, ring) { // point in polygon (ray casting)
  const [x, y] = pt; let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function assembleOuterRings(members) {
  const segs = members.filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry && m.geometry.length > 1)
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  const close = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const rings = [];
  while (segs.length) {
    let ring = segs.pop().slice();
    let joined = true;
    while (joined && segs.length) {
      joined = false;
      const head = ring[0], tail = ring[ring.length - 1];
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], sh = s[0], st = s[s.length - 1];
        if (close(tail, sh)) { ring = ring.concat(s.slice(1)); segs.splice(i, 1); joined = true; break; }
        if (close(tail, st)) { ring = ring.concat(s.slice(0, -1).reverse()); segs.splice(i, 1); joined = true; break; }
        if (close(head, sh)) { ring = s.slice(1).concat(ring); segs.splice(i, 1); joined = true; break; }
        if (close(head, st)) { ring = s.slice(0, -1).reverse().concat(ring); segs.splice(i, 1); joined = true; break; }
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings.sort((a, b) => ringArea(b) - ringArea(a));
}
function circlePoly(lng, lat, radius, n = 28) {
  const pts = [];
  const dLat = radius / 111320, dLng = radius / (111320 * Math.cos(lat * PI / 180));
  for (let i = 0; i < n; i++) {
    const t = i / n * 2 * PI;
    pts.push([+(lng + dLng * Math.cos(t)).toFixed(6), +(lat + dLat * Math.sin(t)).toFixed(6)]);
  }
  pts.push(pts[0]);
  return pts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocodeCommunity(name, keyword) {
  const kw = keyword || name;
  const url = `https://restapi.amap.com/v3/place/text?key=${KEY}&keywords=${encodeURIComponent(kw)}&city=420100&citylimit=true&types=120000&offset=5&page=1`;
  const r = await getJson(url);
  const pois = r.pois || [];
  const ok = pois.find((p) => (p.type || '').includes('住宅')) || pois[0];
  if (ok) {
    const [lng, lat] = ok.location.split(',').map(Number);
    return { lng, lat, address: ok.address || '', matched: `${ok.name} @ ${ok.address || ''}` };
  }
  const g = await getJson(`https://restapi.amap.com/v3/geocode/geo?key=${KEY}&address=${encodeURIComponent(kw)}&city=420100`);
  const geo = g.geocodes && g.geocodes[0];
  if (geo && geo.location) {
    const [lng, lat] = geo.location.split(',').map(Number);
    return { lng, lat, address: (geo.district || '') + (geo.street || ''), matched: '地理编码兜底' };
  }
  return null;
}

async function fetchOsmBoundary(lng, lat, names) {
  const [wlng, wlat] = gcj2wgs(lng, lat); // OSM是WGS84，先把高德中心转回WGS做匹配
  const q = `[out:json][timeout:25];
( way["landuse"="residential"](around:800,${wlat},${wlng}); relation["landuse"="residential"](around:800,${wlat},${wlng}); );
out tags center geom;`;
  const data = await postOverpass(q);
  const els = data.elements || [];
  const nm = names.map(norm);
  const score = (el) => {
    const n = norm(el.tags && el.tags.name);
    if (!n) return 0;
    for (const t of nm) { if (n.includes(t) || t.includes(n)) return 3; }
    for (const t of nm) { if (t.length >= 3 && n.slice(0, 3) === t.slice(0, 3)) return 1; }
    return 0;
  };
  let best = null, bestScore = 0;
  for (const el of els) {
    const s = score(el);
    if (s > bestScore) { bestScore = s; best = el; }
  }
  if (!best) { // 无名称匹配时: 仅当存在唯一未命名多边形且中心点距定位点<400m才采用
    const cands = els.filter((el) => el.tags && !el.tags.name && el.center &&
      haversine(el.center.lon, el.center.lat, wlng, wlat) < 400);
    if (cands.length === 1) { best = cands[0]; }
  }
  if (!best) return null;
  let ring = null;
  if (best.type === 'way' && best.geometry) {
    ring = best.geometry.map((p) => [p.lon, p.lat]);
    if (ring.length > 2) { const h = ring[0], t = ring[ring.length - 1]; if (h[0] !== t[0] || h[1] !== t[1]) ring.push(h); }
  } else if (best.type === 'relation' && best.members) {
    const rings = assembleOuterRings(best.members);
    ring = rings[0] || null;
  }
  if (!ring || ring.length < 4) return null;
  const gcjRing = ring.map(([lo, la]) => wgs2gcj(lo, la).map((v) => +v.toFixed(6)));
  return { ring: gcjRing, osmName: (best.tags && best.tags.name) || '(未命名,按位置匹配)' };
}

(async () => {
  const inputPath = path.join(__dirname, 'community-delivery.json');
  if (!fs.existsSync(inputPath)) { console.log('缺少输入文件 community-delivery.json'); process.exit(1); }
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  // 候选POI坐标表: 优先复用(比地理编码精确)
  const shortlist = fs.existsSync(path.join(__dirname, 'community-shortlist.json'))
    ? JSON.parse(fs.readFileSync(path.join(__dirname, 'community-shortlist.json'), 'utf8')) : [];
  const metroList = fs.existsSync(path.join(__dirname, 'community-metro.json'))
    ? JSON.parse(fs.readFileSync(path.join(__dirname, 'community-metro.json'), 'utf8')) : [];
  const metroMap = new Map(metroList.map((x) => [x.family, x]));
  const normKey = (s) => (s || '').replace(/[\s·\-—_（）()]/g, '').toLowerCase();
  function findInShortlist(c) {
    const keys = [c.name, ...(c.altNames || [])].map(normKey);
    for (const f of shortlist) {
      const fk = [normKey(f.family), ...(f.variants || []).map(normKey)];
      if (keys.some((k) => fk.includes(k))) {
        return { lng: f.lng, lat: f.lat, address: f.address, matched: '候选POI:' + f.family, family: f.family };
      }
    }
    return null;
  }
  const out = [];
  for (const c of input) {
    const rec = {
      name: c.name, areaTag: c.areaTag || '', matchedKg: c.matchedKg || '',
      delivery: c.delivery, elevator: c.elevator || '有电梯', note: c.note || '', sources: c.sources || []
    };
    let geo = findInShortlist(c);
    if (!geo) {
      try { geo = await geocodeCommunity(c.name, c.amapKeyword); } catch (e) { console.log('geocode ERR', c.name, e.message); }
    }
    if (!geo) { console.log('!! 无法定位:', c.name); out.push({ ...rec, error: 'geocode-failed' }); continue; }
    rec.lng = geo.lng; rec.lat = geo.lat; rec.address = geo.address; rec.matched = geo.matched;
    // 最近地铁口(1km阈值, 数据来自 community-metro.json)
    const metro = geo.family ? metroMap.get(geo.family) : null;
    if (!metro || metro.dist > 1000) {
      console.log('!! 地铁口超1km,剔除:', c.name, metro ? `(${metro.station} ${metro.dist}m)` : '(无地铁数据)');
      continue;
    }
    rec.metro = { station: metro.station, dist: metro.dist };
    // 周边园所(1km内)
    rec.nearby = kg.map((k) => ({ name: k.name, type: k.type, dist: Math.round(haversine(geo.lng, geo.lat, k.lng, k.lat)) }))
      .filter((x) => x.dist <= 1000).sort((a, b) => a.dist - b.dist);
    if (rec.nearby.length === 0) { console.log('!! 1km内无园所,剔除:', c.name, `(matched=${geo.matched})`); continue; }
    out.push(rec);
    console.log('OK', c.name, '| 交付', c.delivery, '| 近园所', rec.nearby.length, '| 地铁', rec.metro.station, rec.metro.dist + 'm |', rec.matched);
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
  console.log(`\n完成: ${out.length} 个小区 -> ${OUT}`);
  console.log('片区分布:', JSON.stringify(out.reduce((s, x) => { s[x.areaTag] = (s[x.areaTag] || 0) + 1; return s; }, {})));
})();
