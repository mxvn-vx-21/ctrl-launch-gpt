import { redirect, hmac, safeEq, fromB64u, getCookie, setCookie, appOrigin } from '../../../_lib/util.js';
import { PROVIDERS, isConfigured, fetchProfile } from '../../../_lib/oauth.js';
import { createSession, findOrCreateUser } from '../../../_lib/session.js';
export async function onRequestGet({ request, env, params }) {
  const p = params.provider, c = PROVIDERS[p];
  if (!c) return new Response('Not found', { status: 404 });
  const clear = setCookie('bb_oauth', '', { maxAge: 0, path: '/api/auth' });
  const fail = code => redirect('/#/login?error=' + code, [clear]);
  if (!isConfigured(env, p)) return fail('not_configured');
  const url = new URL(request.url), err = url.searchParams.get('error');
  if (err) return fail(err === 'access_denied' ? 'access_denied' : 'oauth_failed');
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const raw = getCookie(request, 'bb_oauth') || '', dot = raw.indexOf('.');
  if (!code || !state || dot < 1) return fail('oauth_state');
  const payload = raw.slice(0, dot);
  if (!safeEq(raw.slice(dot + 1), await hmac(env.SESSION_SECRET, payload))) return fail('oauth_state');
  let st; try { st = JSON.parse(new TextDecoder().decode(fromB64u(payload))); } catch { return fail('oauth_state'); }
  if (st.e < Date.now() || !safeEq(st.s, state)) return fail('oauth_state');
  const form = new URLSearchParams({ client_id: env[c.id], client_secret: env[c.secret], code, grant_type: 'authorization_code', redirect_uri: `${appOrigin(env, request)}/api/auth/${p}/callback` });
  if (p === 'google') form.set('code_verifier', st.v);
  const tr = await fetch(c.token, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  const tj = tr.ok ? await tr.json().catch(() => null) : null;
  if (!tj || !tj.access_token) return fail('oauth_failed');
  const prof = await fetchProfile(p, tj.access_token);
  if (!prof) return fail('oauth_failed');
  if (prof.error) return fail(prof.error);
  const link = await env.DB.prepare('SELECT user_id FROM oauth_accounts WHERE provider=? AND provider_user_id=?').bind(p, prof.pid).first();
  let uid = link?.user_id;
  if (!uid) {
    uid = await findOrCreateUser(env, { email: prof.email, name: prof.name, avatar: prof.avatar });
    await env.DB.prepare('INSERT OR IGNORE INTO oauth_accounts(provider,provider_user_id,user_id,created_at) VALUES(?,?,?,?)').bind(p, prof.pid, uid, Date.now()).run();
  }
  return redirect('/#/launchpad', [clear, await createSession(env, request, uid)]);
}
