import { json, rand, sha256, sameOrigin, appOrigin, limit, clientIp, EMAIL_RE } from '../../../_lib/util.js';
import { sendEmail, loginEmail, noAccountEmail } from '../../../_lib/email.js';
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'forbidden' }, 403);
  if (!env.RESEND_API_KEY) return json({ error: 'not_configured' }, 503);
  const body = await request.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const mode = body?.mode === 'signup' ? 'signup' : 'login';
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'invalid_email' }, 400);
  if (!(await limit(env, 'ip:' + clientIp(request), 20, 3600)) || !(await limit(env, 'em:' + email, 5, 900))) return json({ error: 'rate_limited' }, 429);
  const user = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  const origin = appOrigin(env, request);
  let ok;
  if (!user && mode === 'login') {
    ok = await sendEmail(env, noAccountEmail(email, origin));
  } else {
    const t = rand(32), now = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM auth_tokens WHERE (email=? AND used_at IS NULL) OR expires_at<?').bind(email, now - 86400000),
      env.DB.prepare('INSERT INTO auth_tokens(token_hash,email,purpose,created_at,expires_at) VALUES(?,?,?,?,?)').bind(await sha256(t), email, user ? 'login' : 'signup', now, now + 15 * 60000),
    ]);
    ok = await sendEmail(env, loginEmail(email, `${origin}/#/verify?token=${t}`, !user));
  }
  return ok ? json({ ok: true }) : json({ error: 'email_failed' }, 502);
}
