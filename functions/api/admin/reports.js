import { json } from '../../_lib/util.js';
import { guard } from '../../_lib/launchpad.js';
import { isAdmin } from '../../_lib/sites.js';
export async function onRequestGet({ request, env }) {
  const g = await guard(request, env, { write: false, needHandle: false }); if (g instanceof Response) return g;
  if (!isAdmin(env, g.user)) return json({ error: 'forbidden' }, 403);
  const { results } = await env.DB.prepare('SELECT id,slug,reason,created_at FROM reports ORDER BY created_at DESC LIMIT 100').all();
  return json({ reports: results });
}
