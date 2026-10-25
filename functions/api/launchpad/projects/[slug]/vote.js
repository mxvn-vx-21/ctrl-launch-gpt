import { json, limit } from '../../../../_lib/util.js';
import { guard } from '../../../../_lib/launchpad.js';
async function run(request, env, params, on) {
  const g = await guard(request, env, { needHandle: false }); if (g instanceof Response) return g;
  if (!(await limit(env, 'vt:' + g.user.id, 120, 3600))) return json({ error: 'rate_limited' }, 429);
  const p = await env.DB.prepare('SELECT id,user_id FROM projects WHERE slug=?').bind(params.slug).first();
  if (!p) return json({ error: 'not_found' }, 404);
  if (on && p.user_id === g.user.id) return json({ error: 'own_project' }, 403);
  const now = Date.now(), recount = env.DB.prepare('UPDATE projects SET vote_count=(SELECT COUNT(*) FROM votes WHERE project_id=?1)' + (on ? ',last_activity_at=?2' : '') + ' WHERE id=?1');
  await env.DB.batch([
    on ? env.DB.prepare('INSERT OR IGNORE INTO votes(project_id,user_id,created_at) VALUES(?,?,?)').bind(p.id, g.user.id, now) : env.DB.prepare('DELETE FROM votes WHERE project_id=? AND user_id=?').bind(p.id, g.user.id),
    on ? recount.bind(p.id, now) : recount.bind(p.id),
  ]);
  const r = await env.DB.prepare('SELECT vote_count FROM projects WHERE id=?').bind(p.id).first();
  return json({ ok: true, voted: on, vote_count: r.vote_count });
}
export const onRequestPost = ({ request, env, params }) => run(request, env, params, true);
export const onRequestDelete = ({ request, env, params }) => run(request, env, params, false);
