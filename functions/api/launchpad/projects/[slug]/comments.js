import { json, limit } from '../../../../_lib/util.js';
import { getUser } from '../../../../_lib/session.js';
import { guard, cleanMulti, COMMENT_MAX } from '../../../../_lib/launchpad.js';
export async function onRequestGet({ request, env, params }) {
  const s = await getUser(env, request), uid = s ? s.user.id : null;
  const p = await env.DB.prepare('SELECT id,user_id FROM projects WHERE slug=?').bind(params.slug).first();
  if (!p) return json({ error: 'not_found' }, 404);
  const { results } = await env.DB.prepare('SELECT c.id,c.body,c.created_at,c.edited_at,c.user_id,u.username,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.project_id=? ORDER BY c.created_at ASC LIMIT 300').bind(p.id).all();
  return json({ comments: results.map(c => ({ id: c.id, body: c.body, created_at: c.created_at, edited_at: c.edited_at, username: c.username, name: c.name, mine: c.user_id === uid, can_delete: !!uid && (c.user_id === uid || p.user_id === uid) })) });
}
export async function onRequestPost({ request, env, params }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const b = await request.json().catch(() => null), body = cleanMulti(b?.body, COMMENT_MAX + 1);
  if (!body || body.length > COMMENT_MAX) return json({ error: 'invalid' }, 400);
  if (!(await limit(env, 'cm:' + g.user.id, 20, 3600))) return json({ error: 'rate_limited' }, 429);
  const p = await env.DB.prepare('SELECT id FROM projects WHERE slug=?').bind(params.slug).first();
  if (!p) return json({ error: 'not_found' }, 404);
  const id = crypto.randomUUID(), now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO comments(id,project_id,user_id,body,created_at) VALUES(?,?,?,?,?)').bind(id, p.id, g.user.id, body, now),
    env.DB.prepare('UPDATE projects SET comment_count=(SELECT COUNT(*) FROM comments WHERE project_id=?1),last_activity_at=?2 WHERE id=?1').bind(p.id, now),
  ]);
  return json({ ok: true, id }, 201);
}
