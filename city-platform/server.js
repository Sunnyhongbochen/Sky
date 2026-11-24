/**
 * 城市部件数据管理平台 v2 — Express 后端服务
 * 含完整的身份认证与权限体系
 */
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'urban_components_2024_secret';
const JWT_EXPIRES = '24h';
const MAX_LOGIN_TRIES = 5;
const LOCK_MINUTES = 30;

// Database
const db = new Database(path.join(__dirname, 'platform.db'));
db.pragma('journal_mode = WAL');

// 部件模板表：按 部件类型（大类/小类/细类）存储定制属性字段
// 层级约定：大类级 minor_code='' AND detail_type=''；小类级 detail_type=''; 细类级三者齐全（细类无 code，以名称为键）
db.exec(`CREATE TABLE IF NOT EXISTS sys_component_template (
  field_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  major_code  TEXT NOT NULL,
  minor_code  TEXT NOT NULL DEFAULT '',
  detail_type TEXT NOT NULL DEFAULT '',
  field_key   TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type  TEXT NOT NULL DEFAULT 'text',
  options     TEXT,
  required    INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(major_code, minor_code, detail_type, field_key)
)`);

// ---- 增量迁移（SQLite：先查列再 ALTER，不依赖 IF NOT EXISTS 方言）----
// 模板归属部门：部门管理员只能配置归属本部门的类型模板；NULL=平台通用（仅超管）
(() => {
  const cols = db.prepare('PRAGMA table_info(sys_component_template)').all().map(c => c.name);
  if (!cols.includes('owner_dept')) {
    db.exec('ALTER TABLE sys_component_template ADD COLUMN owner_dept TEXT');
  }
})();

// 基础属性表：主平台属性面板字段，全局生效；仅超级管理员可增删改，其他角色只读
db.exec(`CREATE TABLE IF NOT EXISTS sys_base_field (
  field_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  field_key   TEXT NOT NULL UNIQUE,
  field_label TEXT NOT NULL,
  field_type  TEXT NOT NULL DEFAULT 'text',
  options     TEXT,
  required    INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
)`);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ====================== Helpers ======================
function ok(data = null, message = 'success') {
  return { code: 200, message, data };
}
function fail(message = 'error', code = 400) {
  return { code, message, data: null };
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

// ====================== JWT Middleware ======================
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json(fail('未登录或Token无效', 401));
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    // 检查账号是否仍有效
    const account = db.prepare('SELECT a.account_id, a.username, a.real_name, a.status, a.region_id, a.role_id, r.role_type FROM sys_account a LEFT JOIN sys_role r ON a.role_id=r.role_id WHERE a.account_id=?').get(payload.accountId);
    if (!account || account.status === 0) {
      return res.status(401).json(fail('账号已被禁用', 401));
    }
    req.user = {
      accountId: account.account_id,
      username: account.username,
      realName: account.real_name,
      regionId: account.region_id,
      roleId: account.role_id,
      roleType: account.role_type
    };
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json(fail('Token已过期，请重新登录', 401));
    }
    return res.status(401).json(fail('Token无效', 401));
  }
}

// 超管权限检查
function superAdminRequired(req, res, next) {
  if (req.user.roleType !== 1) {
    return res.status(403).json(fail('无操作权限，仅超级管理员可执行此操作', 403));
  }
  next();
}

// ====================== 功能权限：配置范围统一助手 ======================
// 管理角色三类：
//   super  超级管理员：账号/角色/区域/部门/部件模板（含基础属性）全部可配
//   region 区域管理员：仅可配置当前区域（region_id 等于本人）的账号
//   dept   部门管理员：仅可配置本部门（dept_ids 与本人有交集）账号、归属本部门的部件模板
//   none   其他角色（操作员/只读用户等）：无任何系统配置权限
function parseDeptIds(raw) {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a.map(Number).filter(x => Number.isInteger(x)) : []; }
  catch (e) { return []; }
}
function getRoleRow(roleId) {
  return db.prepare('SELECT role_id, role_name, role_code, role_type, region_scope FROM sys_role WHERE role_id=?').get(roleId);
}
function getManageKind(user) {
  if (!user) return 'none';
  if (user.roleType === 1) return 'super';
  const role = getRoleRow(user.roleId);
  if (!role) return 'none';
  if (role.role_code === 'region_admin') return 'region';
  if (role.role_code === 'dept_admin') return 'dept';
  return 'none';
}
function getOperatorDeptIds(user) {
  const row = db.prepare('SELECT dept_ids FROM sys_account WHERE account_id=?').get(user.accountId);
  return row ? parseDeptIds(row.dept_ids) : [];
}
function getOperatorDeptNames(user) {
  const ids = getOperatorDeptIds(user);
  if (!ids.length) return new Set();
  const ph = ids.map(() => '?').join(',');
  return new Set(db.prepare(`SELECT name FROM sys_department WHERE dept_id IN (${ph})`).all(...ids).map(d => d.name));
}
// 账号配置权限中间件：super/region/dept 放行，其余 403
function accountManageRequired(req, res, next) {
  const kind = getManageKind(req.user);
  if (kind === 'none') return res.status(403).json(fail('无账号配置权限', 403));
  req.manageKind = kind;
  next();
}
// 校验目标账号是否在操作者配置范围内；返回错误消息或 null
function accountScopeError(kind, user, account) {
  if (kind === 'super') return null;
  if (!account) return '账号不存在';
  if (kind === 'region') {
    return account.region_id === user.regionId ? null : '只能配置当前区域的账号';
  }
  if (kind === 'dept') {
    const mine = new Set(getOperatorDeptIds(user));
    const ids = parseDeptIds(account.dept_ids);
    return ids.some(id => mine.has(id)) ? null : '只能配置本部门的账号';
  }
  return '无账号配置权限';
}
// 校验可授予的目标角色：非超管不得授超管；部门管理员不得授区域管理员（不得越权提升管理域）
function roleAssignError(kind, targetRoleId) {
  if (kind === 'super') return null;
  const role = getRoleRow(targetRoleId);
  if (!role) return '角色不存在';
  if (role.role_type === 1 || role.role_code === 'super_admin') return '无权授予超级管理员角色';
  if (kind === 'dept' && role.role_code === 'region_admin') return '部门管理员无权授予区域管理员角色';
  return null;
}
// 写入账号时按管理范围强制收敛提交值
function applyAccountWriteScope(kind, user, payload) {
  if (kind === 'region') payload.regionId = user.regionId;
  if (kind === 'dept') {
    const mine = new Set(getOperatorDeptIds(user));
    payload.deptIds = (payload.deptIds || []).filter(id => mine.has(id));
  }
  return payload;
}

// 获取用户可见区域ID列表
function getUserRegionIds(regionId, roleType) {
  if (roleType === 1) return null; // 超管返回null表示全部
  const region = db.prepare('SELECT region_scope FROM sys_role WHERE role_id=(SELECT role_id FROM sys_account WHERE account_id=?)').get(regionId);
  // 简化：根据roleType决定scope
  const role = db.prepare('SELECT region_scope FROM sys_role WHERE role_id=(SELECT role_id FROM sys_account WHERE account_id=?)').get();
  
  // 直接用传入的regionId查角色scope
  // 实际实现：查该账号角色的region_scope
  return [regionId]; // 简化，后续可扩展递归子区域
}

