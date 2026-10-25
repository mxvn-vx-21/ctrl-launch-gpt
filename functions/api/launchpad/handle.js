import { json, limit } from '../../_lib/util.js';
import { guard, handleStatus } from '../../_lib/launchpad.js';
export async function onRequestPost({ request, env }) {
  const g = await guard(request, env, { needHandle: false }); if (g instanceof Response) return g;
  if (g.user.username) return json({ error: 'already_set' }, 409);
  if (!(await limit(env, 'hs:' + g.user.id, 20, 3600))) return json({ error: 'rate_limited' }, 429);
  const b = await request.json().catch(() => null), n = String(b?.name || '').trim().toLowerCase();
  const bad = handleStatus(n); if (bad) return json({ error: bad }, 400);
  try {
    const r = await env.DB.prepare('UPDATE users SET username=? WHERE id=? AND username IS NULL').bind(n, g.user.id).run();
    if (!r.meta.changes) return json({ error: 'already_set' }, 409);
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return json({ error: 'taken' }, 409);
    throw e;
  }
  return json({ ok: true, username: n });
}
