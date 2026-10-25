import { json } from '../../../_lib/util.js';
import { getUser } from '../../../_lib/session.js';
import { guard, validateProject } from '../../../_lib/launchpad.js';
import { isAdmin } from '../../../_lib/sites.js';
export async function onRequestGet({ request, env, params }) {
  const s = await getUser(env, request), uid = s ? s.user.id : '';
  const p = await env.DB.prepare(`SELECT p.id,p.user_id,p.slug,p.title,p.tagline,p.description,p.url,p.repo_url,p.logo_url,p.category,p.featured,p.vote_count,p.comment_count,p.created_at,u.username,u.name,
    EXISTS(SELECT 1 FROM votes v WHERE v.project_id=p.id AND v.user_id=?) voted FROM projects p JOIN users u ON u.id=p.user_id WHERE p.slug=? AND u.username IS NOT NULL`).bind(uid, params.slug).first();
  if (!p) return json({ error: 'not_found' }, 404);
  const t = await env.DB.prepare('SELECT tag FROM project_tags WHERE project_id=? ORDER BY tag').bind(p.id).all();
  const { id, user_id, ...pub } = p;
  return json({ project: { ...pub, featured: !!p.featured, voted: !!p.voted, tags: t.results.map(x => x.tag) }, mine: !!uid && user_id === uid });
}
export async function onRequestPut({ request, env, params }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const v = validateProject(await request.json().catch(() => null)); if (v.errors) return json({ error: 'invalid', fields: v.errors }, 400);
  const p = await env.DB.prepare('SELECT id FROM projects WHERE slug=? AND user_id=?').bind(params.slug, g.user.id).first();
  if (!p) return json({ error: 'not_found' }, 404);
  const d = v.value, now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE projects SET title=?,tagline=?,url=?,description=?,category=?,repo_url=?,logo_url=?,updated_at=? WHERE id=?').bind(d.title, d.tagline, d.url, d.description, d.category, d.repo_url, d.logo_url, now, p.id),
    env.DB.prepare('DELETE FROM project_tags WHERE project_id=?').bind(p.id),
    ...d.tags.map(t => env.DB.prepare('INSERT INTO project_tags(project_id,tag) VALUES(?,?)').bind(p.id, t)),
  ]);
  return json({ ok: true, slug: params.slug });
}
export async function onRequestDelete({ request, env, params }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const p = await env.DB.prepare('SELECT id FROM projects WHERE slug=? AND user_id=?').bind(params.slug, g.user.id).first();
  if (!p) return json({ error: 'not_found' }, 404);
  await delProject(env, p.id);
  return json({ ok: true });
}
export const delProject = (env, id) => env.DB.batch(['comments', 'votes', 'project_tags'].map(t => env.DB.prepare(`DELETE FROM ${t} WHERE project_id=?`).bind(id)).concat(env.DB.prepare('DELETE FROM projects WHERE id=?').bind(id)));