// ====================== Operation Log ======================
function logOperation(accountId, operatorName, opType, opModule, description, req) {
  try {
    const params = req.method === 'GET' ? JSON.stringify(req.query) : JSON.stringify(req.body);
    const truncatedParams = params ? params.substring(0, 4000) : null;
    db.prepare(`INSERT INTO sys_operation_log (account_id, operator_name, op_type, op_module, description, request_url, request_params, op_ip)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      accountId, operatorName, opType, opModule, description,
      req.originalUrl || req.url, truncatedParams, getClientIP(req)
    );
  } catch (e) {
    console.error('操作日志记录失败:', e.message);
  }
}

// Auto-log middleware for write operations
function autoLog(req, res, next) {
  const origJson = res.json.bind(res);
  res.json = function (body) {
    if (req.user && ['POST', 'PUT', 'DELETE'].includes(req.method) && body && body.code === 200) {
      let opType = 'CREATE';
      if (req.method === 'PUT') opType = 'UPDATE';
      else if (req.method === 'DELETE') opType = 'DELETE';

      let opModule = 'OTHER';
      const url = req.originalUrl || req.url;
      if (url.includes('/accounts')) opModule = 'ACCOUNT';
      else if (url.includes('/roles')) opModule = 'ROLE';
      else if (url.includes('/menus')) opModule = 'MENU';
      else if (url.includes('/regions')) opModule = 'REGION';
      else if (url.includes('/departments')) opModule = 'DEPARTMENT';
      else if (url.includes('/components')) opModule = 'COMPONENT';
      else if (url.includes('/component-templates')) opModule = 'COMPONENT_TEMPLATE';

      let description = `${req.user.realName} `;
      if (opType === 'CREATE') description += '创建了';
      else if (opType === 'UPDATE') description += '更新了';
      else description += '删除了';

      const parts = url.split('/').filter(Boolean);
      const resource = parts[parts.length - 1] || '资源';
      description += ` ${getModuleName(opModule)} - ${resource}`;

      logOperation(req.user.accountId, req.user.realName, opType, opModule, description, req);
    }
    return origJson(body);
  };
  next();
}

function getModuleName(mod) {
  const map = { ACCOUNT: '账号', ROLE: '角色', MENU: '菜单', REGION: '区域', DEPARTMENT: '部门', COMPONENT: '部件', COMPONENT_TEMPLATE: '部件模板', OTHER: '其他' };
  return map[mod] || mod;
}

// Apply auto-log to write routes
app.use('/api/accounts', authMiddleware, autoLog);
app.use('/api/roles', authMiddleware, autoLog);
app.use('/api/menus', authMiddleware, autoLog);
app.use('/api/regions', authMiddleware, autoLog);
app.use('/api/departments', authMiddleware, autoLog);

// ====================== Captcha Store ======================
const captchaStore = new Map(); // captchaId -> { text, expires }

function cleanCaptchaStore() {
  const now = Date.now();
  for (const [k, v] of captchaStore) {
    if (now > v.expires) captchaStore.delete(k);
  }
}
setInterval(cleanCaptchaStore, 60000);

// ====================== AUTH ROUTES ======================

// 获取图形验证码
app.get('/api/auth/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: '0oOiIl1',
    noise: 2,
    color: true,
    background: '#f0f4ff'
  });
  const captchaId = uuidv4();
  captchaStore.set(captchaId, {
    text: captcha.text.toLowerCase(),
    expires: Date.now() + 5 * 60 * 1000
  });
  res.json(ok({ captchaId, svg: captcha.data }));
});

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password, captcha, captchaId } = req.body;

  if (!username || !password || !captcha || !captchaId) {
    return res.status(400).json(fail('请填写完整登录信息', 400));
  }

  // 验证码校验
  const cap = captchaStore.get(captchaId);
  if (!cap) {
    return res.status(400).json(fail('验证码已过期，请刷新', 400));
  }
  if (cap.text !== captcha.toLowerCase()) {
    captchaStore.delete(captchaId);
    return res.status(400).json(fail('验证码错误', 400));
  }
  captchaStore.delete(captchaId);

  // 查询账号
  const account = db.prepare(`SELECT a.*, r.role_name, r.role_type, r.region_scope FROM sys_account a LEFT JOIN sys_role r ON a.role_id=r.role_id WHERE a.username=?`).get(username);
  const ip = getClientIP(req);
  const ua = req.headers['user-agent'] || '';

  if (!account) {
    return res.status(400).json(fail('用户名或密码错误', 400));
  }

  // 检查锁定
  if (account.locked_until) {
    const lockTime = new Date(account.locked_until).getTime();
    if (Date.now() < lockTime) {
      const remain = Math.ceil((lockTime - Date.now()) / 60000);
      return res.status(423).json(fail(`账号已被锁定，请${remain}分钟后重试`, 423));
    }
    // 锁定时间已过，清除
    db.prepare('UPDATE sys_account SET login_error_count=0, locked_until=NULL WHERE account_id=?').run(account.account_id);
    account.login_error_count = 0;
  }

  // 检查禁用
  if (account.status === 0) {
    db.prepare('INSERT INTO sys_login_log (account_id, ip_address, user_agent, result, fail_reason) VALUES (?,?,?,0,?)')
      .run(account.account_id, ip, ua, '账号已禁用');
    return res.status(400).json(fail('该账号已被禁用，请联系管理员', 400));
  }

  // 验证密码
  if (!bcrypt.compareSync(password, account.password)) {
    const newCount = account.login_error_count + 1;
    if (newCount >= MAX_LOGIN_TRIES) {
      const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      db.prepare('UPDATE sys_account SET login_error_count=?, locked_until=? WHERE account_id=?').run(newCount, lockUntil, account.account_id);
      db.prepare('INSERT INTO sys_login_log (account_id, ip_address, user_agent, result, fail_reason) VALUES (?,?,?,0,?)')
        .run(account.account_id, ip, ua, '密码连续错误5次，已锁定30分钟');
      return res.status(423).json(fail('密码连续错误5次，账号已被锁定，请30分钟后重试', 423));
    }
    db.prepare('UPDATE sys_account SET login_error_count=? WHERE account_id=?').run(newCount, account.account_id);
    db.prepare('INSERT INTO sys_login_log (account_id, ip_address, user_agent, result, fail_reason) VALUES (?,?,?,0,?)')
      .run(account.account_id, ip, ua, '密码错误');
    const remain = MAX_LOGIN_TRIES - newCount;
    return res.status(400).json(fail(`用户名或密码错误，剩余尝试次数：${remain}`, 400));
  }

  // 登录成功
  db.prepare('UPDATE sys_account SET login_error_count=0, locked_until=NULL WHERE account_id=?').run(account.account_id);
  db.prepare('INSERT INTO sys_login_log (account_id, ip_address, user_agent, result, fail_reason) VALUES (?,?,?,1,NULL)')
    .run(account.account_id, ip, ua);

  // 生成JWT
  const token = jwt.sign({
    accountId: account.account_id,
    username: account.username,
    roleId: account.role_id,
    regionId: account.region_id
  }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  logOperation(account.account_id, account.real_name, 'LOGIN', 'ACCOUNT', `${account.real_name} 登录系统`, req);

  res.json(ok({
    token,
    accountId: account.account_id,
    username: account.username,
    realName: account.real_name,
    roleId: account.role_id,
    roleName: account.role_name,
    roleType: account.role_type,
    regionId: account.region_id,
    isPasswordChanged: account.is_password_changed
  }));
});

// 退出登录
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  res.json(ok(null, '退出成功'));
});

// 获取当前用户信息(含菜单权限)
app.get('/api/auth/profile', authMiddleware, (req, res) => {
  const account = db.prepare(`SELECT a.*, r.role_name, r.role_code, r.role_type, r.region_scope FROM sys_account a LEFT JOIN sys_role r ON a.role_id=r.role_id WHERE a.account_id=?`).get(req.user.accountId);
  if (!account) return res.status(404).json(fail('账号不存在', 404));

  // 获取菜单权限
  let menus;
  if (account.role_type === 1) {
    // 超管拥有所有菜单
    menus = db.prepare('SELECT * FROM sys_menu WHERE visible=1 ORDER BY sort_order').all();
  } else {
    menus = db.prepare(`SELECT DISTINCT m.* FROM sys_menu m
      INNER JOIN sys_role_menu rm ON m.menu_id=rm.menu_id
      WHERE rm.role_id=? AND m.visible=1 ORDER BY m.sort_order`).all(account.role_id);
  }

  // 获取权限标识列表
  let permissions;
  if (account.role_type === 1) {
    permissions = db.prepare('SELECT permission FROM sys_menu WHERE permission IS NOT NULL').all().map(r => r.permission);
  } else {
    permissions = db.prepare(`SELECT DISTINCT m.permission FROM sys_menu m
      INNER JOIN sys_role_menu rm ON m.menu_id=rm.menu_id
      WHERE rm.role_id=? AND m.permission IS NOT NULL`).all(account.role_id).map(r => r.permission);
  }

  res.json(ok({
    accountId: account.account_id,
    username: account.username,
    realName: account.real_name,
    phone: account.phone,
    email: account.email,
    status: account.status,
    regionId: account.region_id,
    deptIds: JSON.parse(account.dept_ids || '[]'),
    roleId: account.role_id,
    roleName: account.role_name,
    roleCode: account.role_code,
    roleType: account.role_type,
    manageKind: getManageKind({ roleType: account.role_type, roleId: account.role_id, accountId: account.account_id }),
    regionScope: account.region_scope,
    isPasswordChanged: account.is_password_changed,
    menus,
    permissions
  }));
});

// 修改密码
app.put('/api/auth/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json(fail('请填写旧密码和新密码', 400));
  }
  if (newPassword.length < 8 || newPassword.length > 20) {
    return res.status(400).json(fail('新密码长度需为8-20位', 400));
  }
  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
    return res.status(400).json(fail('新密码需包含字母和数字', 400));
  }
  const account = db.prepare('SELECT password FROM sys_account WHERE account_id=?').get(req.user.accountId);
  if (!bcrypt.compareSync(oldPassword, account.password)) {
    return res.status(400).json(fail('旧密码错误', 400));
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE sys_account SET password=?, is_password_changed=1 WHERE account_id=?').run(hash, req.user.accountId);
  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'ACCOUNT', `${req.user.realName} 修改了密码`, req);
  res.json(ok(null, '密码修改成功'));
});

// ====================== ACCOUNT ROUTES ======================

// 查询账号列表
app.get('/api/accounts', authMiddleware, (req, res) => {
  let { page = 1, pageSize = 10, username, realName, phone, status, regionId, deptId, roleId } = req.query;
  page = Math.max(1, parseInt(page));
  pageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 10));

  let where = ['1=1'];
  let params = [];

  // 账号配置范围（非超管同时受此约束，与数据查看范围无关）：
  // 区域管理员：仅当前区域账号；部门管理员：仅本部门账号（按 JSON 数组精确匹配 dept_id）
  const manageKind = getManageKind(req.user);
  if (manageKind === 'region') {
    where.push('a.region_id = ?');
    params.push(req.user.regionId);
  } else if (manageKind === 'dept') {
    const myDeptIds = getOperatorDeptIds(req.user);
    if (!myDeptIds.length) {
      where.push('1=0');
    } else {
      const ors = myDeptIds.map(() => "',' || replace(replace(a.dept_ids,'[',''),']','') || ',' LIKE ?").join(' OR ');
      where.push('(' + ors + ')');
      params.push(...myDeptIds.map(id => `%,${id},%`));
    }
  } else if (manageKind === 'none') {
    where.push('1=0');
  }
  if (username) { where.push('a.username LIKE ?'); params.push(`%${username}%`); }
  if (realName) { where.push('a.real_name LIKE ?'); params.push(`%${realName}%`); }
  if (phone) { where.push('a.phone LIKE ?'); params.push(`%${phone}%`); }
  if (status !== undefined && status !== '') { where.push('a.status = ?'); params.push(parseInt(status)); }
  if (regionId) { where.push('a.region_id = ?'); params.push(parseInt(regionId)); }
  if (deptId) { where.push('a.dept_ids LIKE ?'); params.push(`%${deptId}%`); }
  if (roleId) { where.push('a.role_id = ?'); params.push(parseInt(roleId)); }

  const whereClause = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM sys_account a WHERE ${whereClause}`).get(...params).cnt;
  const list = db.prepare(`SELECT a.account_id, a.username, a.real_name, a.phone, a.email, a.status, a.region_id, a.dept_ids, a.role_id, a.is_password_changed, a.created_at,
    r.name as region_name, ro.role_name
    FROM sys_account a LEFT JOIN sys_region r ON a.region_id=r.region_id LEFT JOIN sys_role ro ON a.role_id=ro.role_id
    WHERE ${whereClause} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);

  // 解析部门IDs
  const departments = db.prepare('SELECT dept_id, name FROM sys_department').all();
  const deptMap = Object.fromEntries(departments.map(d => [d.dept_id, d.name]));

  const result = list.map(a => ({
    ...a,
    deptIds: JSON.parse(a.dept_ids || '[]'),
    deptNames: JSON.parse(a.dept_ids || '[]').map(id => deptMap[id] || '').filter(Boolean).join('、')
  }));

  res.json(ok({ list: result, total, page, pageSize }));
});

// 校验用户名唯一性
app.get('/api/accounts/check-username', authMiddleware, (req, res) => {
  const { username, excludeId } = req.query;
  if (!username) return res.status(400).json(fail('用户名不能为空', 400));
  let sql = 'SELECT COUNT(*) as cnt FROM sys_account WHERE username=?';
  let params = [username];
  if (excludeId) { sql += ' AND account_id != ?'; params.push(parseInt(excludeId)); }
  const cnt = db.prepare(sql).get(...params).cnt;
  res.json(ok({ available: cnt === 0 }));
});

// 获取账号详情
app.get('/api/accounts/:id', authMiddleware, (req, res) => {
  const account = db.prepare('SELECT account_id, username, real_name, phone, email, status, region_id, dept_ids, role_id, is_password_changed, created_at, updated_at FROM sys_account WHERE account_id=?').get(parseInt(req.params.id));
  if (!account) return res.status(404).json(fail('账号不存在', 404));
  const scopeErr = accountScopeError(getManageKind(req.user), req.user, account);
  if (scopeErr) return res.status(403).json(fail(scopeErr, 403));
  account.deptIds = JSON.parse(account.dept_ids || '[]');
  res.json(ok(account));
});

// 新增账号（超管/区域管理员/部门管理员，各自受范围约束）
app.post('/api/accounts', authMiddleware, accountManageRequired, (req, res) => {
  const kind = req.manageKind;
  let { username, realName, phone, email, regionId, deptIds, roleId } = req.body;

  if (!username || !realName || !phone || !regionId || !deptIds || deptIds.length === 0 || !roleId) {
    return res.status(400).json(fail('请填写所有必填字段', 400));
  }
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
    return res.status(400).json(fail('用户名需为4-20位字母、数字或下划线', 400));
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json(fail('手机号格式不正确', 400));
  }
  const roleErr = roleAssignError(kind, parseInt(roleId));
  if (roleErr) return res.status(403).json(fail(roleErr, 403));
  // 按管理范围强制收敛：区管固定本区域；部门管只能挂本部门
  const payload = applyAccountWriteScope(kind, req.user, { regionId: parseInt(regionId), deptIds: (deptIds || []).map(Number) });
  regionId = payload.regionId; deptIds = payload.deptIds;
  if (!regionId || !deptIds.length) return res.status(403).json(fail(kind === 'region' ? '账号必须属于当前区域' : '账号必须属于本部门', 403));
  if (!db.prepare('SELECT region_id FROM sys_region WHERE region_id=?').get(regionId)) {
    return res.status(400).json(fail('所属区域不存在', 400));
  }

  const existing = db.prepare('SELECT COUNT(*) as cnt FROM sys_account WHERE username=? OR phone=?').get(username, phone);
  if (existing.cnt > 0) {
    return res.status(400).json(fail('用户名或手机号已存在', 400));
  }

  // 生成随机初始密码
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let initPwd = '';
  for (let i = 0; i < 8; i++) initPwd += chars[Math.floor(Math.random() * chars.length)];

  const hash = bcrypt.hashSync(initPwd, 10);
  const result = db.prepare('INSERT INTO sys_account (username, password, real_name, phone, email, region_id, dept_ids, role_id) VALUES (?,?,?,?,?,?,?,?)')
    .run(username, hash, realName, phone, email || null, regionId, JSON.stringify(deptIds), roleId);

  logOperation(req.user.accountId, req.user.realName, 'CREATE', 'ACCOUNT',
    `${req.user.realName} 创建了账号 ${username}`, req);

  res.json(ok({ accountId: result.lastInsertRowid, initPassword: initPwd }, `创建成功，初始密码为：${initPwd}`));
});

// 编辑账号（超管全量；区管仅本区域；部门管仅本部门，提交值被强制收敛）
app.put('/api/accounts/:id', authMiddleware, accountManageRequired, (req, res) => {
  const kind = req.manageKind;
  const id = parseInt(req.params.id);
  let { realName, phone, email, regionId, deptIds, roleId } = req.body;

  const account = db.prepare('SELECT * FROM sys_account WHERE account_id=?').get(id);
  if (!account) return res.status(404).json(fail('账号不存在', 404));
  const scopeErr = accountScopeError(kind, req.user, account);
  if (scopeErr) return res.status(403).json(fail(scopeErr, 403));

  if (!realName || !phone || !regionId || !deptIds || deptIds.length === 0 || !roleId) {
    return res.status(400).json(fail('请填写所有必填字段', 400));
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json(fail('手机号格式不正确', 400));
  }
  const roleErr = roleAssignError(kind, parseInt(roleId));
  if (roleErr) return res.status(403).json(fail(roleErr, 403));
  const payload = applyAccountWriteScope(kind, req.user, { regionId: parseInt(regionId), deptIds: (deptIds || []).map(Number) });
  regionId = payload.regionId; deptIds = payload.deptIds;
  if (!regionId || !deptIds.length) return res.status(403).json(fail(kind === 'region' ? '账号必须属于当前区域' : '账号必须属于本部门', 403));

  const dup = db.prepare('SELECT COUNT(*) as cnt FROM sys_account WHERE phone=? AND account_id!=?').get(phone, id);
  if (dup.cnt > 0) return res.status(400).json(fail('手机号已存在', 400));

  db.prepare('UPDATE sys_account SET real_name=?, phone=?, email=?, region_id=?, dept_ids=?, role_id=?, updated_at=datetime(\'now\',\'localtime\') WHERE account_id=?')
    .run(realName, phone, email || null, regionId, JSON.stringify(deptIds), roleId, id);

  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'ACCOUNT',
    `${req.user.realName} 编辑了账号 ${account.username}`, req);

  res.json(ok(null, '编辑成功'));
});

// 删除账号
app.delete('/api/accounts/:id', authMiddleware, accountManageRequired, (req, res) => {
  const kind = req.manageKind;
  const id = parseInt(req.params.id);
  if (id === req.user.accountId) return res.status(400).json(fail('不能删除自己', 400));
  const account = db.prepare('SELECT * FROM sys_account WHERE account_id=?').get(id);
  if (!account) return res.status(404).json(fail('账号不存在', 404));
  const scopeErr = accountScopeError(kind, req.user, account);
  if (scopeErr) return res.status(403).json(fail(scopeErr, 403));

  db.prepare('DELETE FROM sys_login_log WHERE account_id=?').run(id);
  db.prepare('DELETE FROM sys_operation_log WHERE account_id=?').run(id);
  db.prepare('DELETE FROM sys_account WHERE account_id=?').run(id);

  logOperation(req.user.accountId, req.user.realName, 'DELETE', 'ACCOUNT',
    `${req.user.realName} 删除了账号 ${account.username}`, req);

  res.json(ok(null, '删除成功'));
});

// 启用/禁用账号
app.put('/api/accounts/:id/status', authMiddleware, accountManageRequired, (req, res) => {
  const kind = req.manageKind;
  const id = parseInt(req.params.id);
  if (id === req.user.accountId) return res.status(400).json(fail('不能操作自己', 400));
  const { status } = req.body;
  const account = db.prepare('SELECT * FROM sys_account WHERE account_id=?').get(id);
  if (!account) return res.status(404).json(fail('账号不存在', 404));
  const scopeErr = accountScopeError(kind, req.user, account);
  if (scopeErr) return res.status(403).json(fail(scopeErr, 403));

  db.prepare('UPDATE sys_account SET status=?, updated_at=datetime(\'now\',\'localtime\') WHERE account_id=?').run(status, id);

  const action = status === 1 ? '启用' : '禁用';
  logOperation(req.user.accountId, req.user.realName, 'STATUS_CHANGE', 'ACCOUNT',
    `${req.user.realName} ${action}了账号 ${account.username}`, req);

  res.json(ok(null, `${action}成功`));
});

// 重置密码
app.put('/api/accounts/:id/reset-password', authMiddleware, accountManageRequired, (req, res) => {
  const kind = req.manageKind;
  const id = parseInt(req.params.id);
  const account = db.prepare('SELECT * FROM sys_account WHERE account_id=?').get(id);
  if (!account) return res.status(404).json(fail('账号不存在', 404));
  const scopeErr = accountScopeError(kind, req.user, account);
  if (scopeErr) return res.status(403).json(fail(scopeErr, 403));

  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let initPwd = '';
  for (let i = 0; i < 8; i++) initPwd += chars[Math.floor(Math.random() * chars.length)];

  const hash = bcrypt.hashSync(initPwd, 10);
  db.prepare('UPDATE sys_account SET password=?, is_password_changed=0, updated_at=datetime(\'now\',\'localtime\') WHERE account_id=?').run(hash, id);

  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'ACCOUNT',
    `${req.user.realName} 重置了账号 ${account.username} 的密码`, req);

  res.json(ok({ newPassword: initPwd }, `密码已重置为：${initPwd}`));
});

// 获取账号登录日志
app.get('/api/accounts/:id/login-logs', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const account = db.prepare('SELECT region_id, dept_ids FROM sys_account WHERE account_id=?').get(id);
  const scopeErr = accountScopeError(getManageKind(req.user), req.user, account);
  if (scopeErr) return res.status(403).json(fail(scopeErr, 403));
  const { page = 1, pageSize = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  const total = db.prepare('SELECT COUNT(*) as cnt FROM sys_login_log WHERE account_id=?').get(id).cnt;
  const list = db.prepare('SELECT * FROM sys_login_log WHERE account_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(id, parseInt(pageSize), offset);

  res.json(ok({ list, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

// ====================== ROLE ROUTES ======================

// 查询角色列表
app.get('/api/roles', authMiddleware, (req, res) => {
  const { roleName, status } = req.query;
  let where = ['1=1'];
  let params = [];
  if (roleName) { where.push('role_name LIKE ?'); params.push(`%${roleName}%`); }
  if (status !== undefined && status !== '') { where.push('status = ?'); params.push(parseInt(status)); }
  const list = db.prepare(`SELECT * FROM sys_role WHERE ${where.join(' AND ')} ORDER BY role_type ASC, role_id ASC`).all(...params);
  res.json(ok(list));
});

// 获取角色详情
app.get('/api/roles/:id', authMiddleware, (req, res) => {
  const role = db.prepare('SELECT * FROM sys_role WHERE role_id=?').get(parseInt(req.params.id));
  if (!role) return res.status(404).json(fail('角色不存在', 404));
  res.json(ok(role));
});

// 新增角色
app.post('/api/roles', authMiddleware, superAdminRequired, (req, res) => {
  const { roleName, roleCode, regionScope, description } = req.body;
  if (!roleName || !roleCode) return res.status(400).json(fail('角色名称和编码不能为空', 400));
  if (!['self', 'self_and_children', 'all'].includes(regionScope)) {
    return res.status(400).json(fail('区域范围值无效', 400));
  }
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM sys_role WHERE role_code=?').get(roleCode);
  if (existing.cnt > 0) return res.status(400).json(fail('角色编码已存在', 400));

  const result = db.prepare('INSERT INTO sys_role (role_name, role_code, region_scope, description) VALUES (?,?,?,?)')
    .run(roleName, roleCode, regionScope, description || null);

  logOperation(req.user.accountId, req.user.realName, 'CREATE', 'ROLE',
    `${req.user.realName} 创建了角色 ${roleName}`, req);

  res.json(ok({ roleId: result.lastInsertRowid }, '创建成功'));
});

// 编辑角色
app.put('/api/roles/:id', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const role = db.prepare('SELECT * FROM sys_role WHERE role_id=?').get(id);
  if (!role) return res.status(404).json(fail('角色不存在', 404));
  if (role.role_type === 1) return res.status(400).json(fail('超管角色不可编辑', 400));

  const { roleName, roleCode, regionScope, description, status } = req.body;
  if (!roleName) return res.status(400).json(fail('角色名称不能为空', 400));

  if (roleCode && roleCode !== role.role_code) {
    const dup = db.prepare('SELECT COUNT(*) as cnt FROM sys_role WHERE role_code=? AND role_id!=?').get(roleCode, id);
    if (dup.cnt > 0) return res.status(400).json(fail('角色编码已存在', 400));
  }

  db.prepare('UPDATE sys_role SET role_name=?, role_code=?, region_scope=?, description=?, status=?, updated_at=datetime(\'now\',\'localtime\') WHERE role_id=?')
    .run(roleName, roleCode || role.role_code, regionScope || role.region_scope, description !== undefined ? description : role.description,
      status !== undefined ? status : role.status, id);

  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'ROLE',
    `${req.user.realName} 编辑了角色 ${roleName}`, req);

  res.json(ok(null, '编辑成功'));
});

// 删除角色
app.delete('/api/roles/:id', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const role = db.prepare('SELECT * FROM sys_role WHERE role_id=?').get(id);
  if (!role) return res.status(404).json(fail('角色不存在', 404));
  if (role.role_type === 1) return res.status(400).json(fail('超管角色不可删除', 400));

  const accounts = db.prepare('SELECT COUNT(*) as cnt FROM sys_account WHERE role_id=?').get(id);
  if (accounts.cnt > 0) return res.status(400).json(fail(`存在${accounts.cnt}个账号关联此角色，请先迁移账号`, 400));

  db.prepare('DELETE FROM sys_role_menu WHERE role_id=?').run(id);
  db.prepare('DELETE FROM sys_role_region_exception WHERE role_id=?').run(id);
  db.prepare('DELETE FROM sys_field_mask WHERE role_id=?').run(id);
  db.prepare('DELETE FROM sys_role WHERE role_id=?').run(id);

  logOperation(req.user.accountId, req.user.realName, 'DELETE', 'ROLE',
    `${req.user.realName} 删除了角色 ${role.role_name}`, req);

  res.json(ok(null, '删除成功'));
});

// 获取角色菜单权限树
app.get('/api/roles/:id/menus', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const allMenus = db.prepare('SELECT * FROM sys_menu WHERE visible=1 ORDER BY sort_order').all();
  const roleMenus = db.prepare('SELECT menu_id FROM sys_role_menu WHERE role_id=?').all(id).map(r => r.menu_id);
  const tree = buildMenuTree(allMenus, roleMenus);
  res.json(ok({ menus: allMenus, roleMenuIds: roleMenus, tree }));
});

// 保存角色菜单权限
app.put('/api/roles/:id/menus', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const { menuIds } = req.body;
  const role = db.prepare('SELECT * FROM sys_role WHERE role_id=?').get(id);
  if (!role) return res.status(404).json(fail('角色不存在', 404));

  const run = db.transaction(() => {
    db.prepare('DELETE FROM sys_role_menu WHERE role_id=?').run(id);
    if (menuIds && menuIds.length > 0) {
      const stmt = db.prepare('INSERT OR IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (?,?)');
      menuIds.forEach(mid => stmt.run(id, mid));
    }
  });
  run();

  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'ROLE',
    `${req.user.realName} 修改了角色[${role.role_name}]的菜单权限`, req);

  res.json(ok(null, '保存成功'));
});

// 获取角色区域例外
app.get('/api/roles/:id/regions', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const regions = db.prepare('SELECT r.* FROM sys_role_region_exception re INNER JOIN sys_region r ON re.region_id=r.region_id WHERE re.role_id=?').all(id);
  const regionTree = db.prepare('SELECT * FROM sys_region ORDER BY parent_id, sort_order').all();
  res.json(ok({ exceptionRegions: regions.map(r => r.region_id), allRegions: regionTree }));
});

// 保存角色区域例外
app.put('/api/roles/:id/regions', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const { regionIds } = req.body;
  const role = db.prepare('SELECT * FROM sys_role WHERE role_id=?').get(id);
  if (!role) return res.status(404).json(fail('角色不存在', 404));

  const run = db.transaction(() => {
    db.prepare('DELETE FROM sys_role_region_exception WHERE role_id=?').run(id);
    if (regionIds && regionIds.length > 0) {
      const stmt = db.prepare('INSERT OR IGNORE INTO sys_role_region_exception (role_id, region_id) VALUES (?,?)');
      regionIds.forEach(rid => stmt.run(id, rid));
    }
  });
  run();

  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'ROLE',
    `${req.user.realName} 修改了角色[${role.role_name}]的区域例外配置`, req);

  res.json(ok(null, '保存成功'));
});

// 获取字段脱敏配置
app.get('/api/roles/:id/field-masks', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const masks = db.prepare('SELECT * FROM sys_field_mask WHERE role_id=?').all(id);
  res.json(ok(masks));
});

// 保存字段脱敏配置
app.put('/api/roles/:id/field-masks', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const { masks } = req.body;
  const role = db.prepare('SELECT * FROM sys_role WHERE role_id=?').get(id);
  if (!role) return res.status(404).json(fail('角色不存在', 404));

  const run = db.transaction(() => {
    db.prepare('DELETE FROM sys_field_mask WHERE role_id=?').run(id);
    if (masks && masks.length > 0) {
      const stmt = db.prepare('INSERT OR IGNORE INTO sys_field_mask (role_id, table_name, field_name, mask_type) VALUES (?,?,?,?)');
      masks.forEach(m => stmt.run(id, m.tableName, m.fieldName, m.maskType));
    }
  });
  run();
  res.json(ok(null, '保存成功'));
});

// ====================== MENU ROUTES ======================

app.get('/api/menus', authMiddleware, (req, res) => {
  const allMenus = db.prepare('SELECT * FROM sys_menu ORDER BY sort_order').all();
  const tree = buildMenuTree(allMenus, []);
  res.json(ok(tree));
});

app.get('/api/menus/:id', authMiddleware, (req, res) => {
  const menu = db.prepare('SELECT * FROM sys_menu WHERE menu_id=?').get(parseInt(req.params.id));
  if (!menu) return res.status(404).json(fail('菜单不存在', 404));
  res.json(ok(menu));
});

app.post('/api/menus', authMiddleware, superAdminRequired, (req, res) => {
  const { parentId, name, type, path, component, permission, icon, sortOrder, visible } = req.body;
  if (!name || !type) return res.status(400).json(fail('菜单名称和类型不能为空', 400));
  const result = db.prepare('INSERT INTO sys_menu (parent_id, name, type, path, component, permission, icon, sort_order, visible) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(parentId || 0, name, type, path || null, component || null, permission || null, icon || null, sortOrder || 0, visible !== undefined ? visible : 1);
  logOperation(req.user.accountId, req.user.realName, 'CREATE', 'MENU', `${req.user.realName} 创建了菜单 ${name}`, req);
  res.json(ok({ menuId: result.lastInsertRowid }, '创建成功'));
});

app.put('/api/menus/:id', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const menu = db.prepare('SELECT * FROM sys_menu WHERE menu_id=?').get(id);
  if (!menu) return res.status(404).json(fail('菜单不存在', 404));
  const { name, type, path, component, permission, icon, sortOrder, visible, parentId } = req.body;
  db.prepare('UPDATE sys_menu SET name=?, type=?, path=?, component=?, permission=?, icon=?, sort_order=?, visible=?, parent_id=?, updated_at=datetime(\'now\',\'localtime\') WHERE menu_id=?')
    .run(name || menu.name, type || menu.type, path !== undefined ? path : menu.path,
      component !== undefined ? component : menu.component, permission !== undefined ? permission : menu.permission,
      icon !== undefined ? icon : menu.icon, sortOrder !== undefined ? sortOrder : menu.sort_order,
      visible !== undefined ? visible : menu.visible, parentId !== undefined ? parentId : menu.parent_id, id);
  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'MENU', `${req.user.realName} 编辑了菜单 ${name || menu.name}`, req);
  res.json(ok(null, '编辑成功'));
});

app.delete('/api/menus/:id', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const children = db.prepare('SELECT COUNT(*) as cnt FROM sys_menu WHERE parent_id=?').get(id);
  if (children.cnt > 0) return res.status(400).json(fail(`存在${children.cnt}个子菜单，请先删除子菜单`, 400));
  const menu = db.prepare('SELECT name FROM sys_menu WHERE menu_id=?').get(id);
  if (!menu) return res.status(404).json(fail('菜单不存在', 404));
  db.prepare('DELETE FROM sys_role_menu WHERE menu_id=?').run(id);
  db.prepare('DELETE FROM sys_menu WHERE menu_id=?').run(id);
  logOperation(req.user.accountId, req.user.realName, 'DELETE', 'MENU', `${req.user.realName} 删除了菜单 ${menu.name}`, req);
  res.json(ok(null, '删除成功'));
});

// ====================== REGION ROUTES ======================

app.get('/api/regions/tree', authMiddleware, (req, res) => {
  const allRegions = db.prepare('SELECT * FROM sys_region ORDER BY parent_id, sort_order').all();
  const tree = buildRegionTree(allRegions, 0);
  res.json(ok(tree));
});

app.get('/api/regions', authMiddleware, (req, res) => {
  const { parentId } = req.query;
  let regions;
  if (parentId !== undefined) {
    regions = db.prepare('SELECT * FROM sys_region WHERE parent_id=? ORDER BY sort_order').all(parseInt(parentId));
  } else {
    regions = db.prepare('SELECT * FROM sys_region ORDER BY parent_id, sort_order').all();
  }
  res.json(ok(regions));
});

app.get('/api/regions/:id', authMiddleware, (req, res) => {
  const region = db.prepare('SELECT * FROM sys_region WHERE region_id=?').get(parseInt(req.params.id));
  if (!region) return res.status(404).json(fail('区域不存在', 404));
  res.json(ok(region));
});

app.get('/api/regions/:id/children', authMiddleware, (req, res) => {
  const children = db.prepare('SELECT * FROM sys_region WHERE parent_id=? ORDER BY sort_order').all(parseInt(req.params.id));
  res.json(ok(children));
});

app.post('/api/regions', authMiddleware, superAdminRequired, (req, res) => {
  const { parentId, name, code, level, sortOrder } = req.body;
  if (!name || !code || level === undefined) return res.status(400).json(fail('区域名称、编码和级别不能为空', 400));
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM sys_region WHERE code=?').get(code);
  if (existing.cnt > 0) return res.status(400).json(fail('区域编码已存在', 400));
  const result = db.prepare('INSERT INTO sys_region (parent_id, name, code, level, sort_order) VALUES (?,?,?,?,?)')
    .run(parentId || 0, name, code, level, sortOrder || 0);
  logOperation(req.user.accountId, req.user.realName, 'CREATE', 'REGION', `${req.user.realName} 创建了区域 ${name}`, req);
  res.json(ok({ regionId: result.lastInsertRowid }, '创建成功'));
});

app.put('/api/regions/:id', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const region = db.prepare('SELECT * FROM sys_region WHERE region_id=?').get(id);
  if (!region) return res.status(404).json(fail('区域不存在', 404));
  const { name, code, sortOrder, status } = req.body;
  if (code && code !== region.code) {
    const dup = db.prepare('SELECT COUNT(*) as cnt FROM sys_region WHERE code=? AND region_id!=?').get(code, id);
    if (dup.cnt > 0) return res.status(400).json(fail('区域编码已存在', 400));
  }
  db.prepare('UPDATE sys_region SET name=?, code=?, sort_order=?, status=?, updated_at=datetime(\'now\',\'localtime\') WHERE region_id=?')
    .run(name || region.name, code || region.code, sortOrder !== undefined ? sortOrder : region.sort_order,
      status !== undefined ? status : region.status, id);
  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'REGION', `${req.user.realName} 编辑了区域 ${name || region.name}`, req);
  res.json(ok(null, '编辑成功'));
});

app.delete('/api/regions/:id', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const region = db.prepare('SELECT name FROM sys_region WHERE region_id=?').get(id);
  if (!region) return res.status(404).json(fail('区域不存在', 404));

  // 检查子区域
  const children = db.prepare('SELECT COUNT(*) as cnt FROM sys_region WHERE parent_id=?').get(id);
  if (children.cnt > 0) return res.status(400).json(fail(`存在${children.cnt}个子区域，请先删除子区域`, 400));

  // 检查关联账号
  const accounts = db.prepare('SELECT COUNT(*) as cnt FROM sys_account WHERE region_id=?').get(id);
  if (accounts.cnt > 0) return res.status(400).json(fail(`存在${accounts.cnt}个账号关联此区域，请先迁移账号`, 400));

  db.prepare('DELETE FROM sys_role_region_exception WHERE region_id=?').run(id);
  db.prepare('DELETE FROM sys_region WHERE region_id=?').run(id);

  logOperation(req.user.accountId, req.user.realName, 'DELETE', 'REGION', `${req.user.realName} 删除了区域 ${region.name}`, req);
  res.json(ok(null, '删除成功'));
});

// ====================== DEPARTMENT ROUTES ======================

app.get('/api/departments/all', authMiddleware, (req, res) => {
  const depts = db.prepare('SELECT dept_id, name, code FROM sys_department WHERE status=1 ORDER BY sort_order').all();
  res.json(ok(depts));
});

app.get('/api/departments', authMiddleware, (req, res) => {
  let { page = 1, pageSize = 10, name, status } = req.query;
  page = Math.max(1, parseInt(page));
  pageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 10));

  let where = ['1=1'];
  let params = [];
  if (name) { where.push('name LIKE ?'); params.push(`%${name}%`); }
  if (status !== undefined && status !== '') { where.push('status = ?'); params.push(parseInt(status)); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM sys_department WHERE ${where.join(' AND ')}`).get(...params).cnt;
  const list = db.prepare(`SELECT * FROM sys_department WHERE ${where.join(' AND ')} ORDER BY sort_order LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  res.json(ok({ list, total, page, pageSize }));
});

app.get('/api/departments/:id', authMiddleware, (req, res) => {
  const dept = db.prepare('SELECT * FROM sys_department WHERE dept_id=?').get(parseInt(req.params.id));
  if (!dept) return res.status(404).json(fail('部门不存在', 404));
  res.json(ok(dept));
});

app.post('/api/departments', authMiddleware, superAdminRequired, (req, res) => {
  const { name, code, leader, phone, sortOrder, status, description } = req.body;
  if (!name || !code) return res.status(400).json(fail('部门名称和编码不能为空', 400));
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM sys_department WHERE code=?').get(code);
  if (existing.cnt > 0) return res.status(400).json(fail('部门编码已存在', 400));
  const result = db.prepare('INSERT INTO sys_department (name, code, leader, phone, sort_order, status, description) VALUES (?,?,?,?,?,?,?)')
    .run(name, code, leader || null, phone || null, sortOrder || 0, status !== undefined ? status : 1, description || null);
  logOperation(req.user.accountId, req.user.realName, 'CREATE', 'DEPARTMENT', `${req.user.realName} 创建了部门 ${name}`, req);
  res.json(ok({ deptId: result.lastInsertRowid }, '创建成功'));
});

app.put('/api/departments/:id', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const dept = db.prepare('SELECT * FROM sys_department WHERE dept_id=?').get(id);
  if (!dept) return res.status(404).json(fail('部门不存在', 404));
  const { name, code, leader, phone, sortOrder, status, description } = req.body;
  if (code && code !== dept.code) {
    const dup = db.prepare('SELECT COUNT(*) as cnt FROM sys_department WHERE code=? AND dept_id!=?').get(code, id);
    if (dup.cnt > 0) return res.status(400).json(fail('部门编码已存在', 400));
  }
  db.prepare('UPDATE sys_department SET name=?, code=?, leader=?, phone=?, sort_order=?, status=?, description=?, updated_at=datetime(\'now\',\'localtime\') WHERE dept_id=?')
    .run(name || dept.name, code || dept.code, leader !== undefined ? leader : dept.leader,
      phone !== undefined ? phone : dept.phone, sortOrder !== undefined ? sortOrder : dept.sort_order,
      status !== undefined ? status : dept.status, description !== undefined ? description : dept.description, id);
  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'DEPARTMENT', `${req.user.realName} 编辑了部门 ${name || dept.name}`, req);
  res.json(ok(null, '编辑成功'));
});

app.delete('/api/departments/:id', authMiddleware, superAdminRequired, (req, res) => {
  const id = parseInt(req.params.id);
  const dept = db.prepare('SELECT name FROM sys_department WHERE dept_id=?').get(id);
  if (!dept) return res.status(404).json(fail('部门不存在', 404));
  const accounts = db.prepare("SELECT COUNT(*) as cnt FROM sys_account WHERE dept_ids LIKE '%' || ? || '%'").get(String(id));
  if (accounts.cnt > 0) return res.status(400).json(fail(`存在${accounts.cnt}个账号关联此部门，请先解除关联`, 400));
  db.prepare('DELETE FROM sys_department WHERE dept_id=?').run(id);
  logOperation(req.user.accountId, req.user.realName, 'DELETE', 'DEPARTMENT', `${req.user.realName} 删除了部门 ${dept.name}`, req);
  res.json(ok(null, '删除成功'));
});

// ====================== OPERATION LOG ROUTES ======================

app.get('/api/logs/operation', authMiddleware, (req, res) => {
  let { page = 1, pageSize = 10, operatorName, opModule, opType, startTime, endTime } = req.query;
  page = Math.max(1, parseInt(page));
  pageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 10));

  let where = ['1=1'];
  let params = [];

  // 非超管只能看自己本级及下级区域的日志
  if (req.user.roleType !== 1) {
    where.push('l.account_id = ?');
    params.push(req.user.accountId);
  }
  if (operatorName) { where.push('l.operator_name LIKE ?'); params.push(`%${operatorName}%`); }
  if (opModule) { where.push('l.op_module = ?'); params.push(opModule); }
  if (opType) { where.push('l.op_type = ?'); params.push(opType); }
  if (startTime) { where.push('l.created_at >= ?'); params.push(startTime); }
  if (endTime) { where.push('l.created_at <= ?'); params.push(endTime + ' 23:59:59'); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM sys_operation_log l WHERE ${where.join(' AND ')}`).get(...params).cnt;
  const list = db.prepare(`SELECT * FROM sys_operation_log l WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json(ok({ list, total, page, pageSize }));
});

app.get('/api/logs/operation/stats', authMiddleware, (req, res) => {
  const byModule = db.prepare('SELECT op_module, COUNT(*) as cnt FROM sys_operation_log GROUP BY op_module ORDER BY cnt DESC').all();
  const byType = db.prepare('SELECT op_type, COUNT(*) as cnt FROM sys_operation_log GROUP BY op_type ORDER BY cnt DESC').all();
  const today = db.prepare("SELECT COUNT(*) as cnt FROM sys_operation_log WHERE date(created_at)=date('now','localtime')").get();
  res.json(ok({ byModule, byType, today: today.cnt }));
});

app.get('/api/logs/operation/:id', authMiddleware, (req, res) => {
  const log = db.prepare('SELECT * FROM sys_operation_log WHERE log_id=?').get(parseInt(req.params.id));
  if (!log) return res.status(404).json(fail('日志不存在', 404));
  res.json(ok(log));
});

// ====================== COMPONENT DATA API ======================
// 提供现有的部件数据（从JSON文件读取）

const fs = require('fs');
let componentData = null;
function getComponentData() {
  if (!componentData) {
    try {
      componentData = JSON.parse(fs.readFileSync(path.join(__dirname, 'mock-data-min.json'), 'utf-8'));
    } catch (e) {
      componentData = { objects: [], categoryTree: [], districts: [], departments: [], statistics: {} };
    }
  }
  return componentData;
}

// 解析账号数据权限范围：
// - 超管：全部
// - 区域：按角色 region_scope（all 不限 / self_and_children 本级及下级 / self 仅本级），
//   区域与部件数据按区县名称对齐（两侧行政区划编码体系不同）；街道/社区账号落到所属区县
// - 部门：账号 dept_ids 关联的部门名称集合，非空时仅可见这些部门的部件
function resolveDataScope(user) {
  const scope = { districtNames: null, deptNames: null }; // null 表示该维度不限制
  if (user.roleType === 1) return scope;
  const role = db.prepare('SELECT region_scope FROM sys_role WHERE role_id=?').get(user.roleId);
  const account = db.prepare('SELECT region_id, dept_ids FROM sys_account WHERE account_id=?').get(user.accountId);
  if (!account) { scope.districtNames = new Set(); scope.deptNames = new Set(); return scope; }

  if (!role || role.region_scope !== 'all') {
    const regions = db.prepare('SELECT region_id, parent_id, name, level FROM sys_region').all();
    const byId = Object.fromEntries(regions.map(r => [r.region_id, r]));
    const allowIds = new Set();
    const own = byId[account.region_id];
    if (own) {
      if (role && role.region_scope === 'self_and_children') {
        // 本级及全部下级（广度优先）
        const queue = [own.region_id];
        while (queue.length) {
          const id = queue.shift();
          if (allowIds.has(id)) continue;
          allowIds.add(id);
          regions.forEach(r => { if (r.parent_id === id) queue.push(r.region_id); });
        }
      } else {
        allowIds.add(own.region_id); // self
      }
    }
    // 映射到部件数据的区县名称：任一允许区域向上找到区县级（level=1）祖先
    const names = new Set();
    allowIds.forEach(id => {
      let r = byId[id];
      while (r && r.level > 1) r = byId[r.parent_id];
      if (r && r.level === 1) names.add(r.name);
      // level=0（市级）且 scope=self：不映射任何区县 → 市级本身无直管部件，结果为空
    });
    scope.districtNames = names;
  }

  const deptIds = (() => { try { return JSON.parse(account.dept_ids || '[]'); } catch (e) { return []; } })();
  if (Array.isArray(deptIds) && deptIds.length) {
    const ph = deptIds.map(() => '?').join(',');
    scope.deptNames = new Set(
      db.prepare(`SELECT name FROM sys_department WHERE dept_id IN (${ph})`).all(...deptIds).map(d => d.name)
    );
  }
  return scope;
}

// 获取部件数据（鉴权 + 区域/部门数据权限过滤）
app.get('/api/components', authMiddleware, (req, res) => {
  const data = getComponentData();
  const scope = resolveDataScope(req.user);

  let objects = data.objects;
  if (scope.districtNames) objects = objects.filter(o => scope.districtNames.has(o.districtName));
  if (scope.deptNames) objects = objects.filter(o => scope.deptNames.has(o.department));

  // 元数据同步裁剪：区县/街道、部门/业务系统只保留可见数据涉及的项
  const visibleDistricts = new Set(objects.map(o => o.districtName));
  const streetMap = {};
  objects.forEach(o => { (streetMap[o.districtName] = streetMap[o.districtName] || new Set()).add(o.streetName); });
  const districts = data.districts
    .filter(d => visibleDistricts.has(d.name))
    .map(d => ({ ...d, streets: d.streets.filter(s => (streetMap[d.name] || new Set()).has(s)) }));

  const visibleDepts = new Set(objects.map(o => o.department));
  const bizMap = {};
  objects.forEach(o => { (bizMap[o.department] = bizMap[o.department] || new Set()).add(o.bizSystem); });
  const departments = data.departments
    .filter(d => visibleDepts.has(d.name))
    .map(d => ({ ...d, systems: d.systems.filter(s => (bizMap[d.name] || new Set()).has(s.name)) }));

  res.json(ok({
    total: objects.length,
    objects,
    categoryTree: data.categoryTree,
    districts,
    departments
  }));
});

// ====================== COMPONENT TEMPLATE API ======================
// 部件模板：按部件类型（大类/小类/细类）定制属性字段，供新增/编辑部件时动态渲染表单
const TPL_FIELD_TYPES = ['text', 'number', 'date', 'select', 'multi', 'boolean'];
const TPL_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,49}$/;

// 基础属性：主平台属性面板的全部内置字段，作为初始基础属性集合。
// 现改为入库（sys_base_field）管理：仅超级管理员可新增/修改/删除；其他角色只读。
// 基础属性全局作用于所有部件类型；扩展属性中仍不允许与当前基础字段键重复。
const BASE_TEMPLATE_FIELDS = [
  { fieldKey: 'name',          fieldLabel: '部件名称', fieldType: 'text',   required: true,  options: [] },
  { fieldKey: 'censusCode',    fieldLabel: '普查编码', fieldType: 'text',   required: false, options: [] },
  { fieldKey: 'status',        fieldLabel: '状态',     fieldType: 'select', required: false, options: ['正常', '损坏', '废弃', '在建', '待维修'] },
  { fieldKey: 'majorCategory', fieldLabel: '大类',     fieldType: 'select', required: false, options: [] },
  { fieldKey: 'minorCategory', fieldLabel: '小类',     fieldType: 'select', required: false, options: [] },
  { fieldKey: 'detailType',    fieldLabel: '细类',     fieldType: 'select', required: false, options: [] },
  { fieldKey: 'level',         fieldLabel: '等级',     fieldType: 'select', required: false, options: ['一级', '二级', '三级', '普通'] },
  { fieldKey: 'districtName',  fieldLabel: '区县',     fieldType: 'select', required: false, options: [] },
  { fieldKey: 'streetName',    fieldLabel: '街道',     fieldType: 'select', required: false, options: [] },
  { fieldKey: 'department',    fieldLabel: '部门',     fieldType: 'select', required: false, options: [] },
  { fieldKey: 'bizSystem',     fieldLabel: '业务系统', fieldType: 'select', required: false, options: [] },
  { fieldKey: 'manager',       fieldLabel: '负责人',   fieldType: 'text',   required: false, options: [] },
  { fieldKey: 'phone',         fieldLabel: '联系电话', fieldType: 'text',   required: false, options: [] },
  { fieldKey: 'address',       fieldLabel: '地址',     fieldType: 'text',   required: false, options: [] },
  { fieldKey: 'longitude',     fieldLabel: '经度',     fieldType: 'number', required: false, options: [] },
  { fieldKey: 'latitude',      fieldLabel: '纬度',     fieldType: 'number', required: false, options: [] },
  { fieldKey: 'installDate',   fieldLabel: '安装日期', fieldType: 'date',   required: false, options: [] },
  { fieldKey: 'material',      fieldLabel: '材质',     fieldType: 'select', required: false, options: ['不锈钢', '铸铁', '混凝土', 'PE', '铝合金', '钢化玻璃'] },
  { fieldKey: 'area',          fieldLabel: '面积(㎡)', fieldType: 'number', required: false, options: [] },
  { fieldKey: 'censusDate',    fieldLabel: '普查日期', fieldType: 'date',   required: false, options: [] },
  { fieldKey: 'auditStatus',   fieldLabel: '审核状态', fieldType: 'select', required: false, options: ['已审核', '待审核', '已驳回'] },
  { fieldKey: 'auditor',       fieldLabel: '审核人',   fieldType: 'text',   required: false, options: [] }
];
// 首次启动空表时写入默认基础属性（已存在则不覆盖管理员的改动）
(() => {
  const cnt = db.prepare('SELECT COUNT(*) AS c FROM sys_base_field').get().c;
  if (cnt === 0) {
    const ins = db.prepare(`INSERT INTO sys_base_field (field_key, field_label, field_type, options, required, sort_order)
      VALUES (?,?,?,?,?,?)`);
    BASE_TEMPLATE_FIELDS.forEach((f, i) => ins.run(
      f.fieldKey, f.fieldLabel, f.fieldType,
      f.options && f.options.length ? JSON.stringify(f.options) : null,
      f.required ? 1 : 0, i
    ));
  }
})();

// ---- 功能权限迁移：部门管理员角色 + 补齐部件业务部门 + 演示账号（幂等）----
(() => {
  // 1) 部门管理员角色（role_type=3 表示部门级管理域，具体管理域以 role_code 为准）
  if (!db.prepare('SELECT role_id FROM sys_role WHERE role_code=?').get('dept_admin')) {
    db.prepare('INSERT INTO sys_role (role_name, role_code, role_type, region_scope, description) VALUES (?,?,?,?,?)')
      .run('部门管理员', 'dept_admin', 3, 'self', '仅可配置本部门账号与归口本部门的部件模板');
    const roleId = db.prepare('SELECT role_id FROM sys_role WHERE role_code=?').get('dept_admin').role_id;
    // 菜单：账号管理 + 部件管理 + 统计报表（不含角色/区域/部门管理）
    [3,4,5,6,7,8,9,10,19,20,21,22,23,24,27,28,29,30].forEach(mid =>
      db.prepare('INSERT OR IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (?,?)').run(roleId, mid));
  }
  // 2) 补齐部件样例数据中存在、组织表缺失的业务部门
  const addDept = (name, code, sortOrder) => {
    if (!db.prepare('SELECT dept_id FROM sys_department WHERE name=?').get(name)) {
      db.prepare('INSERT INTO sys_department (name, code, leader, phone, sort_order, status, description) VALUES (?,?,?,?,?,1,?)')
        .run(name, code, null, null, sortOrder, '部件业务主管部门（按数据治理补齐）');
    }
    return db.prepare('SELECT dept_id FROM sys_department WHERE name=?').get(name).dept_id;
  };
  const deptSwj = addDept('商务局', 'swj', 8);
  addDept('住建局', 'zjj', 9);
  addDept('交通委', 'jtw', 10);
  addDept('卫健委', 'wjw', 11);
  addDept('教育局', 'jyj', 12);
  addDept('环卫局', 'hwj', 13);
  // 3) 部门管理员演示账号（归口商务局 → 商贸设施/加油站 类型模板）
  if (!db.prepare('SELECT account_id FROM sys_account WHERE username=?').get('dept_admin')) {
    const roleId = db.prepare('SELECT role_id FROM sys_role WHERE role_code=?').get('dept_admin').role_id;
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO sys_account (username, password, real_name, phone, email, status, region_id, dept_ids, role_id, is_password_changed) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run('dept_admin', hash, '商务部门管理员', '13800000003', 'dept@xiangyang.gov.cn', 1, 2, JSON.stringify([deptSwj]), roleId, 1);
  }
})();

function getBaseFieldRows() {
  return db.prepare('SELECT * FROM sys_base_field WHERE status=1 ORDER BY sort_order, field_id').all();
}
function getBaseKeys() {
  return new Set(getBaseFieldRows().map(r => r.field_key));
}
function tplBaseOut(r, i) {
  return { fieldId: 'base-' + r.field_key, fieldKey: r.field_key, fieldLabel: r.field_label,
    fieldType: r.field_type, options: r.options ? JSON.parse(r.options) : [],
    required: !!r.required, sortOrder: typeof i === 'number' ? i : r.sort_order, isBase: true, locked: false };
}
function getBaseFieldsOut() {
  return getBaseFieldRows().map((r, i) => tplBaseOut(r, i));
}

function tplRowOut(r) {
  return {
    fieldId: r.field_id, majorCode: r.major_code, minorCode: r.minor_code, detailType: r.detail_type,
    ownerDept: r.owner_dept || null,
    fieldKey: r.field_key, fieldLabel: r.field_label, fieldType: r.field_type,
    options: r.options ? JSON.parse(r.options) : [],
    required: !!r.required, sortOrder: r.sort_order
  };
}

// 全量模板行（字段配置属公开元数据，登录页之外均可读取）
app.get('/api/component-templates', (req, res) => {
  const rows = db.prepare('SELECT * FROM sys_component_template WHERE status=1 ORDER BY major_code, minor_code, detail_type, sort_order').all();
  res.json(ok({ templates: rows.map(tplRowOut), baseFields: getBaseFieldsOut() }));
});

// 按类型解析生效模板：细类 → 小类 → 大类 三级回退
app.get('/api/component-templates/resolve', (req, res) => {
  const majorCode = (req.query.majorCode || '').trim();
  const minorCode = (req.query.minorCode || '').trim();
  const detailType = (req.query.detailType || '').trim();
  if (!majorCode) return res.status(400).json(fail('missing majorCode'));
  const q = (sql, args) => db.prepare(sql).all(...args).map(tplRowOut);
  let level = 'none', fields = [];
  if (minorCode && detailType) {
    fields = q("SELECT * FROM sys_component_template WHERE status=1 AND major_code=? AND minor_code=? AND detail_type=? ORDER BY sort_order", [majorCode, minorCode, detailType]);
    if (fields.length) level = 'detail';
  }
  if (!fields.length && minorCode) {
    fields = q("SELECT * FROM sys_component_template WHERE status=1 AND major_code=? AND minor_code=? AND detail_type='' ORDER BY sort_order", [majorCode, minorCode]);
    if (fields.length) level = 'minor';
  }
  if (!fields.length) {
    fields = q("SELECT * FROM sys_component_template WHERE status=1 AND major_code=? AND minor_code='' AND detail_type='' ORDER BY sort_order", [majorCode]);
    if (fields.length) level = 'major';
  }
  res.json(ok({ level, fields, baseFields: getBaseFieldsOut() }));
});

// 部件类型树（供管理后台建树，免拉整份 mock 数据）
app.get('/api/component-categories', (req, res) => {
  res.json(ok({ categoryTree: getComponentData().categoryTree }));
});

// 部件类型 → 主管部门：按部件样例数据中该大类下部门出现次数多数判定
// （sys_department 名称与部件部门名称对齐时生效；超管可在模板上用 owner_dept 显式覆盖）
let _majorDeptCache = null;
function majorDeptMap() {
  if (_majorDeptCache) return _majorDeptCache;
  const tally = {};
  getComponentData().objects.forEach(o => {
    if (!o.majorCode || !o.department) return;
    const t = (tally[o.majorCode] = tally[o.majorCode] || {});
    t[o.department] = (t[o.department] || 0) + 1;
  });
  _majorDeptCache = {};
  Object.entries(tally).forEach(([major, dist]) => {
    const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    _majorDeptCache[major] = top ? top[0] : null;
  });
  return _majorDeptCache;
}
// 某类型模板的归属部门：显式 owner_dept 优先，否则按大类多数部门
function templateOwnerDept(majorCode, existingRows) {
  if (existingRows && existingRows.length && existingRows[0].owner_dept) return existingRows[0].owner_dept;
  return majorDeptMap()[majorCode] || null;
}
function validateFieldList(fields, rejectBaseKeys) {
  if (!Array.isArray(fields)) return 'fields 必须为数组';
  const baseKeys = getBaseKeys();
  const seenKeys = new Set();
  for (const f of fields) {
    if (!f || !TPL_KEY_RE.test(f.fieldKey || '')) return '字段键非法（字母/数字/下划线，字母开头，≤50字符）: ' + (f && f.fieldKey);
    if (rejectBaseKeys && baseKeys.has(f.fieldKey)) return '「' + f.fieldKey + '」是系统基础属性，不能在扩展属性中重复定义';
    if (seenKeys.has(f.fieldKey)) return '字段键重复: ' + f.fieldKey;
    seenKeys.add(f.fieldKey);
    if (!f.fieldLabel || typeof f.fieldLabel !== 'string') return '字段显示名必填: ' + f.fieldKey;
    if (!TPL_FIELD_TYPES.includes(f.fieldType)) return '字段类型非法: ' + f.fieldType;
    // multi（多选）必须提供选项；select（单选）允许空选项（如大类/区县等动态来源字段）
    if (f.fieldType === 'multi' && (!Array.isArray(f.options) || !f.options.length)) {
      return '多选字段必须提供选项: ' + f.fieldKey;
    }
  }
  return null;
}

// 保存某类型的扩展属性（整体替换：事务内删旧插新）
// 超管：任意类型，可指定 ownerDept（'' 清除为平台通用，缺省保留/自动判定）
// 部门管理员：仅归属本部门的类型，owner_dept 强制为归属部门
app.post('/api/component-templates', authMiddleware, (req, res) => {
  const kind = getManageKind(req.user);
  if (kind !== 'super' && kind !== 'dept') {
    return res.status(403).json(fail('无部件模板配置权限', 403));
  }
  const { majorCode, minorCode = '', detailType = '', fields, ownerDept } = req.body || {};
  if (!majorCode || typeof majorCode !== 'string') return res.status(400).json(fail('majorCode 必填'));
  const cat = getComponentData().categoryTree.find(m => m.code === majorCode);
  if (!cat) return res.status(400).json(fail('未知的大类编码: ' + majorCode));
  if (minorCode) {
    const sub = (cat.children || []).find(c => c.code === minorCode);
    if (!sub) return res.status(400).json(fail('未知的小类编码: ' + minorCode));
    if (detailType && !(sub.children || []).some(d => d.name === detailType)) {
      return res.status(400).json(fail('未知的细类: ' + detailType));
    }
  } else if (detailType) {
    return res.status(400).json(fail('存在 detailType 但缺少 minorCode'));
  }
  const fieldErr = validateFieldList(fields, true);
  if (fieldErr) return res.status(400).json(fail(fieldErr));

  const existing = db.prepare('SELECT owner_dept FROM sys_component_template WHERE major_code=? AND minor_code=? AND detail_type=?')
    .all(majorCode, minorCode || '', detailType || '');

  let owner = templateOwnerDept(majorCode, existing);
  if (kind === 'dept') {
    const myDeptNames = getOperatorDeptNames(req.user);
    if (!owner || !myDeptNames.has(owner)) {
      return res.status(403).json(fail('该类型不归口当前部门，无权配置其模板', 403));
    }
  } else {
    // super：显式传值才改变归属；'' 表示平台通用
    if (ownerDept !== undefined) {
      owner = ownerDept ? String(ownerDept) : null;
      if (owner) {
        const okDept = db.prepare('SELECT COUNT(*) AS c FROM sys_department WHERE name=?').get(owner).c;
        if (!okDept) return res.status(400).json(fail('归属部门不存在: ' + owner));
      }
    }
  }

  const txn = db.transaction(() => {
    db.prepare("DELETE FROM sys_component_template WHERE major_code=? AND minor_code=? AND detail_type=?")
      .run(majorCode, minorCode || '', detailType || '');
    const ins = db.prepare(`INSERT INTO sys_component_template
      (major_code, minor_code, detail_type, field_key, field_label, field_type, options, required, sort_order, owner_dept)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    fields.forEach((f, i) => ins.run(
      majorCode, minorCode || '', detailType || '', f.fieldKey, f.fieldLabel.trim(), f.fieldType,
      (f.fieldType === 'select' || f.fieldType === 'multi') ? JSON.stringify(f.options) : null,
      f.required ? 1 : 0, typeof f.sortOrder === 'number' ? f.sortOrder : i, owner
    ));
  });
  txn();
  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'COMPONENT_TEMPLATE',
    `保存部件模板 ${majorCode}/${minorCode || '-'}/${detailType || '-'} 共 ${fields.length} 个字段（归属：${owner || '平台通用'}）`, req);
  res.json(ok({ saved: fields.length, ownerDept: owner }));
});

