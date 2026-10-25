import { json, redirect } from '../_lib/util.js';
export async function onRequest(ctx) {
  try {
    if (!ctx.env.DB) {
      if (ctx.request.method === 'GET' && /\/auth\/(google|github)\//.test(ctx.request.url)) return redirect('/#/login?error=not_configured');
      return json({ error: 'not_configured' }, 503);
    }
    const res = await ctx.next();
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (e) { console.error('unhandled', (e && e.stack) || e); return json({ error: 'server_error' }, 500); }
}
