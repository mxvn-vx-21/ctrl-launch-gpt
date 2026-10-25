import { json } from '../../../_lib/util.js';
import { guard } from '../../../_lib/launchpad.js';
import { isAdmin } from '../../../_lib/sites.js';
export async function onRequestPost({ request, env, params }) {
  const g = await guard(request, env, { needHandle: false }); if (g instanceof Response) return g;
  if (!isAdmin(env, g.user)) return json({ error: 'forbidden' }, 403);
  const b = await request.json().catch(() => null);
  const r = await env.DB.prepare('UPDATE sites SET disabled=? WHERE slug=?').bind(b?.disabled === false ? 0 : 1, params.slug).run();
  return r.meta.changes ? json({ ok: true }) : json({ error: 'not_found' }, 404);
}
