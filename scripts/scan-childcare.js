// 判定江汉区备案托育机构的街道归属，输出汉兴街道候选及POI坐标
const https = require('https');
const KEY = 'f802ceab11ff6e7c163cce86c55c4d82';

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 2026-03-31 备案名单（另含 2024 版独有：贝拉，一并判定）
const items = [
  { brand: '早安树儿童之家', company: '蒙达利（武汉）教育科技有限公司', addr: '菱角湖万达室外步行街E022.023.025' },
  { brand: '安普森托育中心', company: '武汉市安普森教育咨询有限责任公司', addr: '航空路26号汉口新界广场4栋2层' },
  { brand: '中侨国际骄娇宝幼托学苑', company: '武汉市江汉区娇娇宝幼儿托育有限公司', addr: '新华下路姑嫂树路九号新华家园小区一期中心花园新华会所', tel: '18627861110' },
  { brand: '普里儿童成长中心', company: '武汉市普里教育管理有限公司', addr: '江汉区菱角湖路与天门墩一路交叉口西60米菱角湖壹号' },
  { brand: '红渠少儿成长中心', company: '武汉市红渠文化艺术传播有限公司', addr: '浩海小区14栋1单元101.102号', tel: '18971115982' },
  { brand: '王子托育远洋心苑幼儿园', company: '武汉市王子托育服务有限公司', addr: '远洋心苑', tel: '18717142333', done: true },
  { brand: '万籁时代儿童成长中心', company: '武汉市江汉区万籁时代托育服务有限公司', addr: '菱角湖万达广场BC区7栋1-2层' },
  { brand: '托蒙乐国际婴幼学院', company: '武汉市江汉区托蒙乐教育科技有限公司', addr: '发展大道68号中诚悦城K2地块5栋1-2层社区用房', tel: '18502707118' },
  { brand: '浦园乾臻托育', company: '浦园乾臻（武汉市）托育有限责任公司', addr: '江汉区青年路葛洲坝国际广场北区三层' },
  { brand: '贝拉婴幼儿照护(2024版)', company: '武汉贝拉婴幼儿照护服务有限公司', addr: '兴业路22号江汉人家', tel: '18908622677' }
];

(async () => {
  for (const it of items) {
    if (it.done) { console.log(`[已收录] ${it.brand}`); continue; }
    await sleep(400);
    // 1) 门牌地理编码
    const g = await get(`https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent('武汉市' + it.addr)}&city=420100&key=${KEY}`);
    let loc = null;
    if (g.geocodes && g.geocodes.length) loc = g.geocodes[0].location;
    let town = '?';
    if (loc && loc.length) {
      await sleep(400);
      const rg = await get(`https://restapi.amap.com/v3/geocode/regeo?location=${loc}&key=${KEY}&extensions=base`);
      if (rg.regeocode && rg.regeocode.addressComponent) {
        town = rg.regeocode.addressComponent.township || '?';
      }
    }
    // 2) POI 搜索（品牌名）
    await sleep(400);
    const p = await get(`https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(it.brand)}&city=420100&key=${KEY}&offset=3`);
    const poi = (p.pois || [])[0];
    const poiInfo = poi ? `${poi.name} @ ${Array.isArray(poi.address) ? '' : poi.address} | ${poi.location} | tel=${Array.isArray(poi.tel) ? '' : poi.tel}` : 'POI未找到';
    console.log(`[${town}] ${it.brand} | geo=${loc || '失败'} | ${poiInfo}`);
  }
})();
