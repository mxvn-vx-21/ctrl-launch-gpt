import { HANDLE_RE, RESERVED, SPA_ROUTES } from './_lib/launchpad.js';
import { esc, page } from './_lib/ui.js';
export async function onRequestGet({ request, env, params }) {
  const raw = String(params.handle || ''), n = raw.toLowerCase(), origin = new URL(request.url).origin;
  if (SPA_ROUTES.has(n)) return Response.redirect(`${origin}/#/${n}`, 302);
  if (!HANDLE_RE.test(n) || RESERVED.has(n) || !env.DB) return env.ASSETS.fetch(request);
  if (raw !== n) return Response.redirect(`${origin}/${n}`, 301);
  const u = await env.DB.prepare('SELECT id,username,name,bio,website FROM users WHERE username=?').bind(n).first();
  if (!u) return page({ title: `ctrl.monster/${n} · CTRL`, desc: 'This CTRL address is available.', status: 404, body: `<div class="eb">Unclaimed</div><h1>ctrl.monster/${esc(n)}</h1><p class="bio">This address is available.</p><p><a class="b" href="/#/signup">Claim it</a></p>` });
  const { results } = await env.DB.prepare('SELECT slug,title,tagline,vote_count,comment_count FROM projects WHERE user_id=? ORDER BY created_at DESC LIMIT 25').bind(u.id).all();
  const sites = (await env.DB.prepare('SELECT slug FROM sites WHERE user_id=? AND current_deploy_id IS NOT NULL AND disabled=0 ORDER BY created_at DESC LIMIT 5').bind(u.id).all()).results;
  const siteHtml = sites.length ? `<div class="eb" style="margin-top:48px">Sites</div><p>${sites.map(x => { const h = `${x.slug}.${env.SITES_DOMAIN || 'ctrl.monster'}`; return `<a class="b" style="margin:0 10px 10px 0" href="https://${esc(h)}" rel="noopener nofollow ugc">${esc(h)}</a>`; }).join('')}</p>` : '';
  const cards = results.map(p => `<article class="g"><h3><a href="/launchpad/project/${esc(p.slug)}">${esc(p.title)}</a></h3><p>${esc(p.tagline)}</p><small>▲ ${p.vote_count} · ${p.comment_count} comments</small><a class="b" href="/launchpad/project/${esc(p.slug)}">View project</a></article>`).join('');
  const title = `${u.name || n} (ctrl.monster/${n}) · CTRL`;
  return page({ title, desc: u.bio || `${u.name || n} on CTRL`, body: `<div class="eb">ctrl.monster/${esc(n)}</div><h1>${esc(u.name || n)}</h1>${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : ''}${u.website ? `<p><a class="b" href="${esc(u.website)}" target="_blank" rel="noopener nofollow ugc">Website ↗</a></p>` : ''}<div class="eb" style="margin-top:48px">Launched</div>${cards ? `<div class="grid">${cards}</div>` : '<p class="empty">Nothing launched yet.</p>'}${siteHtml}`, extra: { 'cache-control': 'public, max-age=60' } });
}
