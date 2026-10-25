import { json } from '../../_lib/util.js';
import { guard, clean, cleanMulti, cleanUrl } from '../../_lib/launchpad.js';
export async function onRequestPut({ request, env }) {
  const g = await guard(request, env); if (g instanceof Response) return g;
  const b = await request.json().catch(() => null);
  const name = clean(b?.name, 50) || null, bio = cleanMulti(b?.bio, 280) || null, rw = String(b?.website ?? '').trim(), website = rw ? cleanUrl(rw) : null;
  if (rw && !website) return json({ error: 'invalid', fields: { website: 'Enter a valid http(s) URL.' } }, 400);
  await env.DB.prepare('UPDATE users SET name=?, bio=?, website=? WHERE id=?').bind(name, bio, website, g.user.id).run();
  return json({ ok: true, name, bio, website });
}
