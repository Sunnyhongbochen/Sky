// 访问密码中间件的本地回归测试（不依赖 wrangler）
// 运行：node tests/middleware-auth.test.mjs
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const onRequest = mod.onRequest;

const ORIGIN = 'https://summer-website.pages.dev';
const DEFAULT_PASSWORD = '18924609490';

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log('  PASS', name);
  } else {
    fail += 1;
    console.log('  FAIL', name, extra);
  }
}

function ctx(path, opts = {}) {
  return {
    request: new Request(ORIGIN + path, {
      method: opts.method || 'GET',
      headers: new Headers(opts.headers || {}),
      body: opts.body,
    }),
    env: opts.env || {},
    next: async () => new Response('<html>OK page</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }),
  };
}

const post = (path, payload, env) => ctx(path, {
  method: 'POST',
  body: JSON.stringify(payload),
  headers: { 'Content-Type': 'application/json' },
  env,
});

console.log('1. 未登录访问首页');
let r = await onRequest(ctx('/'));
check('302 跳转', r.status === 302, r.status);
check('Location 指向 /login', (r.headers.get('Location') || '').includes('/login'), r.headers.get('Location'));
check('带 noindex 头', r.headers.get('X-Robots-Tag') === 'noindex');

console.log('2. 保留原始路径');
r = await onRequest(ctx('/notes/abc/?x=1'));
check('next 参数保留路径', decodeURIComponent(r.headers.get('Location') || '').includes('/notes/abc/?x=1'), r.headers.get('Location'));

console.log('3. 静态资源放行');
for (const p of ['/favicon.svg', '/css/style.css', '/sitemap.xml']) {
  r = await onRequest(ctx(p));
  check(`${p} 200`, r.status === 200, r.status);
}

console.log('4. 登录页放行');
r = await onRequest(ctx('/login'));
check('/login 200', r.status === 200, r.status);
check('安全响应头 nosniff', r.headers.get('X-Content-Type-Options') === 'nosniff');

console.log('5. 错误密码');
r = await onRequest(post('/api/login', { password: 'wrong' }));
check('401', r.status === 401, r.status);
check('success=false', (await r.json()).success === false);

console.log('6. 正确密码');
r = await onRequest(post('/api/login', { password: DEFAULT_PASSWORD, next: '/notes/' }));
check('200', r.status === 200, r.status);
const cookie = r.headers.get('Set-Cookie') || '';
check('下发 HttpOnly Cookie', cookie.includes('site_auth=') && cookie.includes('HttpOnly'), cookie);
check('Cookie 不含密码原文', !cookie.includes(DEFAULT_PASSWORD), cookie);
check('返回 next', (await r.json()).next === '/notes/');

const token = /site_auth=([^;]+)/.exec(cookie)?.[1] || '';

console.log('7. 带 Cookie 访问受保护页');
r = await onRequest(ctx('/notes/', { headers: { Cookie: `site_auth=${token}` } }));
check('200 放行', r.status === 200, r.status);
check('Cache-Control private', (r.headers.get('Cache-Control') || '').includes('private'), r.headers.get('Cache-Control'));

console.log('8. 伪造 Cookie');
r = await onRequest(ctx('/notes/', { headers: { Cookie: 'site_auth=deadbeef' } }));
check('302 拒绝', r.status === 302, r.status);

console.log('9. 环境变量覆盖密码');
r = await onRequest(post('/api/login', { password: DEFAULT_PASSWORD }, { SITE_PASSWORD: 'newpass' }));
check('旧密码失效', r.status === 401, r.status);
r = await onRequest(post('/api/login', { password: 'newpass' }, { SITE_PASSWORD: 'newpass' }));
check('新密码通过', r.status === 200, r.status);

console.log('10. next 防开放跳转');
r = await onRequest(post('/api/login', { password: DEFAULT_PASSWORD, next: '//evil.com/x' }));
check('外部站被拒', (await r.json()).next === '/');
r = await onRequest(post('/api/login', { password: DEFAULT_PASSWORD, next: 'https://evil.com/' }));
check('绝对地址被拒', (await r.json()).next === '/');

console.log('11. 退出登录');
r = await onRequest(ctx('/api/logout'));
check('302', r.status === 302, r.status);
check('清除 Cookie', (r.headers.get('Set-Cookie') || '').includes('Max-Age=0'));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
