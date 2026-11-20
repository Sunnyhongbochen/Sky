// 清洗 community-candidates.json: 剔除非住宅POI, 按小区族合并, 输出调研用清单
// 输出: scripts/community-shortlist.json  (族为单位, 含期数变体/定位/近园所)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'community-candidates.json'), 'utf8'));

// 明显非小区POI
const dropName = /物业|服务|会所|停车|售楼|营销|展示|工地|施工|指挥部|充电|换电|营业厅|银行|超市|邮件|快递|驿站|岗亭|门禁|垃圾|公厕|幼儿园|小学|中学|大学|培训|门诊|诊所|卫生服务|居委会|村委会|社区服务|业委|公证|教堂|寺庙|活动室|活动中心|党群|文体|养老|日间照料|食堂|饭堂|餐厅|商务宾馆|酒店|旅馆|招待所|公寓(楼|底商)|宿舍楼|管理|工业园|大厦|大楼|科技园|写字楼|储蓄|环投|加油|市场|卖场|商业|广场|百货|公司|厂|局$|柜|别墅|冠寓|创业|孵化|产业园|科创|创意|办公|研发|电商|数字|区块链|智能|总部|街区|地产|商贸|餐厅|小海鲜|养发|菜店|柚米|微寓|悦寓|员工之家|派出所|微寓|门面|店铺|公寓店|楼盘营销|售楼部|展点|临时|工棚/;
// 保留但标记疑似的: 公寓(可能40年产权)
const suspectApartment = /公寓|soho|SOHO|公馆楼/;

function norm(s) { return (s || '').replace(/[\s·\-—_（）()]/g, ''); }
// 族键: 去掉期数后缀
function familyKey(name) {
  return norm(name).replace(/(一期|二期|三期|四期|五期|六期|[0-9]期)$/g, '');
}

const fams = new Map(); // key -> record
for (const c of list) {
  const n = c.name || '';
  if (dropName.test(n)) continue;
  const key = familyKey(n);
  if (!fams.has(key)) {
    fams.set(key, {
      family: key,
      variants: [],
      address: c.address || '',
      typename: c.typename || '',
      hasApartmentVariant: false,
      lng: c.lng, lat: c.lat,
      minDist: c.minDist,
      kindergartens: [...(c.kindergartens || [])]
    });
  }
  const f = fams.get(key);
  if (!f.variants.includes(n)) f.variants.push(n);
  if (suspectApartment.test(n)) f.hasApartmentVariant = true;
  if (c.minDist < f.minDist) {
    f.minDist = c.minDist; f.lng = c.lng; f.lat = c.lat; f.address = c.address || f.address; f.typename = c.typename || f.typename;
  }
  for (const k of (c.kindergartens || [])) if (!f.kindergartens.includes(k)) f.kindergartens.push(k);
}

const out = [...fams.values()].sort((a, b) => a.minDist - b.minDist);
fs.writeFileSync(path.join(__dirname, 'community-shortlist.json'), JSON.stringify(out, null, 1), 'utf8');
console.log('候选POI:', list.length, '-> 去重后小区族:', out.length);
console.log('--- 前60个(按最近园所距离) ---');
console.log(out.slice(0, 60).map((f) => `${f.family}(${f.minDist}m,近${f.kindergartens.length}所${f.hasApartmentVariant ? ',含公寓' : ''})`).join('\n'));
