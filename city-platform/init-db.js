/**
 * 城市部件数据管理平台 - 数据库初始化脚本
 * 创建10张表 + 初始数据
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'platform.db');

console.log('🗄️  初始化数据库...');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// =================== 建表 ===================

db.exec(`
-- 1. 行政区域表
CREATE TABLE IF NOT EXISTS sys_region (
    region_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id    INTEGER NOT NULL DEFAULT 0,
    name         TEXT    NOT NULL,
    code         TEXT    NOT NULL,
    level        INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER DEFAULT 0,
    status       INTEGER DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(code)
);

-- 2. 组织部门表
CREATE TABLE IF NOT EXISTS sys_department (
    dept_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    code         TEXT    NOT NULL,
    leader       TEXT,
    phone        TEXT,
    sort_order   INTEGER DEFAULT 0,
    status       INTEGER DEFAULT 1,
    description  TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(code)
);

-- 3. 菜单权限表
CREATE TABLE IF NOT EXISTS sys_menu (
    menu_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id    INTEGER NOT NULL DEFAULT 0,
    name         TEXT    NOT NULL,
    type         INTEGER NOT NULL DEFAULT 2,
    path         TEXT,
    component    TEXT,
    permission   TEXT,
    icon         TEXT,
    sort_order   INTEGER DEFAULT 0,
    visible      INTEGER DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 4. 角色表
CREATE TABLE IF NOT EXISTS sys_role (
    role_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name    TEXT    NOT NULL,
    role_code    TEXT    NOT NULL,
    role_type    INTEGER NOT NULL DEFAULT 2,
    region_scope TEXT    NOT NULL DEFAULT 'self',
    description  TEXT,
    status       INTEGER DEFAULT 1,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(role_code)
);

-- 5. 角色-菜单关联表
CREATE TABLE IF NOT EXISTS sys_role_menu (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id      INTEGER NOT NULL,
    menu_id      INTEGER NOT NULL,
    UNIQUE(role_id, menu_id)
);

-- 6. 角色区域例外表
CREATE TABLE IF NOT EXISTS sys_role_region_exception (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id      INTEGER NOT NULL,
    region_id    INTEGER NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(role_id, region_id)
);

-- 7. 字段脱敏配置表
CREATE TABLE IF NOT EXISTS sys_field_mask (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id      INTEGER NOT NULL,
    table_name   TEXT    NOT NULL,
    field_name   TEXT    NOT NULL,
    mask_type    TEXT    NOT NULL DEFAULT 'full',
    UNIQUE(role_id, table_name, field_name)
);

-- 8. 系统账号表
CREATE TABLE IF NOT EXISTS sys_account (
    account_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username           TEXT    NOT NULL,
    password           TEXT    NOT NULL,
    real_name          TEXT    NOT NULL,
    phone              TEXT    NOT NULL,
    email              TEXT,
    status             INTEGER NOT NULL DEFAULT 1,
    region_id          INTEGER NOT NULL,
    dept_ids           TEXT    NOT NULL DEFAULT '[]',
    role_id            INTEGER NOT NULL DEFAULT 2,
    is_password_changed INTEGER NOT NULL DEFAULT 0,
    login_error_count  INTEGER NOT NULL DEFAULT 0,
    locked_until       TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(username),
    UNIQUE(phone)
);

-- 9. 登录日志表
CREATE TABLE IF NOT EXISTS sys_login_log (
    log_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id   INTEGER NOT NULL,
    ip_address   TEXT    NOT NULL,
    user_agent   TEXT,
    result       INTEGER NOT NULL DEFAULT 1,
    fail_reason  TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 10. 操作日志表
CREATE TABLE IF NOT EXISTS sys_operation_log (
    log_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id    INTEGER NOT NULL,
    operator_name TEXT    NOT NULL,
    op_type       TEXT    NOT NULL,
    op_module     TEXT    NOT NULL,
    description   TEXT    NOT NULL,
    request_url   TEXT,
    request_params TEXT,
    op_ip         TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sa_region ON sys_account(region_id);
CREATE INDEX IF NOT EXISTS idx_sa_role ON sys_account(role_id);
CREATE INDEX IF NOT EXISTS idx_sa_status ON sys_account(status);
CREATE INDEX IF NOT EXISTS idx_ll_account ON sys_login_log(account_id);
CREATE INDEX IF NOT EXISTS idx_ll_created ON sys_login_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sr_parent ON sys_region(parent_id);
CREATE INDEX IF NOT EXISTS idx_sr_level ON sys_region(level);
CREATE INDEX IF NOT EXISTS idx_sol_account ON sys_operation_log(account_id);
CREATE INDEX IF NOT EXISTS idx_sol_module ON sys_operation_log(op_module);
CREATE INDEX IF NOT EXISTS idx_sol_type ON sys_operation_log(op_type);
CREATE INDEX IF NOT EXISTS idx_sol_created ON sys_operation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sm_parent ON sys_menu(parent_id);
`);

// =================== 插入种子数据 ===================

// 检查是否已有数据
const existingRole = db.prepare('SELECT COUNT(*) as cnt FROM sys_role').get();
if (existingRole.cnt > 0) {
  console.log('✅ 数据库已初始化，跳过种子数据');
  db.close();
  process.exit(0);
}

const insert = db.transaction(() => {

  // ---- 行政区域 - 四级树形 ----
  const regions = [
    [0, '襄阳市', '420600', 0, 1],
    [1, '襄城区', '420602', 1, 1],
    [1, '樊城区', '420603', 1, 2],
    [1, '襄州区', '420604', 1, 3],
    [1, '老河口市', '420605', 1, 4],
    [1, '枣阳市', '420606', 1, 5],
    [1, '宜城市', '420607', 1, 6],
    [1, '南漳县', '420608', 1, 7],
    [1, '谷城县', '420609', 1, 8],
    [1, '保康县', '420610', 1, 9],
    // 襄城区下属街道
    [2, '檀溪街道', '42060201', 2, 1],
    [2, '庞公街道', '42060202', 2, 2],
    [2, '古城街道', '42060203', 2, 3],
    // 樊城区下属街道
    [3, '中原街道', '42060301', 2, 1],
    [3, '清河口街道', '42060302', 2, 2],
    [3, '汉江街道', '42060303', 2, 3],
    // 襄州区下属
    [4, '张湾街道', '42060401', 2, 1],
    [4, '肖湾街道', '42060402', 2, 2],
    // 社区级别
    [11, '檀溪社区', '420602011', 3, 1],
    [11, '滨湖社区', '420602012', 3, 2],
    [12, '庞公祠社区', '420602021', 3, 1],
  ];
  const stmtRegion = db.prepare('INSERT INTO sys_region (parent_id, name, code, level, sort_order) VALUES (?,?,?,?,?)');
  regions.forEach(r => stmtRegion.run(...r));

  // ---- 组织部门 ----
  const depts = [
    ['城管局', 'cgj', '王建国', '0710-3500001', 1, '负责城市管理综合执法工作'],
    ['环卫处', 'hwc', '李卫华', '0710-3500002', 2, '负责城市环境卫生管理'],
    ['市政处', 'szc', '赵市政', '0710-3500003', 3, '负责市政基础设施维护'],
    ['园林局', 'ylj', '钱园林', '0710-3500004', 4, '负责城市园林绿化管理'],
    ['交通局', 'jtj', '孙交通', '0710-3500005', 5, '负责交通设施管理'],
    ['水利局', 'slj', '周水利', '0710-3500006', 6, '负责水利设施管理'],
    ['商务局', 'swj', null, null, 8, '负责商贸设施管理（部件业务主管部门）'],
    ['住建局', 'zjj', null, null, 9, '负责市政工程类设施管理'],
    ['交通委', 'jtw', null, null, 10, '负责交通设施管理'],
    ['卫健委', 'wjw', null, null, 11, '负责卫生健康类设施管理'],
    ['教育局', 'jyj', null, null, 12, '负责教育类设施管理'],
    ['环卫局', 'hwj', null, null, 13, '负责环境卫生管理'],
  ];
  const stmtDept = db.prepare('INSERT INTO sys_department (name, code, leader, phone, sort_order, description) VALUES (?,?,?,?,?,?)');
  depts.forEach(d => stmtDept.run(...d));

  // ---- 菜单树 ----
  const menus = [
    // 顶级
    [0, '系统管理', 1, '/system', null, null, 'setting', 1],
    [0, '部件管理', 1, '/components', null, null, 'dashboard', 2],
    [0, '统计报表', 1, '/stats', null, null, 'chart', 3],
    // 系统管理子菜单
    [3, '账号管理', 2, '/system/account', null, 'sys:account:list', 'user', 1],
    [4, '新增账号', 3, null, null, 'sys:account:add', null, 1],
    [4, '编辑账号', 3, null, null, 'sys:account:edit', null, 2],
    [4, '删除账号', 3, null, null, 'sys:account:delete', null, 3],
    [4, '重置密码', 3, null, null, 'sys:account:reset-pwd', null, 4],
    [4, '启用禁用', 3, null, null, 'sys:account:status', null, 5],
    [3, '角色管理', 2, '/system/role', null, 'sys:role:list', 'role', 2],
    [11, '新增角色', 3, null, null, 'sys:role:add', null, 1],
    [11, '编辑角色', 3, null, null, 'sys:role:edit', null, 2],
    [11, '删除角色', 3, null, null, 'sys:role:delete', null, 3],
    [3, '菜单管理', 2, '/system/menu', null, 'sys:menu:list', 'menu', 3],
    [3, '区域管理', 2, '/system/region', null, 'sys:region:list', 'location', 4],
    [3, '部门管理', 2, '/system/department', null, 'sys:dept:list', 'apartment', 5],
    [3, '操作日志', 2, '/system/log', null, 'sys:log:list', 'file-text', 6],
    // 部件管理子菜单
    [19, '部件列表', 2, '/components/list', null, 'component:list', 'list', 1],
    [20, '新增部件', 3, null, null, 'component:add', null, 1],
    [20, '编辑部件', 3, null, null, 'component:edit', null, 2],
    [20, '删除部件', 3, null, null, 'component:delete', null, 3],
    [20, '导出部件', 3, null, null, 'component:export', null, 4],
    // 统计报表子菜单
    [27, '区域统计', 2, '/stats/region', null, 'stats:region', 'chart', 1],
    [27, '分类统计', 2, '/stats/category', null, 'stats:category', 'chart', 2],
  ];
  
  let menuIdx = 1;
  const stmtMenu = db.prepare('INSERT INTO sys_menu (parent_id, name, type, path, component, permission, icon, sort_order) VALUES (?,?,?,?,?,?,?,?)');
  menus.forEach(m => {
    stmtMenu.run(...m);
    menuIdx++;
  });

  // ---- 角色 ----
  const stmtRole = db.prepare('INSERT INTO sys_role (role_name, role_code, role_type, region_scope, description) VALUES (?,?,?,?,?)');
  stmtRole.run('超级管理员', 'super_admin', 1, 'all', '系统最高权限管理员，不可删除');
  stmtRole.run('区域管理员', 'region_admin', 2, 'self_and_children', '区县级管理员，可查看本级及下级区域数据');
  stmtRole.run('普通操作员', 'operator', 2, 'self', '街道级操作员，仅查看本级数据');
  stmtRole.run('只读用户', 'viewer', 2, 'self', '仅可查看数据，不可修改');
  stmtRole.run('部门管理员', 'dept_admin', 3, 'self', '仅可配置本部门账号与归口本部门的部件模板');

  // 超级管理员拥有所有菜单权限
  const allMenuIds = db.prepare('SELECT menu_id FROM sys_menu').all();
  const stmtRm = db.prepare('INSERT INTO sys_role_menu (role_id, menu_id) VALUES (?,?)');
  allMenuIds.forEach(m => stmtRm.run(1, m.menu_id));

  // 区域管理员 - 可看部件和统计但不可管理系统
  const regionAdminMenus = [3,4,5,6,7,8,9,10,19,20,21,22,23,24,27,28,29,30];
  regionAdminMenus.forEach(mid => stmtRm.run(2, mid));

  // 普通操作员 - 仅部件管理权限
  const operatorMenus = [19,20,21,22,24,27,29];
  operatorMenus.forEach(mid => stmtRm.run(3, mid));

  // 只读用户 - 仅查看
  const viewerMenus = [19,27,29];
  viewerMenus.forEach(mid => stmtRm.run(4, mid));

  // 部门管理员 - 账号管理 + 部件管理 + 统计报表（不含角色/区域/部门/日志）
  const deptAdminMenus = [3,4,5,6,7,8,9,10,19,20,21,22,23,24,27,28,29,30];
  deptAdminMenus.forEach(mid => stmtRm.run(5, mid));

  // ---- 超管账号 ----
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO sys_account (username, password, real_name, phone, email, status, region_id, dept_ids, role_id, is_password_changed) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('admin', hash, '系统管理员', '13800000001', 'admin@xiangyang.gov.cn', 1, 1, '[1]', 1, 1);

  // 区域管理员账号
  const hash2 = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO sys_account (username, password, real_name, phone, email, status, region_id, dept_ids, role_id, is_password_changed) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('region_admin', hash2, '区域管理员', '13800000002', 'region@xiangyang.gov.cn', 1, 2, '[1,2]', 2, 1);

  // 部门管理员账号（归口商务局，dept_id=7；部件类型 SM 商贸设施归口商务局）
  const hash3 = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO sys_account (username, password, real_name, phone, email, status, region_id, dept_ids, role_id, is_password_changed) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('dept_admin', hash3, '商务部门管理员', '13800000003', 'dept@xiangyang.gov.cn', 1, 2, '[7]', 5, 1);

  console.log('✅ 种子数据写入完成');
});

insert();
db.close();
console.log('🎉 数据库初始化完成！');
console.log('   默认管理员账号: admin / admin123');
console.log('   区域管理员账号: region_admin / admin123');
console.log('   部门管理员账号: dept_admin / admin123（商务局）');
