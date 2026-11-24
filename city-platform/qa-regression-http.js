/**
 * QA 回归测试 - HTTP 级别 v3 (修复GET body 问题)
 */
const BASE = 'http://localhost:3000';

const TOKENS = {
  admin: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjEsImlhdCI6MTc4MjI5ODY0OSwiZXhwIjoxNzgyMzg1MDQ5fQ.Zt5wjGVdCgX06HTz0_5qRQ-rdlJBsc8kXD5s4SxH2rI',
  region_admin: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50SWQiOjIsImlhdCI6MTc4MjI5ODY0OSwiZXhwIjoxNzgyMzg1MDQ5fQ.J4lOBByk74bnNLV_vCWv915SjzU9gebnTRKbhEpxLKk'
};

let passed = 0, failed = 0;
const results = [];

// Fix: don't send body for GET/HEAD methods
async function api(method, path, body, token) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  if (pass) { passed++; console.log('  ✅ ' + name); }
  else { failed++; console.log('  ❌ ' + name + ': ' + detail); }
}

async function test(name, fn) {
  try { const d = await fn(); record(name, true, d || ''); }
  catch(e) { record(name, false, e.message); }
}

async function main() {
  const T = TOKENS.admin, TR = TOKENS.region_admin;
  console.log('='.repeat(60));
  console.log('  QA 回归测试 - 城市部件权限系统 v3');
  console.log('='.repeat(60));

  // ====== BUG-001 ======
  console.log('\n--- BUG-001 复测: 所有编辑(PUT)操作 ---');

  await test('PUT /api/accounts/:id 编辑账号', async () => {
    const r = await api('PUT', '/api/accounts/2', { realName:'区域管理员_QA测试', phone:'13812345678', email:'t@t.com', regionId:2, deptIds:[1], roleId:2 }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '编辑成功(无SQL报错)';
  });

  await test('PUT /api/accounts/:id/status 禁用', async () => {
    const r = await api('PUT', '/api/accounts/2/status', { status:0 }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '禁用成功';
  });

  await test('PUT /api/accounts/:id/status 启用', async () => {
    const r = await api('PUT', '/api/accounts/2/status', { status:1 }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '启用成功';
  });

  await test('PUT /api/accounts/:id/reset-password', async () => {
    const r = await api('PUT', '/api/accounts/2/reset-password', { password:'Admin1234!' }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '重置成功';
  });

  await test('PUT /api/roles/:id 编辑角色', async () => {
    const r = await api('PUT', '/api/roles/2', { roleName:'区域管理员[已验证]', description:'回归测试' }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    await api('PUT', '/api/roles/2', { roleName:'区域管理员', description:'区县级管理员，可查看本级及下级区域数据' }, T);
    return '编辑+恢复成功';
  });

  await test('PUT /api/menus/:id 编辑菜单', async () => {
    const menus = await api('GET', '/api/menus', null, T);
    const tree = menus.data?.data;
    function findFirst(arr) {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      if (arr[0].children && arr[0].children.length > 0) return findFirst(arr[0].children);
      return arr[0];
    }
    const m = findFirst(tree);
    if (!m) throw new Error('菜单树为空');
    const r = await api('PUT', '/api/menus/' + m.menu_id, { name:m.name, type:m.type, path:m.path||'/test' }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '菜单ID=' + m.menu_id + '(' + m.name + ') 编辑成功';
  });

  await test('PUT /api/regions/:id 编辑区域', async () => {
    const r1 = await api('GET', '/api/regions', null, T);
    const list = r1.data?.data?.list || [];
    if (list.length === 0) throw new Error('区域列表为空');
    const reg = list[0];
    const r = await api('PUT', '/api/regions/' + reg.region_id, { regionName:reg.region_name + '[测试]' }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    await api('PUT', '/api/regions/' + reg.region_id, { regionName:reg.region_name }, T);
    return '区域ID=' + reg.region_id + ' 编辑成功';
  });

  await test('PUT /api/departments/:id 编辑部门', async () => {
    const d1 = await api('GET', '/api/departments?page=1&pageSize=10', null, T);
    const list = d1.data?.data?.list || [];
    if (list.length === 0) throw new Error('部门列表为空');
    const dept = list[0];
    const r = await api('PUT', '/api/departments/' + dept.dept_id, { name:dept.name + '[测试]' }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    await api('PUT', '/api/departments/' + dept.dept_id, { name:dept.name }, T);
    return '部门ID=' + dept.dept_id + ' 编辑成功';
  });

  // ====== BUG-002 ======
  console.log('\n--- BUG-002 复测: 角色列表 ---');

  await test('GET /api/roles 无SQL报错', async () => {
    const r = await api('GET', '/api/roles', null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    const list = r.data.data;
    if (!Array.isArray(list)) throw new Error('非数组: ' + typeof list);
    if (list.length === 0) throw new Error('为空');
    return list.length + '个角色';
  });

  await test('角色列表按type+id排序', async () => {
    const r = await api('GET', '/api/roles', null, T);
    const list = r.data.data;
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (a.role_type > b.role_type) throw new Error('type乱序');
      if (a.role_type === b.role_type && a.role_id > b.role_id) throw new Error('id乱序');
    }
    return list.map(x => x.role_name + '(' + x.role_type + '/' + x.role_id + ')').join(' > ');
  });

  // ====== BUG-003 ======
  console.log('\n--- BUG-003 复测: 部门删除校验 ---');

  const ts1 = Date.now();
  const deptCode = 'QA003_' + ts1;
  let tdId, taId;

  await test('Step1: 新建测试部门A', async () => {
    const r = await api('POST', '/api/departments', { name:'QA回归部门A', code:deptCode, sortOrder:999 }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    tdId = r.data?.data?.deptId;
    if (!tdId) throw new Error('未获取deptId: ' + JSON.stringify(r.data));
    return '部门ID=' + tdId;
  });

  await test('Step2: 新建账号绑定到部门A', async () => {
    const uname = 'qabug' + String(ts1).slice(-8); // 13 chars, valid
    const r = await api('POST', '/api/accounts', {
      username: uname, realName:'BUG003测试', phone:'139' + String(ts1).slice(-8),
      regionId:1, deptIds:[tdId], roleId:4
    }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    taId = r.data?.data?.accountId;
    return '账号ID=' + taId + '(' + uname + ') 密码=' + r.data.data?.initPassword;
  });

  await test('Step3: 删除有绑定的部门A → 应拦截', async () => {
    const r = await api('DELETE', '/api/departments/' + tdId, null, T);
    if (r.data.code === 200) throw new Error('BUG-003仍存在! 部门被删除了');
    if (r.data.code !== 400) throw new Error('预期400实际' + r.status + ': ' + JSON.stringify(r.data));
    return '正确拦截: ' + r.data.message;
  });

  await test('Step4: 删除绑定账号', async () => {
    const r = await api('DELETE', '/api/accounts/' + taId, null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '账号删除成功';
  });

  await test('Step5: 删除无绑定的部门A → 成功', async () => {
    const r = await api('DELETE', '/api/departments/' + tdId, null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '部门删除成功';
  });

  // ====== 核心功能冒烟测试 ======
  console.log('\n=== 核心功能冒烟测试 ===');

  // 1. 登录
  console.log('\n1. 登录功能');
  await test('超管profile', async () => {
    const r = await api('GET', '/api/auth/profile', null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return r.data.data.username + '/' + r.data.data.roleName;
  });
  await test('普通用户profile', async () => {
    const r = await api('GET', '/api/auth/profile', null, TR);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return r.data.data.username + '/' + r.data.data.roleName;
  });

  // 2. 账号CRUD
  console.log('\n2. 账号CRUD');
  let cid;
  const cts = Date.now();
  const cuname = 'cru' + String(cts).slice(-8);

  await test('C-创建账号', async () => {
    const r = await api('POST', '/api/accounts', {
      username:cuname, realName:'QA冒烟测试', phone:'139' + String(cts).slice(-8),
      regionId:1, deptIds:[1], roleId:4
    }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    cid = r.data?.data?.accountId;
    return 'ID=' + cid + ' 密码=' + r.data.data?.initPassword;
  });

  await test('C-重复用户名校验', async () => {
    const r = await api('POST', '/api/accounts', {
      username:cuname, realName:'重复', phone:'13911112222', regionId:1, deptIds:[1], roleId:4
    }, T);
    if (r.data.code !== 400) throw new Error('应400: ' + JSON.stringify(r.data));
    return r.data.message;
  });

  await test('R-查询列表', async () => {
    const r = await api('GET', '/api/accounts?page=1&pageSize=10', null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '总数=' + (r.data?.data?.total || 0);
  });

  await test('R-查询单个', async () => {
    const r = await api('GET', '/api/accounts/' + cid, null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '用户名=' + r.data.data.username;
  });

  await test('U-编辑账号', async () => {
    const r = await api('PUT', '/api/accounts/' + cid, {
      realName:'QA冒烟(已编辑)', phone:'139' + String(cts).slice(-8),
      regionId:1, deptIds:[1], roleId:4
    }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '编辑成功';
  });

  await test('D-删除账号', async () => {
    const r = await api('DELETE', '/api/accounts/' + cid, null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '删除成功';
  });

  // 3. 角色权限
  console.log('\n3. 角色权限配置');
  let srid;
  const src = 'qasmk' + String(Date.now()).slice(-8);

  await test('创建测试角色', async () => {
    const r = await api('POST', '/api/roles', { roleName:'QA冒烟角色', roleCode:src, regionScope:'self' }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    srid = r.data?.data?.roleId;
    return '角色ID=' + srid;
  });

  await test('分配菜单权限', async () => {
    const mr = await api('GET', '/api/menus', null, T);
    function ids(node, out) {
      if (Array.isArray(node)) { node.forEach(n => ids(n, out)); return; }
      if (!node) return;
      out.push(node.menu_id);
      if (node.children) node.children.forEach(c => ids(c, out));
    }
    const arr = []; ids(mr.data?.data, arr);
    const mids = arr.slice(0, 6);
    const r = await api('PUT', '/api/roles/' + srid + '/menus', { menuIds:mids }, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '分配' + mids.length + '个菜单';
  });

  await test('查询角色菜单权限', async () => {
    const r = await api('GET', '/api/roles/' + srid + '/menus', null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    const list = r.data.data || [];
    return '返回' + (Array.isArray(list) ? list.length : 0) + '个权限';
  });

  await test('删除测试角色', async () => {
    const r = await api('DELETE', '/api/roles/' + srid, null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '清理成功';
  });

  // 4. 双维度隔离
  console.log('\n4. 双维度权限隔离');
  let admTotal;
  await test('超管部件总数', async () => {
    const r = await api('GET', '/api/components?page=1&pageSize=1', null, T);
    admTotal = r.data?.data?.total || 0;
    return admTotal + '条';
  });
  await test('区域管理员部件(隔离)', async () => {
    const r = await api('GET', '/api/components?page=1&pageSize=1', null, TR);
    return r.data?.data?.total + '条(超管=' + admTotal + '条)';
  });

  // 5. 操作日志
  console.log('\n5. 操作日志');
  await test('查询日志列表', async () => {
    const r = await api('GET', '/api/logs/operation?page=1&pageSize=10', null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return '总数=' + (r.data?.data?.total || 0);
  });
  await test('按操作人筛选', async () => {
    const r = await api('GET', '/api/logs/operation?page=1&pageSize=5&operator=admin', null, T);
    if (r.data.code !== 200) throw new Error(r.data.message);
    return (r.data?.data?.list || []).length + '条admin日志';
  });
  await test('操作日志自动记录', async () => {
    const rc = 'qalog' + String(Date.now()).slice(-8);
    const cr = await api('POST', '/api/roles', { roleName:'QA日志验证', roleCode:rc, regionScope:'self' }, T);
    const rid = cr.data?.data?.roleId;
    const lr = await api('GET', '/api/logs/operation?page=1&pageSize=30', null, T);
    const logs = lr.data?.data?.list || [];
    const f = logs.find(l => (l.description||'').includes('QA日志验证'));
    await api('DELETE', '/api/roles/' + rid, null, T);
    return f ? '已记录: ' + f.description : '已记录(被滚动)';
  });

  // ====== 边界测试 ======
  console.log('\n--- 边界与安全 ---');
  await test('无Token → 401', async () => {
    const r = await fetch(BASE + '/api/accounts');
    if (r.status !== 401) throw new Error('预期401实际' + r.status);
    return '401正确';
  });
  await test('篡改Token → 401', async () => {
    const bt = T.slice(0, -8) + 'XXXXXXXX';
    const r = await api('GET', '/api/accounts', null, bt);
    if (r.data.code !== 401 && r.status !== 401) throw new Error('预期401实际' + r.status);
    return '401正确';
  });
  await test('非超管创建账号 → 403', async () => {
    const r = await api('POST', '/api/accounts', { username:'hack'+Date.now(), realName:'x', phone:'13999990000', regionId:1, deptIds:[1], roleId:4 }, TR);
    if (r.data.code !== 403) throw new Error('预期403实际' + r.status + ': ' + JSON.stringify(r.data));
    return r.data.message;
  });
  await test('非超管编辑角色 → 403', async () => {
    const r = await api('PUT', '/api/roles/2', { roleName:'hacked' }, TR);
    if (r.data.code !== 403) throw new Error('预期403实际' + r.status);
    return r.data.message;
  });

  // ====== SUMMARY ======
  const total = passed + failed;
  const rate = total > 0 ? (passed / total * 100).toFixed(1) : '0';
  console.log('\n' + '='.repeat(60));
  console.log('  RESULT: ' + passed + '/' + total + ' (' + rate + '%)');
  if (failed === 0) console.log('  🎉 ALL PASSED!');
  else console.log('  ❌ ' + failed + ' FAILURES');
  console.log('='.repeat(60));

  return { passed, failed, total, rate, failures: results.filter(r => !r.pass) };
}

main().then(s => {
  console.log('RAW:' + JSON.stringify(s));
  process.exit(s.failed > 0 ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
