// Serves deployed sites on *.ctrl.monster from R2. Separate Worker because Pages can't take wildcard custom domains.
const cache = new Map();
const page = (status, title, msg) => new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f2f2f0;font-family:system-ui,sans-serif;text-align:center"><div><p style="letter-spacing:.3em;color:#888;font-size:12px">CTRL</p><h1 style="font-weight:400">${title}</h1><p style="color:#999">${msg}</p><a href="https://ctrl.monster" style="color:#f2f2f0">ctrl.monster</a></div>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff' } });
async function lookup(env, slug) {
  const hit = cache.get(slug); if (hit && hit.exp > Date.now()) return hit.v;
  const v = await env.DB.prepare('SELECT id,current_deploy_id,disabled FROM sites WHERE slug=?').bind(slug).first() || null;
  cache.set(slug, { v, exp: Date.now() + 15000 }); if (cache.size > 500) cache.clear();
  return v;
}
export default {
  async fetch(req, env) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const url = new URL(req.url), root = env.ROOT_DOMAIN || 'ctrl.monster';
    const host = ((env.DEV && url.searchParams.get('__host')) || url.hostname).toLowerCase();
    if (!host.endsWith('.' + root)) return page(404, 'Not found', 'Unknown host.');
    const slug = host.slice(0, -(root.length + 1));
    if (!slug || slug.includes('.')) return page(404, 'Not found', 'Unknown site.');
    const site = await lookup(env, slug);
    if (!site || !site.current_deploy_id) return page(404, 'Nothing here yet', `${slug}.${root} has no deployment.`);
    if (site.disabled) return page(451, 'Site disabled', 'This site was disabled for violating the rules.');
    let path;
    try { path = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch { return page(400, 'Bad request', 'Invalid URL.'); }
    if (path.includes('\\') || path.split('/').includes('..') || /[\u0000-\u001f]/.test(path)) return page(400, 'Bad request', 'Invalid path.');
    const base = `sites/${site.id}/${site.current_deploy_id}/`;
    const cands = path === '' || path.endsWith('/') ? [path + 'index.html'] : [path, path + '.html', path + '/index.html'];
    for (const c of cands) {
      const o = await env.SITES.get(base + c);
      if (o) return send(o, req, c, 200);
    }
    const nf = await env.SITES.get(base + '404.html');
    return nf ? send(nf, req, '404.html', 404) : page(404, 'Not found', 'This page does not exist.');
  },
};
function send(o, req, name, status) {
  const h = new Headers();
  o.writeHttpMetadata(h);
  h.set('etag', o.httpEtag); h.set('x-content-type-options', 'nosniff'); h.set('referrer-policy', 'strict-origin-when-cross-origin');
  h.set('cache-control', /\.html?$/.test(name) ? 'public, max-age=60' : 'public, max-age=300');
  return new Response(req.method === 'HEAD' ? null : o.body, { status, headers: h });
}
