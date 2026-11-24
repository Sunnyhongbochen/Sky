/**
 * 城市管理对象（部件）管理平台 - 模拟数据生成器
 * 基于北京市朝阳区生成约300个城市部件数据
 */

// 中心坐标：北京市朝阳区
const CENTER_LAT = 39.9219;
const CENTER_LNG = 116.4435;

// 随机偏移（约5km范围）
function randomOffset(base, range = 0.045) {
  return base + (Math.random() - 0.5) * range * 2;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 街道/社区
const streets = ['建外街道', '朝外街道', '呼家楼街道', '三里屯街道', '团结湖街道', '六里屯街道', '八里庄街道', '劲松街道'];
const communities = {
  '建外街道': ['永安里社区', '光华里社区', '南郎社区', '北郎社区', '秀水社区'],
  '朝外街道': ['吉祥里社区', '三丰里社区', '体东社区', '雅宝里社区'],
  '呼家楼街道': ['金台里社区', '小庄社区', '关东店社区', '核桃园社区'],
  '三里屯街道': ['幸福一村社区', '幸福二村社区', '北三里社区', '东三里社区'],
  '团结湖街道': ['一二条社区', '三四条社区', '中路北社区', '南北里社区'],
  '六里屯街道': ['炫特社区', '八里庄北里社区', '道家园社区', '晨光社区'],
  '八里庄街道': ['罗马嘉园社区', '甘露园社区', '朝阳无限社区', '城市华庭社区'],
  '劲松街道': ['劲松北社区', '劲松中社区', '劲松西社区', '劲松东社区'],
};

// 部件大类定义
const categories = {
  '公用设施': {
    code: 'GY',
    subCategories: {
      '路灯': { code: 'LD', icon: '💡', color: '#FF9800', count: 30 },
      '井盖': { code: 'JG', icon: '🕳️', color: '#607D8B', count: 25 },
      '消防栓': { code: 'XFH', icon: '🚒', color: '#F44336', count: 15 },
      '监控摄像头': { code: 'SXT', icon: '📹', color: '#2196F3', count: 20 },
    }
  },
  '交通设施': {
    code: 'JT',
    subCategories: {
      '公交站': { code: 'GJZ', icon: '🚌', color: '#4CAF50', count: 15 },
      '交通信号灯': { code: 'XHD', icon: '🚦', color: '#FF5722', count: 20 },
      '护栏': { code: 'HL', icon: '🚧', color: '#9C27B0', count: 20 },
      '停车场': { code: 'TCC', icon: '🅿️', color: '#00BCD4', count: 10 },
      '充电桩': { code: 'CDZ', icon: '🔌', color: '#8BC34A', count: 15 },
    }
  },
  '市容环境设施': {
    code: 'SR',
    subCategories: {
      '垃圾桶': { code: 'LJT', icon: '🗑️', color: '#795548', count: 30 },
      '公厕': { code: 'GC', icon: '🚻', color: '#E91E63', count: 10 },
    }
  },
  '园林绿化设施': {
    code: 'YL',
    subCategories: {
      '行道树': { code: 'XDS', icon: '🌳', color: '#2E7D32', count: 40 },
      '花坛': { code: 'HT', icon: '🌸', color: '#EC407A', count: 15 },
      '公园长椅': { code: 'CY', icon: '🪑', color: '#A1887F', count: 10 },
    }
  },
  '其他设施': {
    code: 'QT',
    subCategories: {
      '广告牌': { code: 'GGP', icon: '📋', color: '#FFC107', count: 15 },
      '消防通道': { code: 'XFTD', icon: '🛑', color: '#D32F2F', count: 5 },
      '报刊亭': { code: 'BKT', icon: '📰', color: '#5D4037', count: 5 },
    }
  }
};

// 主管单位
const ownerUnits = ['朝阳区城管委', '朝阳区园林绿化局', '朝阳区环卫中心', '朝阳区交通委', '朝阳区住建委'];
const maintainUnits = ['北京城市运维公司', '朝阳市政工程公司', '北京园林养护中心', '朝阳环卫服务公司', '北京交通设施维护公司'];
const rightUnits = ['朝阳区政府', '北京市政集团', '朝阳区城管委', '朝阳区园林绿化局', '朝阳区交通委'];

// 权限角色
const roles = [
  { id: 'admin', name: '城管局管理员', dept: '朝阳区城管委', catPermission: ['公用设施', '交通设施', '市容环境设施', '园林绿化设施', '其他设施'], funcPermissions: ['查看', '查询', '新增', '编辑', '删除', '导出', '审核'] },
  { id: 'yuanlin', name: '园林局管理员', dept: '朝阳区园林绿化局', catPermission: ['园林绿化设施'], funcPermissions: ['查看', '查询', '新增', '编辑', '导出'] },
  { id: 'huanwei', name: '环卫局管理员', dept: '朝阳区环卫中心', catPermission: ['市容环境设施'], funcPermissions: ['查看', '查询', '新增', '编辑', '导出'] },
  { id: 'jiaotong', name: '交通委管理员', dept: '朝阳区交通委', catPermission: ['交通设施'], funcPermissions: ['查看', '查询', '新增', '编辑', '导出'] },
];

// 操作日志模板
const operationTypes = ['新增', '修改', '删除', '审核', '导出'];
const operators = ['张三', '李四', '王五', '赵六', '孙七'];

// 生成操作日志
function generateOperationLog(componentId, componentName) {
  const count = randomInt(2, 8);
  const logs = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const opType = randomChoice(operationTypes);
    const fields = ['设施状态', '管护单位', '备注'];
    const field = randomChoice(fields);
    logs.push({
      id: `LOG-${String(Date.now()).slice(-8)}-${i}`,
      operator: randomChoice(operators),
      time: new Date(now - randomInt(0, 90) * 86400000).toISOString(),
      type: opType,
      target: `${componentId} ${componentName}`,
      field: field,
      beforeValue: opType === '修改' ? randomChoice(['正常', '损坏', '废弃', '在建', '北京运维公司', '朝阳市政']) : '',
      afterValue: opType === '修改' ? randomChoice(['正常', '损坏', '废弃', '在建', '北京运维公司', '朝阳市政']) : '',
      ip: `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
    });
  }
  return logs;
}

// 生成部件数据
let componentId = 1;
const allComponents = [];
const allOperationLogs = [];

for (const [catName, catData] of Object.entries(categories)) {
  for (const [subName, subData] of Object.entries(catData.subCategories)) {
    for (let i = 0; i < subData.count; i++) {
      const street = randomChoice(streets);
      const community = randomChoice(communities[street]);
      const id = `${catData.code}-${subData.code}-${String(componentId).padStart(4, '0')}`;
      const name = `${subName}-${String(i + 1).padStart(2, '0')}`;
      const statuses = ['正常', '正常', '正常', '损坏', '废弃', '在建'];
      const status = randomChoice(statuses);
      const comp = {
        id: id,
        name: name,
        categoryCode: catData.code,
        categoryName: catName,
        subCategoryCode: subData.code,
        subCategoryName: subName,
        icon: subData.icon,
        color: subData.color,
        lat: randomOffset(CENTER_LAT, 0.04),
        lng: randomOffset(CENTER_LNG, 0.05),
        address: `北京市朝阳区${street}${community}${randomInt(1, 99)}号`,
        district: '朝阳区',
        street: street,
        community: community,
        grid: `${catData.code}-${randomInt(1, 20).toString().padStart(2, '0')}`,
        status: status,
        ownerUnit: randomChoice(ownerUnits),
        maintainUnit: randomChoice(maintainUnits),
        rightUnit: randomChoice(rightUnits),
        installDate: new Date(2020, randomInt(0, 11), randomInt(1, 28)).toISOString().slice(0, 10),
        lastMaintainDate: new Date(2025, randomInt(0, 5), randomInt(1, 28)).toISOString().slice(0, 10),
        maintainCycle: randomChoice([30, 60, 90, 180, 365]),
        manufacturer: randomChoice(['北京华正', '中兴科技', '海康威视', '大华股份', '东方园林', '北京城建']),
        model: `${catData.code}-${randomInt(100, 999)}`,
        specifications: '符合GB/T标准',
        remark: randomChoice(['', '需重点巡查', '临近学校', '位于商业区', '人流量大']),
        photo: `https://picsum.photos/seed/${id}/400/300`,
      };
      allComponents.push(comp);
      // 生成操作日志
      allOperationLogs.push(...generateOperationLog(id, name));
      componentId++;
    }
  }
}

// 输出
const output = {
  components: allComponents,
  operationLogs: allOperationLogs.sort((a, b) => new Date(b.time) - new Date(a.time)),
  categories: categories,
  roles: roles,
  streets: streets,
  communities: communities,
  center: { lat: CENTER_LAT, lng: CENTER_LNG },
  totalCount: allComponents.length,
  generatedAt: new Date().toISOString(),
};

console.log(JSON.stringify(output, null, 2));