// 保存基础属性（整体替换；仅超级管理员）
app.put('/api/component-templates/base', authMiddleware, superAdminRequired, (req, res) => {
  const { fields } = req.body || {};
  const err = validateFieldList(fields, false);
  if (err) return res.status(400).json(fail(err));
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM sys_base_field').run();
    const ins = db.prepare(`INSERT INTO sys_base_field (field_key, field_label, field_type, options, required, sort_order, status)
      VALUES (?,?,?,?,?,?,1)`);
    fields.forEach((f, i) => ins.run(
      f.fieldKey, f.fieldLabel.trim(), f.fieldType,
      (f.fieldType === 'select' || f.fieldType === 'multi') ? JSON.stringify(f.options) : null,
      f.required ? 1 : 0, i
    ));
  });
  txn();
  logOperation(req.user.accountId, req.user.realName, 'UPDATE', 'COMPONENT_TEMPLATE',
    `保存基础属性，共 ${fields.length} 个字段`, req);
  res.json(ok({ saved: fields.length, baseFields: getBaseFieldsOut() }));
});

// ====================== Helper Functions ======================
function buildMenuTree(menus, checkedIds, parentId = 0) {
  return menus
    .filter(m => m.parent_id === parentId)
    .map(m => ({
      ...m,
      checked: checkedIds.includes(m.menu_id),
      children: buildMenuTree(menus, checkedIds, m.menu_id)
    }));
}

