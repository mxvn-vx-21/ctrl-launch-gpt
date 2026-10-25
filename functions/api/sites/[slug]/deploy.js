import { json, limit } from '../../../_lib/util.js';
import { guard } from '../../../_lib/launchpad.js';
import { LIMITS, extract, mimeFor, delPrefix, siteUrl } from '../../../_lib/sites.js';
export async function onRequestPost({ request, env, params }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const site = await env.DB.prepare('SELECT id,disabled FROM sites WHERE slug=? AND user_id=?').bind(params.slug, g.user.id).first();
  if (!site) return json({ error: 'not_found' }, 404);
  if (site.disabled) return json({ error: 'disabled' }, 403);
  if (!(await limit(env, 'dp:' + g.user.id, 30, 3600))) return json({ error: 'rate_limited' }, 429);
  const len = parseInt(request.headers.get('content-length') || '0', 10);
  if (!len) return json({ error: 'invalid' }, 411);
  if (len > LIMITS.upload) return json({ error: 'too_large' }, 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > LIMITS.upload) return json({ error: 'too_large' }, 413);
  let filename = ''; try { filename = decodeURIComponent(request.headers.get('x-filename') || ''); } catch {}
  const r = extract(bytes, filename, (request.headers.get('x-directory') || '').trim());
  if (r.error) return json({ error: r.error }, 400);
  const id = crypto.randomUUID(), prefix = `sites/${site.id}/${id}/`;
  let total = 0;
  try {
    for (let i = 0; i < r.files.length; i += 8)
      await Promise.all(r.files.slice(i, i + 8).map(f => { total += f.data.length; return env.SITES.put(prefix + f.path, f.data, { httpMetadata: { contentType: mimeFor(f.path) } }); }));
  } catch (e) { await delPrefix(env.SITES, prefix).catch(() => {}); throw e; }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO deployments(id,site_id,created_at,file_count,total_bytes,source) VALUES(?,?,?,?,?,?)').bind(id, site.id, now, r.files.length, total, filename.slice(0, 100)),
    env.DB.prepare('UPDATE sites SET current_deploy_id=? WHERE id=?').bind(id, site.id),
  ]);
  const old = await env.DB.prepare('SELECT id FROM deployments WHERE site_id=? ORDER BY created_at DESC LIMIT -1 OFFSET ?').bind(site.id, LIMITS.keep).all();
  for (const o of old.results) { await delPrefix(env.SITES, `sites/${site.id}/${o.id}/`); await env.DB.prepare('DELETE FROM deployments WHERE id=?').bind(o.id).run(); }
  return json({ ok: true, url: siteUrl(env, params.slug), deployment: { id, file_count: r.files.length, total_bytes: total } }, 201);
}
