import { unzipSync } from 'fflate';
export const LIMITS = { upload: 10 * 1024 * 1024, total: 30 * 1024 * 1024, file: 8 * 1024 * 1024, files: 500, sites: 5, keep: 3 };
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED = new Set(['www','api','app','admin','mail','smtp','ftp','imap','pop','mx','ns1','ns2','dashboard','static','assets','cdn','status','support','help','blog','docs','login','signup','auth','ctrl','monster','root','test','dev','staging','email','webmail','check','abuse','security','billing']);
export const slugStatus = s => (!SLUG_RE.test(s) || s.includes('--')) ? 'invalid' : RESERVED.has(s) ? 'reserved' : null;
export const siteUrl = (env, slug) => `https://${slug}.${env.SITES_DOMAIN || 'ctrl.monster'}`;
const BLOCKED = new Set(['exe','dll','bat','cmd','com','scr','msi','apk','jar','sh','ps1','vbs','lnk','dmg','pkg','app','php','asp','aspx','jsp','cgi','pl']);
const MIME = { html:'text/html; charset=utf-8',htm:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',json:'application/json; charset=utf-8',map:'application/json',txt:'text/plain; charset=utf-8',xml:'application/xml',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',ico:'image/x-icon',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',pdf:'application/pdf',wasm:'application/wasm',webmanifest:'application/manifest+json',md:'text/markdown; charset=utf-8',csv:'text/csv; charset=utf-8' };
const ext = p => { const m = /\.([a-z0-9]+)$/i.exec(p); return m ? m[1].toLowerCase() : ''; };
export const mimeFor = p => MIME[ext(p)] || 'application/octet-stream';
function normPath(p) {
  p = String(p).replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  if (!p || /[\u0000-\u001f]/.test(p)) return null;
  const seg = p.split('/');
  if (seg.some(s => s === '' || s === '..' || s === '.')) return null;
  return seg.join('/');
}
// -> { files:[{path,data}] } | { error }
export function extract(bytes, filename, dir) {
  const name = String(filename || '').toLowerCase();
  if (/\.html?$/.test(name)) return bytes.length > LIMITS.file ? { error: 'too_large' } : { files: [{ path: 'index.html', data: bytes }] };
  if (!name.endsWith('.zip')) return { error: 'unsupported' };
  let count = 0, total = 0, raw;
  try {
    raw = unzipSync(bytes, { filter: f => { if (f.name.endsWith('/')) return false; count++; total += f.originalSize; if (count > LIMITS.files * 2 || total > LIMITS.total * 2 || f.originalSize > LIMITS.file) throw new Error('too_large'); return true; } });
  } catch (e) { return { error: e.message === 'too_large' ? 'too_large' : 'bad_zip' }; }
  let list = [];
  for (const [k, data] of Object.entries(raw)) {
    const p = normPath(k); if (!p) return { error: 'bad_path' };
    const seg = p.split('/');
    if (seg[0] === '__MACOSX' || seg.some(s => s.startsWith('.') && s !== '.well-known')) continue; // dotfiles/.git/.env never published
    list.push({ path: p, data });
  }
  const d = dir ? normPath(dir) : null;
  if (dir && !d) return { error: 'bad_path' };
  if (d) list = list.filter(f => f.path.startsWith(d + '/')).map(f => ({ ...f, path: f.path.slice(d.length + 1) }));
  else if (list.length && list.every(f => f.path.includes('/')) && new Set(list.map(f => f.path.split('/')[0])).size === 1) list = list.map(f => ({ ...f, path: f.path.split('/').slice(1).join('/') }));
  if (!list.length || !list.some(f => f.path === 'index.html')) return { error: 'no_index' };
  let sum = 0;
  for (const f of list) { sum += f.data.length; if (BLOCKED.has(ext(f.path))) return { error: 'blocked_type' }; }
  if (list.length > LIMITS.files || sum > LIMITS.total) return { error: 'too_large' };
  return { files: list };
}
export async function delPrefix(bucket, prefix) {
  let cursor;
  do { const l = await bucket.list({ prefix, cursor, limit: 1000 }); if (l.objects.length) await bucket.delete(l.objects.map(o => o.key)); cursor = l.truncated ? l.cursor : undefined; } while (cursor);
}
export const isAdmin = (env, user) => (env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean).includes(user.email.toLowerCase());