function buildRegionTree(regions, parentId = 0) {
  return regions
    .filter(r => r.parent_id === parentId)
    .map(r => ({
      ...r,
      children: buildRegionTree(regions, r.region_id)
    }));
}

// ====================== SF FengTu Map & Geocoding Proxy ======================
const SF_ADDR_KEY = '2767b2c8077d4400add8322df9865915';
const SF_MAP_KEY = 'aa6f05b79aad4225b735e058f9e21832';
const SF_TILE_HOST = 'https://gis-map-apis.sf-express.com';
const SF_TILE_AK = SF_MAP_KEY;
// Fengtu 瓦片完整解码链：JSON[1]=base64 → base64→Uint32 → TEA 解密 → Uint32→Uint8 → gunzip → 标准 MVT PBF
const zlib = require('zlib');
// TEA delta 常量（标准 Tiny Encryption Algorithm）
const SF_TEA_KM = 2654435769;
// TEA 固定密钥：hex 字符串经 XOR+nibble-swap 后取 ASCII
function sfDecodeTileBase64(b64) {
  const KEY_HEX = '82626121-5782-1454-1247-617142522121';
  // Step 1: hex key → ASCII → Uint32Array（TEA 密钥）
  const clean = KEY_HEX.replace(/[^a-z0-9]/g,'');
  const keyBytes = [];
  for (let i = 0; i < clean.length; i += 2) {
    let code = parseInt(clean.substr(i, 2), 16);
    code ^= ((i >> 1) & 2) > 0 ? 2 : 1;
    code = ((code & 0xff) >> 4) | ((15 & code) << 4);
    keyBytes.push(code);
  }
  const keyAscii = Buffer.from(keyBytes);
  const keyU32 = new Uint32Array(keyAscii.length >> 2);
  for (let i = 0; i < keyAscii.length; i += 4) {
    keyU32[i >> 2] = keyAscii[i] | keyAscii[i+1] << 8 | keyAscii[i+2] << 16 | keyAscii[i+3] << 24;
  }
  // Step 2: base64 → Uint8Array → Uint32Array（little-endian）
  const u8 = Buffer.from(b64, 'base64');
  const u32 = new Uint32Array((u8.length >> 2) + ((3 & u8.length) ? 1 : 0));
  for (let i = 0; i < u8.length; i++) u32[i >> 2] |= u8[i] << ((3 & i) << 3);
  // Step 3: TEA 解密
  const arr = Array.from(u32);
  const o = arr.length - 1;
  let u = arr[0];
  let l = Math.floor(6 + 52 / (o + 1)) * SF_TEA_KM >>> 0;
  while (l !== 0) {
    const n = (l >>> 2) & 3;
    for (let r = o; r > 0; r--) {
      const prev = arr[r - 1];
      const rhs = ((prev >>> 5) ^ (u << 2)) + ((u >>> 3) ^ (prev << 4)) ^ (l ^ u) + (keyU32[(3 & r) ^ n] ^ prev);
      arr[r] = (arr[r] - rhs) | 0;
      u = arr[r];
    }
    const rhs0 = ((arr[o] >>> 5) ^ (u << 2)) + ((u >>> 3) ^ (arr[o] << 4)) ^ (l ^ u) + (keyU32[n] ^ arr[o]);
    arr[0] = (arr[0] - rhs0) | 0;
    u = arr[0];
    l = (l - SF_TEA_KM) >>> 0;
  }
  // Step 4: Uint32Array → Uint8Array little-endian
  const decU8 = new Uint8Array(arr.length * 4);
  for (let i = 0; i < decU8.length; i++) decU8[i] = (arr[i >> 2] >>> ((3 & i) << 3)) & 255;
  // Step 5: gunzip → 标准 VectorTile PBF
  return zlib.gunzipSync(Buffer.from(decU8));
}

