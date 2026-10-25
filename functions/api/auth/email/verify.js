import { json, sha256, sameOrigin, limit, clientIp } from '../../../_lib/util.js';
import { createSession, findOrCreateUser } from '../../../_lib/session.js';
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'forbidden' }, 403);
  const body = await request.json().catch(() => null);
  const token = String(body?.token || '');
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return json({ error: 'invalid' }, 400);
  if (!(await limit(env, 'vf:' + clientIp(request), 30, 3600))) return json({ error: 'rate_limited' }, 429);
  const h = await sha256(token), now = Date.now();
  const row = await env.DB.prepare('UPDATE auth_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>? RETURNING email').bind(now, h, now).first();
  if (!row) {
    const e = await env.DB.prepare('SELECT used_at FROM auth_tokens WHERE token_hash=?').bind(h).first();
    return json({ error: !e ? 'invalid' : e.used_at ? 'used' : 'expired' }, 400);
  }
  const uid = await findOrCreateUser(env, { email: row.email });
  const cookie = await createSession(env, request, uid);
  const user = await env.DB.prepare('SELECT id,email,name,avatar_url,username,bio,website FROM users WHERE id=?').bind(uid).first();
  return json({ ok: true, user }, 200, { 'set-cookie': cookie });
}
