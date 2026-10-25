import { json } from '../../_lib/util.js';
import { guard } from '../../_lib/launchpad.js';
import { delPrefix } from '../../_lib/sites.js';
export async function onRequestDelete({ request, env, params }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const s = await env.DB.prepare('SELECT id FROM sites WHERE slug=? AND user_id=?').bind(params.slug, g.user.id).first();
  if (!s) return json({ error: 'not_found' }, 404);
  await delPrefix(env.SITES, `sites/${s.id}/`);
  await env.DB.prepare('DELETE FROM sites WHERE id=?').bind(s.id).run();
  return json({ ok: true });
}
