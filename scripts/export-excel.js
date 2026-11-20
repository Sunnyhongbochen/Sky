// 从 kindergartens.json 导出 Excel（与地图页同一数据源，保证展示一致）
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const jsonPath = path.join(__dirname, '..', 'static', 'quizzes', 'kindergartens.json');
const outPath = path.join(__dirname, '..', 'static', 'quizzes', 'kindergartens.xlsx');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const typeText = { '公办': '公办幼儿园', '普惠': '普惠幼儿园', '非普惠': '非普惠幼儿园', '托育': '备案托育机构（卫健委）' };

const rows = data.map((k, i) => ({
  '序号': i + 1,
  '园所名称': k.name,
  '类别': typeText[k.type] || k.type,
  '办园等级': k.grade || '暂无公开评级',
  '所属区域': k.town,
  '地址': k.address,
  '联系电话': k.tel || '暂无公开电话',
  '2026年招生': k.plan2026 ? k.plan2026 + ' 人' : (k.planNote || '以园方公告为准'),
  '幼儿园介绍': k.intro,
  '园区特点': k.features,
  '信息来源': k.sources.join('\n'),
  '经度(GCJ-02)': k.lng,
  '纬度(GCJ-02)': k.lat,
  '坐标匹配': k.matched
}));

const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = [
  { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 13 },
  { wch: 45 }, { wch: 24 }, { wch: 28 }, { wch: 90 }, { wch: 60 }, { wch: 55 },
  { wch: 12 }, { wch: 11 }, { wch: 45 }
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '幼儿园信息表');
XLSX.writeFile(wb, outPath);

console.log('已导出:', outPath, '| 记录数:', rows.length);