// 丰图矢量瓦片代理：fetch 新 host → JSON 中的 b64 → TEA 解密 + gunzip → 返回 PBF
app.get('/api/sf/tile', async (req, res) => {
  try {
    const { x, y, z } = req.query;
    if (x == null || y == null || z == null) return res.status(400).send('missing x/y/z');
    const upstream = SF_TILE_HOST + '/tile?x=' + x + '&y=' + y + '&z=' + z + '&mid=basemap&p=0&f=pbf&ak=' + SF_TILE_AK;
    const resp = await fetch(upstream);
    if (!resp.ok) { res.status(resp.status).send('upstream ' + resp.status); return; }
    const data = await resp.json();
    // 上游有两种数组布局：[1,b64,size] 与 [2,size,b64]，统一取字符串元素
    const b64 = Array.isArray(data) ? data.find(v => typeof v === 'string') : null;
    if (!b64) {
      res.status(502).send('unexpected tile format');
      return;
    }
    const pbf = sfDecodeTileBase64(b64);   // → 标准 VectorTile PBF
    const gzipped = zlib.gzipSync(pbf);         // mapbox-gl 期望 gzip
    res.set({
      'Content-Type': 'application/vnd.mapbox-vector-tile',
      'Content-Encoding': 'gzip',
      'Content-Length': gzipped.byteLength,
      'Cache-Control': 'public, max-age=3600'
    });
    res.send(gzipped);
  } catch (e) {
    res.status(502).send('tile proxy error: ' + String(e));
  }
});

