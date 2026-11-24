# 城市部件数据管理平台 v2

## 🔐 权限体系完整版

基于原城市部件管理平台，新增完整的身份认证与权限管理体系。

### 新增内容

| 模块 | 说明 |
|------|------|
| **登录认证** | 账号密码登录 + 图形验证码 + JWT Token |
| **账号管理** | 10项字段、CRUD、启用/禁用、重置密码、登录日志 |
| **RBAC权限** | 角色管理 + 菜单权限树 + 按钮级权限控制 |
| **双维度隔离** | 行政区域权限（横向）+ 组织部门权限（纵向） |
| **行政区域管理** | 四级树形（市→区/县→街道/乡镇→社区/村） |
| **组织部门管理** | 平级列表CRUD，含关联校验 |
| **操作日志** | 自动记录所有写操作，支持查询和导出 |
| **字段脱敏** | 按角色配置敏感字段脱敏规则 |
| **区域例外** | 角色可配置额外可访问区域 |

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 纯 HTML/CSS/JS（无框架），政务科技蓝主题 |
| 后端 | Node.js + Express |
| 数据库 | SQLite（better-sqlite3，零配置） |
| 认证 | JWT（jsonwebtoken）+ bcryptjs |
| 验证码 | svg-captcha |

### 数据库表（10张）

1. `sys_account` — 系统账号表
2. `sys_login_log` — 登录日志表
3. `sys_role` — 角色表
4. `sys_menu` — 菜单权限表
5. `sys_role_menu` — 角色-菜单关联表
6. `sys_role_region_exception` — 角色区域例外表
7. `sys_field_mask` — 字段脱敏配置表
8. `sys_region` — 行政区域表
9. `sys_department` — 组织部门表
10. `sys_operation_log` — 操作日志表

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

浏览器访问: **http://localhost:3000**

### 默认账号

| 账号 | 密码 | 角色 |
|------|------|------|
| `admin` | `admin123` | 超级管理员 |
| `region_admin` | `admin123` | 区域管理员 |

## API 接口

所有 API 返回统一格式：`{ code, message, data }`

| code | 说明 |
|------|------|
| 200 | 成功 |
| 400 | 参数校验失败 |
| 401 | 未登录或 Token 过期 |
| 403 | 无操作权限 |
| 404 | 资源不存在 |
| 423 | 账号已锁定 |
| 500 | 服务器内部错误 |

### 认证模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 账号密码登录 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/captcha` | 获取图形验证码 |
| GET | `/api/auth/profile` | 获取当前用户信息(含菜单权限) |
| PUT | `/api/auth/password` | 修改当前用户密码 |

### 账号管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/accounts` | 查询账号列表(分页+筛选) |
| GET | `/api/accounts/:id` | 获取账号详情 |
| POST | `/api/accounts` | 新增账号 |
| PUT | `/api/accounts/:id` | 编辑账号 |
| DELETE | `/api/accounts/:id` | 删除账号 |
| PUT | `/api/accounts/:id/status` | 启用/禁用 |
| PUT | `/api/accounts/:id/reset-password` | 重置密码 |
| GET | `/api/accounts/:id/login-logs` | 获取登录日志 |
| GET | `/api/accounts/check-username` | 校验用户名唯一性 |

### 角色管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/roles` | 查询角色列表 |
| GET | `/api/roles/:id` | 获取角色详情 |
| POST | `/api/roles` | 新增角色 |
| PUT | `/api/roles/:id` | 编辑角色 |
| DELETE | `/api/roles/:id` | 删除角色 |
| GET | `/api/roles/:id/menus` | 获取角色菜单权限树 |
| PUT | `/api/roles/:id/menus` | 保存角色菜单权限 |
| GET | `/api/roles/:id/regions` | 获取角色区域例外配置 |
| PUT | `/api/roles/:id/regions` | 保存角色区域例外 |
| GET | `/api/roles/:id/field-masks` | 获取字段脱敏配置 |
| PUT | `/api/roles/:id/field-masks` | 保存字段脱敏配置 |

### 菜单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/menus` | 查询全部菜单树 |
| GET | `/api/menus/:id` | 获取菜单详情 |
| POST | `/api/menus` | 新增菜单 |
| PUT | `/api/menus/:id` | 编辑菜单 |
| DELETE | `/api/menus/:id` | 删除菜单 |

