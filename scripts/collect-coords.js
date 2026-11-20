// 江汉区教育局《2025年江汉区幼儿园信息表》汉兴街道名单 -> 高德 GCJ-02 坐标采集
// 优先 POI 搜索（真实点位），失败用地理编码兜底，输出 static/quizzes/kindergartens.json
const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';
const list = [
  { name: '盛世红苗幼儿园', official: '武汉市江汉区盛世红苗幼儿园', addr: '江汉区新湾路11号', type: '公办' },
  { name: '红胜幼儿园', official: '武汉市江汉区红胜幼儿园', addr: '江汉区姑嫂树路富康花园特一号', type: '公办' },
  { name: '新稚雅幼儿园', official: '武汉市江汉区新稚雅幼儿园', addr: '江汉区兴业路20号', type: '公办' },
  { name: '稚雅幼儿园', official: '武汉市江汉区稚雅幼儿园', addr: '江汉区汉兴街常青一路163号', type: '公办' },
  { name: '稚雅幼儿园金雅分园', official: '武汉市江汉区稚雅幼儿园金雅分园', addr: '江汉区汉兴街红旗渠路88号', type: '公办' },
  { name: '童心幼儿园', official: '武汉市江汉区童心幼儿园', addr: '江汉区常青一路222号', type: '公办' },
  { name: '华苑幼儿园', official: '武汉市江汉区华苑幼儿园', addr: '江汉区汉兴街华苑里38号', type: '公办' },
  { name: '星连星幼儿园', official: '江汉区星连星幼儿园', addr: '江汉区姑嫂树9号绿色家园内', type: '普惠' },
  { name: '红旗公寓幼儿园', official: '武汉市江汉区红旗公寓幼儿园', addr: '江汉区常青一路8号红旗公寓五栋1-2单元', type: '普惠' },
  { name: '馨苑幼儿园', official: '武汉市江汉区馨苑幼儿园', addr: '江汉区杨汊湖馨苑小区18栋', type: '普惠' },
  { name: '益康苑幼儿园', official: '武汉市江汉区益康苑幼儿园', addr: '江汉区杨汊湖益康苑阳光里134号1楼', type: '普惠' },
  { name: '育苗幼儿园', official: '武汉市江汉区育苗幼儿园', addr: '江汉区江达路香缇美景小区20栋旁', type: '普惠' },
  { name: '红枫幼儿园', official: '武汉市江汉区红枫幼儿园', addr: '江汉区复兴五村235号', type: '普惠' },
  { name: '维特幼儿园', official: '武汉市江汉区维特幼儿园', addr: '江汉区姑嫂树路园丁苑小区', type: '普惠' },
  { name: '阳光宝贝婴幼园', official: '武汉市江汉区阳光宝贝婴幼园', addr: '江汉区红光路长春小区内', type: '普惠' },
  { name: '童乐幼儿园', official: '武汉市江汉区童乐幼儿园', addr: '江汉区红旗渠路浩海小区特1号', type: '普惠' },
  { name: '艾米莉亚福星华府幼儿园', official: '武汉市江汉区艾米莉亚福星华府幼儿园', addr: '江汉区新湾路23号福星华府（姑嫂树村）K3地块', type: '普惠' },
  { name: '福星华府誉境思桥幼儿园', official: '武汉市江汉区福星华府誉境思桥幼儿园', addr: '武汉市江汉区新湾五路202号', type: '普惠' },
  { name: '史蒂芬森教育万科城幼儿园', official: '武汉市江汉区史蒂芬森教育万科城幼儿园', addr: '江汉区常青路167号万科城配套幼儿园', type: '普惠' },
  { name: '阳光蓓佳幼儿园', official: '武汉市江汉区阳光蓓佳幼儿园', addr: '江汉区常青路149号东方名都小区内', type: '普惠' },
  { name: '晶晶锦绣幼儿园', official: '武汉市江汉区晶晶锦绣幼儿园', addr: '江汉区红旗渠路8号', type: '非普惠' },
  { name: '柏拉图之友幼儿园', official: '武汉市江汉区柏拉图之友幼儿园有限公司', addr: '江汉区机电路39号新龙和苑1号商铺', type: '非普惠' },
  { name: '福星幼儿园', official: '武汉市江汉区福星幼儿园', addr: '江汉区常青一路福星惠誉福星城南区', type: '非普惠' },
  { name: '开心新龙幼儿园', official: '武汉市江汉区开心新龙幼儿园', addr: '江汉区机电路39号新龙和苑2号商铺', type: '非普惠' }
];

function get(urlPath) {
  return new Promise((resolve, reject) => {
    https.get({ host: 'restapi.amap.com', path: urlPath, headers: { 'User-Agent': 'node' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 名称匹配：POI 名与核心词互相包含（容忍全称/简称/有限公司后缀）
function nameMatch(poiName, core) {
  const a = poiName.replace(/（.*?）|\(.*?\)|有限公司/g, '');
  const b = core.replace(/（.*?）|\(.*?\)|有限公司/g, '');
  return a.includes(b) || b.includes(a);
}

async function main() {
  const out = [];
  for (const item of list) {
    let hit = null;
    // 1) POI 搜索：官方全称 -> 简称
    for (const kw of [item.official, '武汉市江汉区' + item.name]) {
      const j = await get(`/v3/place/text?key=${KEY}&keywords=${encodeURIComponent(kw)}&city=420100&citylimit=true&output=json`);
      if (j.status === '1' && j.pois && j.pois.length) {
        const p = j.pois.find(x => (x.adname || '').includes('江汉') && x.location && nameMatch(x.name, item.name))
               || j.pois.find(x => (x.adname || '').includes('江汉') && x.location);
        if (p) { hit = { src: 'poi', poi: p }; break; }
      }
      await sleep(350);
    }
    // 2) 兜底：地址地理编码
    if (!hit) {
      const g = await get(`/v3/geocode/geo?key=${KEY}&address=${encodeURIComponent('武汉市' + item.addr)}&city=420100&output=json`);
      if (g.status === '1' && g.geocodes && g.geocodes.length && g.geocodes[0].location) {
        hit = { src: 'geocode', poi: { name: item.name, address: item.addr, location: g.geocodes[0].location, adname: '江汉区' } };
      }
      await sleep(350);
    }
    if (hit) {
      const [lng, lat] = hit.poi.location.split(',').map(Number);
      out.push({ name: item.name, address: item.addr, type: item.type, lng, lat,
        src: hit.src, matched: hit.poi.name + ' @ ' + (hit.poi.address || '') });
      console.log(`[OK:${hit.src}] ${item.name} -> ${lng},${lat} | ${hit.poi.name}`);
    } else {
      out.push({ name: item.name, address: item.addr, type: item.type, src: 'fail' });
      console.log(`[FAIL] ${item.name}`);
    }
    await sleep(350);
  }
  const dst = path.join(__dirname, '..', 'static', 'quizzes', 'kindergartens.json');
  fs.writeFileSync(dst, JSON.stringify(out, null, 2), 'utf8');
  console.log('已写出: ' + dst + '，共 ' + out.length + ' 条，失败 ' + out.filter(x => x.src === 'fail').length + ' 条');
}
main();
