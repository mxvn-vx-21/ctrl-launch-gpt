import { json, limit, clientIp } from '../../../_lib/util.js';
import { handleStatus } from '../../../_lib/launchpad.js';
export async function onRequestGet({ request, env }) {
  const n = (new URL(request.url).searchParams.get('name') || '').toLowerCase();
  if (!(await limit(env, 'hc:' + clientIp(request), 120, 3600))) return json({ error: 'rate_limited' }, 429);
  const bad = handleStatus(n);
  if (bad) return json({ available: false, reason: bad });
  const row = await env.DB.prepare('SELECT 1 x FROM users WHERE username=?').bind(n).first();
  return json({ available: !row, reason: row ? 'taken' : null });
}
