import { json } from '../../../_lib/util.js';
import { guard } from '../../../_lib/launchpad.js';
import { isAdmin } from '../../../_lib/sites.js';
import { delProject } from '../../launchpad/projects/[slug].js';
async function admin(request, env) { const g = await guard(request, env, { needHandle: false }); if (g instanceof Response) return g; return isAdmin(env, g.user) ? g : json({ error: 'forbidden' }, 403); }
export async function onRequestPost({ request, env, params }) {
  const g = await admin(request, env); if (g instanceof Response) return g;
  const b = await request.json().catch(() => null);
  const r = await env.DB.prepare('UPDATE projects SET featured=? WHERE slug=?').bind(b?.featured === false ? 0 : 1, params.slug).run();
  return r.meta.changes ? json({ ok: true }) : json({ error: 'not_found' }, 404);
}
export async function onRequestDelete({ request, env, params }) {
  const g = await admin(request, env); if (g instanceof Response) return g;
  const p = await env.DB.prepare('SELECT id FROM projects WHERE slug=?').bind(params.slug).first();
  if (!p) return json({ error: 'not_found' }, 404);
  await delProject(env, p.id); return json({ ok: true });
}
