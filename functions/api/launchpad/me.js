import { json } from '../../_lib/util.js';
import { guard } from '../../_lib/launchpad.js';
export async function onRequestGet({ request, env }) {
  const g = await guard(request, env, { write: false, needHandle: false }); if (g instanceof Response) return g;
  const { results } = await env.DB.prepare('SELECT slug,title,vote_count,comment_count,created_at FROM projects WHERE user_id=? ORDER BY created_at DESC').bind(g.user.id).all();
  return json({ user: g.user, projects: results });
}
