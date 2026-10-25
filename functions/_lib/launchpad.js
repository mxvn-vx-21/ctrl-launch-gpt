import { json, sameOrigin } from './util.js';
import { getUser } from './session.js';
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
export const SPA_ROUTES = new Set(['launchpad', 'pages', 'ai-studio', 'login', 'signup', 'deploy', 'account']);
export const RESERVED = new Set(['api','assets','login','signup','logout','launchpad','pages','ai-studio','admin','root','www','mail','support','help','about','terms','privacy','settings','dashboard','account','status','blog','docs','app','auth','verify','new','me','explore','discover','ctrl','monster','official','staff','team','security','abuse','billing','static','public','null','undefined','favicon','robots','sitemap','index','home','profile','user','users','cdn','dev','test','deploy','submit']);
export const handleStatus = n => !HANDLE_RE.test(n) ? 'invalid' : RESERVED.has(n) ? 'reserved' : null;
export const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const cleanMulti = (s, max) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
export function cleanUrl(u) {
  try { const x = new URL(String(u ?? '').trim()); if (!/^https?:$/.test(x.protocol) || x.username || x.password || x.href.length > 300) return null; return x.href; } catch { return null; }
}
export const CATEGORIES = ['web','mobile','desktop','game','ai','devtools','api','design','data','open-source','hardware','other'];
export const COMMENT_MAX = 1000;
export function slugify(t) {
  return String(t).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'project';
}
export function validateProject(b) {
  const e = {}, title = clean(b?.title, 60), tagline = clean(b?.tagline, 140), description = cleanMulti(b?.description, 3000);
  if (title.length < 2) e.title = 'Name must be 2–60 characters.';
  if (tagline.length < 5) e.tagline = 'Tagline must be 5–140 characters.';
  if (description.length < 20) e.description = 'Description must be 20–3000 characters.';
  const url = cleanUrl(b?.url); if (!url) e.url = 'Enter a valid http(s) website URL.';
  const rawRepo = String(b?.repo_url ?? '').trim(), repo_url = rawRepo ? cleanUrl(rawRepo) : null; if (rawRepo && !repo_url) e.repo_url = 'Enter a valid repository URL.';
  const rawLogo = String(b?.logo_url ?? '').trim(), logo_url = rawLogo ? cleanUrl(rawLogo) : null; if (rawLogo && (!logo_url || !logo_url.startsWith('https://'))) e.logo_url = 'Logo must be an https image URL.';
  const category = String(b?.category || '').toLowerCase(); if (!CATEGORIES.includes(category)) e.category = 'Choose a category.';
  let tags = b?.tags; if (typeof tags === 'string') tags = tags.split(','); if (!Array.isArray(tags)) tags = [];
  tags = [...new Set(tags.map(t => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean))];
  if (tags.length > 5) e.tags = 'Up to 5 tags.'; else if (tags.some(t => !/^[a-z0-9][a-z0-9-]{0,19}$/.test(t))) e.tags = 'Tags: letters, numbers and hyphens, up to 20 characters.';
  return Object.keys(e).length ? { errors: e } : { value: { title, tagline, description, url, repo_url, logo_url, category, tags } };
}
export const likeEsc = s => s.replace(/[\\%_]/g, '\\$&');
// Auth + CSRF guard for write endpoints. Returns {user,cookie} or a Response.
export async function guard(request, env, { write = true, needHandle = true } = {}) {
  if (write && !sameOrigin(request, env)) return json({ error: 'forbidden' }, 403);
  const s = await getUser(env, request);
  if (!s) return json({ error: 'unauthorized' }, 401);
  if (needHandle && !s.user.username) return json({ error: 'no_handle' }, 403);
  return s;
}
