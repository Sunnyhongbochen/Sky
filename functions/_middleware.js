// Cloudflare Pages Functions - 密码访问控制中间件
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 静态资源直接放行
  const staticExtensions = ['.css','.js','.png','.jpg','.jpeg','.gif','.svg','.ico','.woff','.woff2','.ttf','.eot','.webp','.xml','.json','.txt'];
  if (staticExtensions.some(ext => pathname.toLowerCase().endsWith(ext))) {
    return next();
  }

  // 登录页本身放行
  if (pathname === '/login' || pathname === '/login.html') {
    return next();
  }

  // 处理登录请求
  if (pathname === '/api/login' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (body.password === PASSWORD) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `auth_token=${encodeURIComponent(PASSWORD)}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`,
          },
        });
      }
      return new Response(JSON.stringify({ success: false, message: '密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ success: false, message: '请求格式错误' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 检查认证 Cookie
  const cookie = request.headers.get('Cookie') || '';
  const authMatch = cookie.match(/auth_token=([^;]+)/);

  if (authMatch && decodeURIComponent(authMatch[1]) === PASSWORD) {
    return next();
  }

  // 未认证 → 跳转登录页
  return Response.redirect(`${url.origin}/login`, 302);
}

const PASSWORD = '18924609490';
