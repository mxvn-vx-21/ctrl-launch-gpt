const enc = new TextEncoder();
export const json = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...h } });
export const redirect = (loc, cookies = []) => { const h = new Headers({ location: loc, 'cache-control': 'no-store' }); cookies.forEach(c => h.append('set-cookie', c)); return new Response(null, { status: 302, headers: h }); };
export const toB64u = b => { let s = ''; for (const c of new Uint8Array(b)) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const fromB64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
export const rand = (n = 32) => toB64u(crypto.getRandomValues(new Uint8Array(n)));
export const sha256 = async s => toB64u(await crypto.subtle.digest('SHA-256', enc.encode(s)));
export async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toB64u(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
export function safeEq(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export function getCookie(req, n) {
  for (const p of (req.headers.get('cookie') || '').split(';')) { const i = p.indexOf('='); if (i > 0 && p.slice(0, i).trim() === n) return decodeURIComponent(p.slice(i + 1).trim()); }
  return null;
}
export const setCookie = (n, v, { maxAge = 0, path = '/' } = {}) => `${n}=${encodeURIComponent(v)}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export const appOrigin = (env, req) => env.APP_URL ? new URL(env.APP_URL).origin : new URL(req.url).origin;
export const sameOrigin = (req, env) => { const o = req.headers.get('origin'); return !!o && (o === new URL(req.url).origin || o === appOrigin(env, req)); };
export const clientIp = req => req.headers.get('cf-connecting-ip') || 'unknown';
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export async function limit(env, key, max, sec) {
  const now = Math.floor(Date.now() / 1000), w = Math.floor(now / sec);
  const r = await env.DB.prepare('INSERT INTO rate_limits(k,n,exp) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n').bind(`${key}:${w}`, (w + 1) * sec + 60).first();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM rate_limits WHERE exp<?').bind(now).run();
  return r.n <= max;
}
