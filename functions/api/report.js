import { json, sameOrigin, limit, clientIp } from '../_lib/util.js';
import { clean } from '../_lib/launchpad.js';
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'forbidden' }, 403);
  if (!(await limit(env, 'rp:' + clientIp(request), 10, 3600))) return json({ error: 'rate_limited' }, 429);
  const b = await request.json().catch(() => null), slug = clean(b?.slug, 40).toLowerCase(), reason = clean(b?.reason, 300);
  if (!slug || !reason) return json({ error: 'invalid' }, 400);
  await env.DB.prepare('INSERT INTO reports(id,slug,reason,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(), slug, reason, Date.now()).run();
  return json({ ok: true });
}
