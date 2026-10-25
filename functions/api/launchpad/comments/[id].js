import { json } from '../../../_lib/util.js';
import { guard, cleanMulti, COMMENT_MAX } from '../../../_lib/launchpad.js';
export async function onRequestPut({ request, env, params }) {
  const g = await guard(request, env, { needHandle: false }); if (g instanceof Response) return g;
  const body = cleanMulti((await request.json().catch(() => null))?.body, COMMENT_MAX + 1);
  if (!body || body.length > COMMENT_MAX) return json({ error: 'invalid' }, 400);
  const r = await env.DB.prepare('UPDATE comments SET body=?,edited_at=? WHERE id=? AND user_id=?').bind(body, Date.now(), params.id, g.user.id).run();
  return r.meta.changes ? json({ ok: true }) : json({ error: 'not_found' }, 404);
}
export async function onRequestDelete({ request, env, params }) {
  const g = await guard(request, env, { needHandle: false }); if (g instanceof Response) return g;
  const c = await env.DB.prepare('SELECT c.project_id,c.user_id,p.user_id owner FROM comments c JOIN projects p ON p.id=c.project_id WHERE c.id=?').bind(params.id).first();
  if (!c) return json({ error: 'not_found' }, 404);
  if (c.user_id !== g.user.id && c.owner !== g.user.id) return json({ error: 'forbidden' }, 403);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM comments WHERE id=?').bind(params.id),
    env.DB.prepare('UPDATE projects SET comment_count=(SELECT COUNT(*) FROM comments WHERE project_id=?1) WHERE id=?1').bind(c.project_id),
  ]);
  return json({ ok: true });
}
