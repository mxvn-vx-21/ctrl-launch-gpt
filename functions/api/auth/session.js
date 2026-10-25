import { json } from '../../_lib/util.js';
import { getUser } from '../../_lib/session.js';
export async function onRequestGet({ request, env }) {
  const s = await getUser(env, request);
  return json({ user: s ? s.user : null }, 200, s && s.cookie ? { 'set-cookie': s.cookie } : {});
}