// 丰图 sprite 代理：把远程 sprite 重写成本地同源路由，避免用户端直连 sf-express
// style.sprite 是 'https://.../sprites/v2/day'，maplibre 会追加 .png 和 .json
// Express 5 需用正则替代已废弃的 '*' 通配
app.get(/^\/api\/sf\/sprite(.*)$/, async (req, res) => {
  try {
    const m = req.path.match(/^\/api\/sf\/sprite(.*)$/);
    const suffix = m ? m[1] : ''; // e.g. "/day" or "/day.json" or "/day.png"
    const upstream = 'https://gis-map-apis.sf-express.com/MapVTService/vmapx/sprites/v2' + suffix;
    const resp = await fetch(upstream);
    if (!resp.ok) { res.status(resp.status).send('sprite upstream ' + resp.status); return; }
    const ct = resp.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await resp.arrayBuffer()));
  } catch (e) { res.status(502).send('sprite proxy error: ' + String(e)); }
});

// 丰图字体 glyph 代理：动态 path {fontstack}/{range}.pbf 转发，避免远程 sf-express 在公网侧不通
app.get('/api/sf/fonts/:fontstack/:range.pbf', async (req, res) => {
  try {
    const { fontstack, range } = req.params;
    const upstream = 'https://gis-map-apis.sf-express.com/MapVTService/vmapx/fonts/' +
      encodeURIComponent(fontstack) + '/' + encodeURIComponent(range) + '.pbf';
    const resp = await fetch(upstream);
    if (!resp.ok) { res.status(resp.status).send('font upstream ' + resp.status); return; }
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await resp.arrayBuffer()));
  } catch (e) { res.status(502).send('font proxy error: ' + String(e)); }
});

