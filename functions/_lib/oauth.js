export const PROVIDERS = {
  google: { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile', id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
  github: { auth: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email', id: 'GITHUB_CLIENT_ID', secret: 'GITHUB_CLIENT_SECRET' },
};
export const isConfigured = (env, p) => !!(env[PROVIDERS[p].id] && env[PROVIDERS[p].secret] && env.SESSION_SECRET);
export async function fetchProfile(p, token) {
  const h = { accept: 'application/json', authorization: `Bearer ${token}`, 'user-agent': 'ctrl-monster' };
  if (p === 'google') {
    const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: h }); if (!r.ok) return null;
    const u = await r.json(); if (!u.sub || !u.email || u.email_verified !== true) return { error: 'no_verified_email' };
    return { pid: String(u.sub), email: u.email, name: u.name || null, avatar: u.picture || null };
  }
  const [ur, er] = await Promise.all([fetch('https://api.github.com/user', { headers: h }), fetch('https://api.github.com/user/emails', { headers: h })]);
  if (!ur.ok || !er.ok) return null;
  const u = await ur.json(), emails = await er.json();
  const e = emails.find(x => x.primary && x.verified) || emails.find(x => x.verified);
  if (!u.id || !e) return { error: 'no_verified_email' };
  return { pid: String(u.id), email: e.email, name: u.name || u.login || null, avatar: u.avatar_url || null };
}
