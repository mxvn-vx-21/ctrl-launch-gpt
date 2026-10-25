import { json, sameOrigin } from '../../_lib/util.js';
import { destroySession } from '../../_lib/session.js';
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request, env)) return json({ error: 'forbidden' }, 403);
  return json({ ok: true }, 200, { 'set-cookie': await destroySession(env, request) });
}