// 丰图白天矢量样式代理：fetch 新 host 样式 JSON → 重写 sources.*.tiles / sprite / glyphs 指向本地代理
app.get('/api/sf/style', async (req, res) => {
  try {
    const upstream = SF_TILE_HOST + '/MapVTService/vmapx/mapstyle/v2/3857/allvector_day';
    const resp = await fetch(upstream);
    if (!resp.ok) { res.status(resp.status).send('style upstream ' + resp.status); return; }
    const style = await resp.json();
    // 用绝对 URL：maplibre/mapbox worker 内相对地址基于 worker location 解析，可能不指向页面源
    // Cloudflare 隧道等反向代理会设置 x-forwarded-proto，需优先采用避免 https 页面里 style 引用 http 触发 Mixed Content
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const origin = proto + '://' + req.get('host');
    const newTiles = [origin + '/api/sf/tile?x={x}&y={y}&z={z}'];
    for (const srcName of Object.keys(style.sources || {})) {
      const src = style.sources[srcName];
      if (src && Array.isArray(src.tiles)) { src.tiles = newTiles; }
    }
    // sprite / glyphs 也改成本地同源路由，避免用户端直连 sf-express CDN（公网不通）
    if (typeof style.sprite === 'string') {
      style.sprite = origin + '/api/sf/sprite/day';
    }
    if (typeof style.glyphs === 'string') {
      style.glyphs = origin + '/api/sf/fonts/{fontstack}/{range}.pbf';
    }
    res.json(style);
  } catch (e) {
    res.status(502).send('style proxy error: ' + String(e));
  }
});

