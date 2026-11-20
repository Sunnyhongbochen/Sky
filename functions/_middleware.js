// Cloudflare Pages Functions —— 站点访问密码保护
//
// 密码来源（优先级从高到低）：
//   1. 环境变量 SITE_PASSWORD（Cloudflare Pages → Settings → Environment variables）
//   2. 环境变量 AUTH_PASSWORD
//   3. 源码内 FALLBACK_PASSWORD（仅用于未配置环境变量时保持站点可用）
//
// Cookie 中不保存密码原文，保存的是 SHA-256(password|scope) 摘要，无法用于反推密码。

const FALLBACK_PASSWORD = '18924609490';
const COOKIE_NAME = 'site_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const TOKEN_SCOPE = 'summer-site-v1';

// 纯静态资源直接放行（页面本身仍受保护）
const STATIC_EXTENSIONS = new Set([
  '.css', '.js', '.mjs', '.map', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.webp', '.avif', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.wasm', '.json', '.xml', '.txt',
]);

// 无需登录即可访问的路径
const PUBLIC_PATHS = new Set(['/login', '/login.html', '/api/login']);

function getPassword(env) {
  return (env && (env.SITE_PASSWORD || env.AUTH_PASSWORD)) || FALLBACK_PASSWORD;
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function tokenFor(password) {
  return sha256(`${TOKEN_SCOPE}|${password}`);
}

function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return '';
}

function harden(response) {
  const res = new Response(response.body, response);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  return res;
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function safeNext(next, origin) {
  if (!next || typeof next !== 'string') return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  try {
    const target = new URL(next, origin);
    return target.origin === origin ? target.pathname + target.search : '/';
  } catch {
    return '/';
  }
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const password = getPassword(env);

  // 1. 登录接口
  if (pathname === '/api/login' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, message: '请求格式错误' }, 400);
    }

    if (typeof body?.password === 'string' && body.password === password) {
      const token = await tokenFor(password);
      return json(
        { success: true, next: safeNext(body.next, url.origin) },
        200,
        {
          'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        },
      );
    }

    // 简单的失败延迟，降低暴力尝试速度
    await new Promise((resolve) => setTimeout(resolve, 500));
    return json({ success: false, message: '密码错误' }, 401);
  }

  // 2. 退出登录
  if (pathname === '/api/logout') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/login',
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  // 3. 静态资源与公开页面放行
  const lower = pathname.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.'));
  if (STATIC_EXTENSIONS.has(ext) || PUBLIC_PATHS.has(lower) || PUBLIC_PATHS.has(lower.replace(/\/$/, ''))) {
    return harden(await next());
  }

  // 4. 校验 Cookie
  const token = readCookie(request, COOKIE_NAME);
  if (token && token === (await tokenFor(password))) {
    const res = harden(await next());
    res.headers.set('Cache-Control', 'private, no-store');
    res.headers.set('Vary', 'Cookie');
    return res;
  }

  // 5. 未认证 —— 跳转登录页并保留原始目标
  const target = pathname + url.search;
  const loginUrl = `${url.origin}/login${target === '/' ? '' : `?next=${encodeURIComponent(target)}`}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: loginUrl,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