### 行政区域

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/regions/tree` | 获取全部区域树 |
| GET | `/api/regions` | 查询区域列表(按parent_id) |
| GET | `/api/regions/:id` | 获取区域详情 |
| POST | `/api/regions` | 新增区域 |
| PUT | `/api/regions/:id` | 编辑区域 |
| DELETE | `/api/regions/:id` | 删除区域 |
| GET | `/api/regions/:id/children` | 获取子区域列表 |

### 组织部门

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/departments` | 查询部门列表(分页) |
| GET | `/api/departments/all` | 获取全部启用部门(下拉用) |
| GET | `/api/departments/:id` | 获取部门详情 |
| POST | `/api/departments` | 新增部门 |
| PUT | `/api/departments/:id` | 编辑部门 |
| DELETE | `/api/departments/:id` | 删除部门 |

### 操作日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/logs/operation` | 查询操作日志(分页+筛选) |
| GET | `/api/logs/operation/:id` | 获取日志详情 |
| GET | `/api/logs/operation/stats` | 操作日志统计 |

### 部件数据

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/components` | 获取部件列表（带区域权限过滤） |

## 权限体系设计

### 双维度隔离

```
用户权限 = 行政区域范围 ∩ 组织部门范围 ∩ 角色功能权限
```

- **行政区域权限（横向）**: 控制数据可见范围（本级/本级及下级/全部）
- **组织部门权限（纵向）**: 控制功能可用范围
- **RBAC角色**: 控制菜单和按钮级操作权限

### 权限中间件

```javascript
// 所有API请求经过三层校验
1. JWT Token 校验
2. 超管跳过权限校验
3. 功能权限校验（菜单权限标识）
4. 数据权限过滤（区域范围）
```

## 前端页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录页 | `/login.html` | 账号密码 + 图形验证码 |
| 主平台 | `/index.html` | 城市部件管理平台（GIS地图） |
| 系统管理 | `/admin.html` | 账号/角色/区域/部门/日志管理 |

## 文件结构

```
city-component-platform/
├── server.js              # Express 后端服务
├── init-db.js             # 数据库初始化脚本
├── package.json           # 依赖配置
├── platform.db            # SQLite 数据库文件
├── mock-data-min.json     # 部件模拟数据
├── app.js                 # 前端应用逻辑
├── index.html             # 主页面
├── public/
│   ├── login.html         # 登录页
│   ├── admin.html         # 系统管理控制台
│   ├── index.html         # 主页面副本
│   ├── app.js             # 前端逻辑副本
│   ├── mock-data-min.json # 数据副本
│   └── js/                # JS库
├── libs/                  # 地图库（Leaflet等）
├── assets/                # 静态资源
├── tiles/                 # 离线瓦片
└── README.md
```

## 运行配置

| 环境变量 | 说明 | 默认 |
|----------|------|------|
| `PORT` | 服务端口 | `3000` |
| `JWT_SECRET` | JWT 签名密钥 | 内置演示值 |
| `SF_DEFAULT_CITY` | 丰图地理编码默认城市（中文名或 adcode），留空表示不限城市 | 空 |
| `SF_POI_REGION` | 丰图 POI 搜索区域，留空使用服务默认范围 | 空 |

> 注意：页面由 `public/` 目录直接提供（`express.static`），修改前端后需同步 `public/` 下的文件。

## 研发交付清单

### ✅ 已实现

- [x] 模块1：登录账号管理（10项字段、6大功能、4项登录基础能力）
- [x] 模块2：权限管理核心（RBAC模型、双维度隔离、菜单权限、区域例外、字段脱敏）
- [x] 模块3：行政区域树形管理（四级树形、CRUD、21个节点）
- [x] 模块4：组织部门管理（平级列表、CRUD、关联校验）
- [x] 模块5：系统操作日志（自动记录、查询、详情查看）
- [x] JWT Token 鉴权（24小时有效期）
- [x] 图形验证码（5分钟有效期）
- [x] 密码锁定机制（5次错误锁定30分钟）
- [x] 首次登录强制修改密码
- [x] 与现有 mock-data-min.json 数据打通
- [x] 统一 API 响应格式 `{ code, message, data }`
- [x] 政务科技蓝前端主题
- [x] 一键启动 `node server.js`
