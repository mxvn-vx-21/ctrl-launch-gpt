import { json, limit } from '../_lib/util.js';
import { guard } from '../_lib/launchpad.js';
import { LIMITS, slugStatus, siteUrl } from '../_lib/sites.js';
export async function onRequestGet({ request, env }) {
  const g = await guard(request, env, { write: false, needHandle: false }); if (g instanceof Response) return g;
  const { results } = await env.DB.prepare('SELECT id,slug,current_deploy_id,disabled,created_at FROM sites WHERE user_id=? ORDER BY created_at DESC').bind(g.user.id).all();
  const sites = [];
  for (const s of results) {
    const d = await env.DB.prepare('SELECT id,created_at,file_count,total_bytes FROM deployments WHERE site_id=? ORDER BY created_at DESC LIMIT ?').bind(s.id, LIMITS.keep).all();
    sites.push({ slug: s.slug, url: siteUrl(env, s.slug), disabled: !!s.disabled, current: s.current_deploy_id, deployments: d.results });
  }
  return json({ sites, max: LIMITS.sites });
}
export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const b = await request.json().catch(() => null), slug = String(b?.slug || '').trim().toLowerCase();
  const bad = slugStatus(slug); if (bad) return json({ error: bad }, 400);
  if (!(await limit(env, 'sc:' + g.user.id, 10, 3600))) return json({ error: 'rate_limited' }, 429);
  const c = await env.DB.prepare('SELECT COUNT(*) n FROM sites WHERE user_id=?').bind(g.user.id).first();
  if (c.n >= LIMITS.sites) return json({ error: 'limit' }, 400);
  try { await env.DB.prepare('INSERT INTO sites(id,user_id,slug,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(), g.user.id, slug, Date.now()).run(); }
  catch (e) { if (/UNIQUE/i.test(String(e && e.message))) return json({ error: 'taken' }, 409); throw e; }
  return json({ ok: true, slug, url: siteUrl(env, slug) }, 201);
}
