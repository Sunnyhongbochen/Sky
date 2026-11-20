'use strict';

/**
 * 个人网站访问密码代理
 *
 * 对外监听 1313，校验通过后把请求转发给本机的 Hugo（1314）。
 * 未登录的页面请求一律 302 到 /login；密码错误返回 401，不返回任何站点内容。
 * 登录页复用 static/login.html，它的 /api/login 请求由本代理处理。
 *
 * 环境变量：
 *   PORT          对外端口（默认 1313）
 *   UPSTREAM_PORT Hugo 端口（默认 1314）
 *   SITE_PASSWORD 访问密码（默认 18924609490）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LISTEN_PORT = Number(process.env.PORT || 1313);
const UPSTREAM_PORT = Number(process.env.UPSTREAM_PORT || 1314);
const UPSTREAM_HOST = process.env.UPSTREAM_HOST || '127.0.0.1';
const PASSWORD = process.env.SITE_PASSWORD || '18924609490';

const COOKIE_NAME = 'site_auth';
const COOKIE_MAX_AGE = 86400; // 24 小时
const TOKEN = crypto.createHash('sha256').update(PASSWORD + '::summer-website').digest('hex');
const LOGIN_FILE = path.join(__dirname, 'static', 'login.html');

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function isAuthenticated(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] === TOKEN;
}

function safeNext(raw) {
  try {
    const next = decodeURIComponent(String(raw || '/'));
    if (next.startsWith('/') && !next.startsWith('//')) return next;
  } catch (error) {
    // ignore malformed value
  }
  return '/';
}

function sendLoginPage(res) {
  fs.readFile(LOGIN_FILE, (error, body) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('登录页缺失');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  });
}

function proxyToHugo(req, res) {
  const headers = Object.assign({}, req.headers);
  headers.host = `${UPSTREAM_HOST}:${UPSTREAM_PORT}`;
  const upstream = http.request(
    { host: UPSTREAM_HOST, port: UPSTREAM_PORT, method: req.method, path: req.url, headers },
    (reply) => {
      res.writeHead(reply.statusCode || 502, reply.headers);
      reply.pipe(res);
    }
  );
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    }
    res.end('网站服务未启动，请先启动 Hugo（端口 ' + UPSTREAM_PORT + '）');
  });
  req.pipe(upstream);
}

function handleLogin(req, res, url) {
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST', 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: '请使用 POST 登录' }));
    return;
  }

  let body = '';
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 8192) {
      req.destroy();
      return;
    }
    body += chunk;
  });
  req.on('end', () => {
    let data = {};
    try {
      data = JSON.parse(body || '{}');
    } catch (error) {
      data = {};
    }
    const next = safeNext(data.next || url.searchParams.get('next') || '/');

    if (typeof data.password === 'string' && data.password === PASSWORD) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${COOKIE_NAME}=${TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      });
      res.end(JSON.stringify({ success: true, next }));
      return;
    }

    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, message: '密码错误' }));
  });
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  const pathname = url.pathname;

  if (pathname === '/api/login') {
    handleLogin(req, res, url);
    return;
  }

  if (pathname === '/logout') {
    res.writeHead(302, {
      'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      Location: '/login',
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  if (isAuthenticated(req)) {
    if (pathname === '/login' || pathname === '/login.html') {
      res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    proxyToHugo(req, res);
    return;
  }

  if (pathname === '/login' || pathname === '/login.html') {
    sendLoginPage(res);
    return;
  }

  // 未登录时只放行站点图标，避免登录页没有图标
  if (pathname === '/favicon.svg' || pathname === '/favicon.ico' || pathname === '/favicon.png') {
    proxyToHugo(req, res);
    return;
  }

  const next = encodeURIComponent(pathname + url.search);
  res.writeHead(302, { Location: `/login?next=${next}`, 'Cache-Control': 'no-store' });
  res.end();
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`访问验证已开启：http://localhost:${LISTEN_PORT}/`);
  console.log(`  上游 Hugo：http://${UPSTREAM_HOST}:${UPSTREAM_PORT}/`);
  console.log(`  登录有效期：${COOKIE_MAX_AGE / 3600} 小时`);
});