// 丰图逆地理编码 v2：GET /oplbs/v2/geocode/rgeo?x=lng&y=lat&range=100&cc=1&ak=地址key
// cc=1 指定 GCJ-02 坐标系；返回 result: { name, province, city, district, town, adcode, aoi, road, street_no }
app.get('/api/sf/regeo', async (req, res) => {
  try {
    const { lng, lat } = req.query;
    if (!lng || !lat) return res.status(400).json({ error: 'missing lng/lat' });
    const url = 'https://gis-apis.sf-express.com/oplbs/v2/geocode/rgeo?x='
      + encodeURIComponent(lng) + '&y=' + encodeURIComponent(lat)
      + '&range=100&cc=1&ak=' + SF_ADDR_KEY;
    const resp = await fetch(url);
    const data = await resp.json().catch(() => null);
    const item = (data && data.status === 0 && data.result) || null;
    const address = item && item.name ? item.name : '';
    res.json({
      status: resp.status,
      address,
      detail: item ? {
        province: item.province, city: item.city, district: item.district,
        town: item.town, adcode: item.adcode
      } : null,
      upstream: data
    });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

// 丰图地理编码 v1（地址搜索）：GET /oplbs/v1/geocode/geo?address=xxx&city=420600&cc=1
// ak 官方要求放 Header（同时兼容 URL 参数）；cc=1 指定 GCJ-02 坐标系；返回 result: { xcoord, ycoord, adcode, adname[] }
const SF_GEO_HEADERS = { ak: SF_ADDR_KEY };
app.get('/api/sf/geo', async (req, res) => {
  try {
    const { address, city } = req.query;
    if (!address) return res.status(400).json({ error: 'missing address' });
    // 默认城市可通过 SF_DEFAULT_CITY 配置（中文名或 adcode），留空表示不限城市
    const params = new URLSearchParams({ address, cc: '1' });
    const defaultCity = city || process.env.SF_DEFAULT_CITY || '';
    if (defaultCity) params.set('city', defaultCity);
    const url = 'https://gis-apis.sf-express.com/oplbs/v1/geocode/geo?' + params.toString();
    const resp = await fetch(url, { headers: SF_GEO_HEADERS });
    const data = await resp.json().catch(() => null);
    const r = (data && data.status === 0 && data.result) || null;
    res.json({
      status: resp.status,
      longitude: r ? Number(r.xcoord) : null,
      latitude: r ? Number(r.ycoord) : null,
      adname: r ? (Array.isArray(r.adname) ? r.adname.join('') : (r.adname || r.adcode || '')) : '',
      upstream: data
    });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

// 丰图 POI 地点搜索：GET /opsearch/v1/place/search?region=城市名&query=xxx&page_num=1&page_size=10
// 搜索范围可通过 SF_POI_REGION 配置；留空则使用服务默认范围
// ak 双通道（Header + URL 参数）；GCJ-02 坐标与底图一致，前端直接定位
// 返回归一化 list: [{ name, address, longitude, latitude, typeName, district }]
app.get('/api/sf/place/search', async (req, res) => {
  try {
    const query = (req.query.query || '').trim();
    if (!query) return res.status(400).json({ error: 'missing query' });
    const pageNum = Math.min(Math.max(parseInt(req.query.pageNum) || 1, 1), 5);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 10, 1), 20);
    const params = new URLSearchParams({
      query, page_num: String(pageNum), page_size: String(pageSize), ak: SF_ADDR_KEY
    });
    const poiRegion = process.env.SF_POI_REGION || '';
    if (poiRegion) params.set('region', poiRegion);
    const url = 'https://gis-apis.sf-express.com/opsearch/v1/place/search?' + params.toString();
    const resp = await fetch(url, { headers: SF_GEO_HEADERS });
    const data = await resp.json().catch(() => null);
    const rows = (data && data.status === 0 && Array.isArray(data.result)) ? data.result : [];
    const list = rows.map(it => ({
      name: it.name || '',
      address: it.address || '',
      longitude: it.location ? Number(it.location.lng) : null,
      latitude: it.location ? Number(it.location.lat) : null,
      typeName: it.type_name || '',
      district: it.town || ''
    })).filter(it => it.longitude != null && it.latitude != null);
    res.json({ status: resp.status, total: data && data.total != null ? data.total : list.length, list, upstream: data });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

// ====================== Static Files ======================
app.use(express.static(path.join(__dirname, 'public')));
app.use('/libs', express.static(path.join(__dirname, 'libs')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/tiles', express.static(path.join(__dirname, 'tiles')));
app.use('/webfonts', express.static(path.join(__dirname, 'webfonts')));

// Redirect root to main app
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// ====================== Start ======================
app.listen(PORT, () => {
  console.log(`\n🌆 城市部件数据管理平台 v2 已启动`);
  console.log(`   🔐 权限体系已就绪`);
  console.log(`   📍 地址: http://localhost:${PORT}`);
  console.log(`   🔑 超管: admin / admin123`);
  console.log(`   👤 区域管理员: region_admin / admin123`);
  console.log(`   🏢 部门管理员: dept_admin / admin123（商务局）\n`);
});
