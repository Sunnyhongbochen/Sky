// 重建 kindergartens.json：在坐标基础上注入 tel/plan2026/intro/sources，并新增红苗幼儿园(后湖里园区)
const fs = require('fs');
const path = require('path');

const SRC_INFO = '江汉区教育局《2025年江汉区幼儿园信息表》(jianghan.gov.cn, 2025-02-11)';
const SRC_QA = '江汉区教育局《2025年江汉区幼儿园招生政策问答》(jianghan.gov.cn, 2025-08-15)';
const SRC_SUB = '《2024年普惠性民办幼儿园奖补资金拨付一览表》(jianghan.gov.cn, 2025-12-03)';
const SRC_POI = '高德地图POI/地理编码(GCJ-02)';
const PLAN_NOTE = '官方未集中公示，以各园6月招生公告为准';

// tel: 电话; grade: 普惠园等级(奖补表); spot: 位置描述; extraSrc: 额外来源
const extra = {
  '盛世红苗幼儿园':      { tel: '027-85812147', spot: '新湾路（大兴实验小学旁）', grade: null, qa: true },
  '红胜幼儿园':          { tel: '027-65602237 / 18062604510', spot: '姑嫂树路富康花园小区', grade: null, qa: true },
  '新稚雅幼儿园':        { tel: '027-85250166-828', spot: '兴业路', grade: null, qa: true },
  '稚雅幼儿园':          { tel: '027-85574231', spot: '常青一路', grade: null, qa: true },
  '稚雅幼儿园金雅分园':  { tel: '027-85805088-804', spot: '红旗渠路88号金色雅园一期', grade: null, qa: true },
  '童心幼儿园':          { tel: '027-85363066-306', spot: '常青一路', grade: null, qa: true },
  '华苑幼儿园':          { tel: '027-85313695-8011', spot: '汉兴街华苑里小区', grade: null, qa: true },
  '星连星幼儿园':        { tel: '027-65663741', spot: '姑嫂树路绿色家园小区', grade: '市二级', qa: true },
  '红旗公寓幼儿园':      { tel: '13971095625 / 15007142227', spot: '常青一路8号红旗公寓', grade: '市一级', qa: true },
  '馨苑幼儿园':          { tel: '15827228870', spot: '杨汊湖馨苑小区', grade: '市二级', qa: false },
  '益康苑幼儿园':        { tel: '027-65669003', spot: '杨汊湖益康苑小区', grade: '市二级', qa: false },
  '育苗幼儿园':          { tel: '17720569781', spot: '江达路香缇美景小区', grade: null, qa: true },
  '红枫幼儿园':          { tel: '18986212088', spot: '复兴五村', grade: '市三级', qa: false },
  '维特幼儿园':          { tel: '027-85606854 / 15827330904', spot: '姑嫂树路园丁苑小区', grade: '市二级', qa: true },
  '阳光宝贝婴幼园':      { tel: '027-85304487', spot: '新湾路长春小区', grade: '市一级', qa: true },
  '童乐幼儿园':          { tel: '15927127820', spot: '红旗渠路浩海小区', grade: '市三级', qa: false },
  '艾米莉亚福星华府幼儿园': { tel: '18186469918', spot: '新湾路福星华府（姑嫂树村）K3地块', grade: '市二级', qa: false },
  '福星华府誉境思桥幼儿园': { tel: '027-85519299', spot: '新湾五路202号福星华府誉境小区', grade: '市一级', qa: false },
  '史蒂芬森教育万科城幼儿园': { tel: '18986256385', spot: '常青路167号万科城', grade: null, qa: false },
  '阳光蓓佳幼儿园':      { tel: '17764080061', spot: '常青路149号东方名都小区', grade: null, qa: false },
  '晶晶锦绣幼儿园':      { tel: '027-65693003', spot: '红旗渠路8号锦绣人家小区', grade: null, qa: true },
  '柏拉图之友幼儿园':    { tel: '18171298805', spot: '机电路39号新龙和苑', grade: null, qa: false },
  '福星幼儿园':          { tel: '027-66660899', spot: '常青一路福星惠誉福星城南区', grade: null, qa: false },
  '开心新龙幼儿园':      { tel: null, spot: '机电路39号新龙和苑', grade: null, qa: false }
};

const file = path.join(__dirname, '..', 'static', 'quizzes', 'kindergartens.json');
const list = JSON.parse(fs.readFileSync(file, 'utf8'));

const out = list.map(rec => {
  const e = extra[rec.name] || {};
  const nature = rec.type === '公办' ? '武汉市江汉区教育局举办的公办幼儿园'
    : rec.type === '普惠' ? '江汉区普惠性民办幼儿园'
    : '民办幼儿园（非普惠性，家长自费入学）';
  const grade = e.grade ? `，幼儿园等级为武汉市${e.grade}` : '';
  const tel = e.tel ? `，咨询电话：${e.tel}` : '';
  const intro = `${nature}${grade}，位于汉兴街道${e.spot || rec.address}${tel}。坐标为高德GCJ-02系，上图无偏移。`;
  const sources = [SRC_INFO, SRC_POI];
  if (e.qa) sources.splice(1, 0, SRC_QA);
  if (e.grade) sources.push(SRC_SUB);
  return { ...rec, tel: e.tel || null, plan2026: null, planNote: PLAN_NOTE, intro, sources };
});

// 新增：红苗幼儿园（后湖里园区）—— 实地确认 + 2025招生问答 + 高德POI 三重印证
out.push({
  name: '红苗幼儿园（后湖里园区）',
  address: '江汉区汉兴街道绿柳路88号（信达后湖里旁）',
  type: '公办', lng: 114.265747, lat: 30.633702, src: 'poi',
  matched: '武汉市江汉区红苗幼儿园(后湖里园区)',
  tel: '15071447290', plan2026: null, planNote: PLAN_NOTE,
  intro: '武汉市江汉区教育局举办的公办幼儿园，为红苗幼儿园新设后湖里园区，位于汉兴街道绿柳路88号（信达后湖里旁，石桥地铁站附近），咨询电话：15071447290。坐标为高德GCJ-02系，上图无偏移。',
  sources: [SRC_QA, SRC_POI, '实地走访确认(2026-09)']
});

fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
console.log('共', out.length, '所；有电话', out.filter(x => x.tel).length, '所；等级来自奖补表', out.filter(x => x.intro.includes('市一') || x.intro.includes('市二') || x.intro.includes('市三')).length, '所');
