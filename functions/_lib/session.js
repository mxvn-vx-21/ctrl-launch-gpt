import { rand, sha256, getCookie, setCookie } from './util.js';
export const COOKIE = 'bb_session';
const DAY = 86400000, TTL = 30 * DAY;
export async function createSession(env, request, userId) {
  const t = rand(32), now = Date.now();
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at,user_agent) VALUES(?,?,?,?,?)')
    .bind(await sha256(t), userId, now, now + TTL, (request.headers.get('user-agent') || '').slice(0, 200)).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now).run();
  return setCookie(COOKIE, t, { maxAge: TTL / 1000 });
}
export async function getUser(env, request) {
  const t = getCookie(request, COOKIE); if (!t || t.length > 100) return null;
  const h = await sha256(t), now = Date.now();
  const r = await env.DB.prepare('SELECT u.id,u.email,u.name,u.avatar_url,u.username,u.bio,u.website,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(h, now).first();
  if (!r) return null;
  let cookie = null;
  if (r.expires_at - now < TTL / 2) {
    await env.DB.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?').bind(now + TTL, h).run();
    cookie = setCookie(COOKIE, t, { maxAge: TTL / 1000 });
  }
  return { user: { id: r.id, email: r.email, name: r.name, avatar_url: r.avatar_url, username: r.username, bio: r.bio, website: r.website }, cookie };
}
export async function destroySession(env, request) {
  const t = getCookie(request, COOKIE);
  if (t) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(t)).run();
  return setCookie(COOKIE, '', { maxAge: 0 });
}
export async function findOrCreateUser(env, { email, name = null, avatar = null }) {
  email = email.toLowerCase(); const now = Date.now();
  let u = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (!u) {
    await env.DB.prepare('INSERT INTO users(id,email,name,avatar_url,email_verified_at,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(), email, name, avatar, now, now).run();
    u = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  } else {
    await env.DB.prepare('UPDATE users SET email_verified_at=COALESCE(email_verified_at,?),name=COALESCE(name,?),avatar_url=COALESCE(avatar_url,?) WHERE id=?').bind(now, name, avatar, u.id).run();
  }
  return u.id;
}
