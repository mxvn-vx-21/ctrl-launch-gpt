import { redirect, rand, sha256, hmac, toB64u, setCookie, appOrigin } from '../../../_lib/util.js';
import { PROVIDERS, isConfigured } from '../../../_lib/oauth.js';
export async function onRequestGet({ request, env, params }) {
  const p = params.provider, c = PROVIDERS[p];
  if (!c) return new Response('Not found', { status: 404 });
  if (!isConfigured(env, p)) return redirect('/#/login?error=not_configured');
  const state = rand(24), verifier = rand(48);
  const payload = toB64u(new TextEncoder().encode(JSON.stringify({ s: state, v: verifier, e: Date.now() + 600000 })));
  const cookie = setCookie('bb_oauth', `${payload}.${await hmac(env.SESSION_SECRET, payload)}`, { maxAge: 600, path: '/api/auth' });
  const q = new URLSearchParams({ client_id: env[c.id], redirect_uri: `${appOrigin(env, request)}/api/auth/${p}/callback`, response_type: 'code', scope: c.scope, state });
  if (p === 'google') { q.set('code_challenge', await sha256(verifier)); q.set('code_challenge_method', 'S256'); q.set('prompt', 'select_account'); }
  else q.set('allow_signup', 'true');
  return redirect(`${c.auth}?${q}`, [cookie]);
}
