import { json, limit, rand } from '../../_lib/util.js';
import { getUser } from '../../_lib/session.js';
import { guard, CATEGORIES, validateProject, slugify, likeEsc } from '../../_lib/launchpad.js';
const ORDER = { activity: 'p.last_activity_at DESC, p.created_at DESC', votes: 'p.vote_count DESC, p.created_at DESC', new: 'p.created_at DESC' };
const TABS = ['all', 'featured', 'trending', 'newest'], PER = 20;
export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const tab = TABS.includes(q.get('tab')) ? q.get('tab') : 'all', sort = ORDER[q.get('sort')] ? q.get('sort') : 'activity';
  const cat = CATEGORIES.includes(q.get('category')) ? q.get('category') : '', tag = (q.get('tag') || '').toLowerCase().slice(0, 20), term = (q.get('q') || '').trim().slice(0, 80);
  const page = Math.max(0, Math.min(parseInt(q.get('page') || '0', 10) || 0, 100));
  const s = await getUser(env, request), week = Date.now() - 7 * 864e5;
  const sel = [s ? s.user.id : '', week], where = ['u.username IS NOT NULL'], wa = [];
  if (tab === 'featured') where.push('p.featured=1');
  if (tab === 'trending') { where.push('(SELECT COUNT(*) FROM votes v2 WHERE v2.project_id=p.id AND v2.created_at>?)>0'); wa.push(week); }
  if (cat) { where.push('p.category=?'); wa.push(cat); }
  if (tag) { where.push('EXISTS(SELECT 1 FROM project_tags t WHERE t.project_id=p.id AND t.tag=?)'); wa.push(tag); }
  if (term) { const l = `%${likeEsc(term.toLowerCase())}%`; where.push("(lower(p.title) LIKE ? ESCAPE '\\' OR lower(p.tagline) LIKE ? ESCAPE '\\' OR lower(IFNULL(p.description,'')) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM project_tags t WHERE t.project_id=p.id AND t.tag LIKE ? ESCAPE '\\'))"); wa.push(l, l, l, l); }
  const order = tab === 'trending' ? 'recent DESC, p.vote_count DESC, p.created_at DESC' : tab === 'newest' ? ORDER.new : ORDER[sort];
  const sql = `SELECT p.slug,p.title,p.tagline,p.category,p.logo_url,p.vote_count,p.comment_count,p.created_at,p.featured,u.username,u.name,
    (SELECT group_concat(tag,',') FROM project_tags t WHERE t.project_id=p.id) tags,
    EXISTS(SELECT 1 FROM votes v WHERE v.project_id=p.id AND v.user_id=?) voted,
    (SELECT COUNT(*) FROM votes v3 WHERE v3.project_id=p.id AND v3.created_at>?) recent
    FROM projects p JOIN users u ON u.id=p.user_id WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(sql).bind(...sel, ...wa, PER + 1, page * PER).all();
  const hf = await env.DB.prepare('SELECT 1 x FROM projects WHERE featured=1 LIMIT 1').first();
  return json({ projects: results.slice(0, PER).map(r => ({ ...r, tags: r.tags ? r.tags.split(',') : [], voted: !!r.voted, featured: !!r.featured, recent: undefined })), has_more: results.length > PER, has_featured: !!hf, categories: CATEGORIES });
}
export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const v = validateProject(await request.json().catch(() => null)); if (v.errors) return json({ error: 'invalid', fields: v.errors }, 400);
  if (!(await limit(env, 'pj:' + g.user.id, 5, 3600))) return json({ error: 'rate_limited' }, 429);
  const c = await env.DB.prepare('SELECT COUNT(*) n FROM projects WHERE user_id=?').bind(g.user.id).first();
  if (c.n >= 25) return json({ error: 'limit' }, 400);
  const d = v.value, base = slugify(d.title), id = crypto.randomUUID(), now = Date.now();
  for (let i = 0; i < 8; i++) {
    const slug = i === 0 ? base : i < 6 ? `${base.slice(0, 36)}-${i + 1}` : `${base.slice(0, 30)}-${rand(3).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO projects(id,user_id,slug,title,tagline,url,description,category,repo_url,logo_url,created_at,updated_at,last_activity_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, g.user.id, slug, d.title, d.tagline, d.url, d.description, d.category, d.repo_url, d.logo_url, now, now, now),
        ...d.tags.map(t => env.DB.prepare('INSERT INTO project_tags(project_id,tag) VALUES(?,?)').bind(id, t)),
      ]);
      return json({ ok: true, slug }, 201);
    } catch (e) { if (!/UNIQUE/i.test(String(e && e.message))) throw e; }
  }
  return json({ error: 'slug_conflict' }, 409);
}
