import { json } from '../../../_lib/util.js';
import { guard } from '../../../_lib/launchpad.js';
export async function onRequestPost({ request, env, params }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const b = await request.json().catch(() => null), did = String(b?.deploy_id || '');
  const site = await env.DB.prepare('SELECT id FROM sites WHERE slug=? AND user_id=?').bind(params.slug, g.user.id).first();
  if (!site) return json({ error: 'not_found' }, 404);
  const d = await env.DB.prepare('SELECT id FROM deployments WHERE id=? AND site_id=?').bind(did, site.id).first();
  if (!d) return json({ error: 'not_found' }, 404);
  await env.DB.prepare('UPDATE sites SET current_deploy_id=? WHERE id=?').bind(d.id, site.id).run();
  return json({ ok: true });
}
