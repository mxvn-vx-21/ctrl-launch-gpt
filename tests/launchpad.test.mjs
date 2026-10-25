// Integration tests for Launchpad V1. Needs `wrangler pages dev --port 8788` running with
// RESEND_API_URL=http://127.0.0.1:9999/emails, APP_URL=http://localhost:8788, ADMIN_EMAILS=admin@example.com, and migrations applied.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
const BASE = process.env.BASE || 'http://localhost:8788', ORIGIN = new URL(BASE).origin, R = Math.random().toString(36).slice(2, 7);
const mails = {};
const mock = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => { const m = JSON.parse(b); mails[m.to[0]] = m.text; r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"id":"x"}'); }); });
test.before(() => new Promise(r => mock.listen(9999, r)));
test.after(() => mock.close());
async function call(path, { method = 'GET', body, cookie, origin = ORIGIN } = {}) {
  const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(origin && method !== 'GET' ? { origin } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text(); let d = null; try { d = JSON.parse(text); } catch {}
  return { s: res.status, d, text, res };
}
async function login(email, handle) {
  await call('/api/auth/email/request', { method: 'POST', body: { email, mode: 'signup' } });
  const token = /token=([A-Za-z0-9_-]+)/.exec(mails[email])[1];
  const r = await call('/api/auth/email/verify', { method: 'POST', body: { token } });
  assert.equal(r.s, 200);
  const cookie = r.res.headers.getSetCookie().map(c => c.split(';')[0]).find(c => c.startsWith('bb_session='));
  if (handle) assert.equal((await call('/api/launchpad/handle', { method: 'POST', cookie, body: { name: handle } })).s, 200);
  return cookie;
}
const proj = (o = {}) => ({ title: 'Test App ' + R, tagline: 'A tagline for tests', description: 'A long enough description for the project.', url: 'https://example.com', category: 'devtools', tags: ['test', 'cli'], ...o });
const S = {};
test('setup users', async () => { S.a = await login(`a${R}@example.com`, 'ta' + R); S.b = await login(`b${R}@example.com`, 'tb' + R); S.c = await login(`c${R}@example.com`, 'tc' + R); S.adm = await login('admin@example.com', 'adm' + R).catch(async () => login('admin@example.com')); });
test('writes require auth and same origin', async () => {
  assert.equal((await call('/api/launchpad/projects', { method: 'POST', body: proj() })).s, 401);
  assert.equal((await call('/api/launchpad/projects', { method: 'POST', body: proj(), cookie: S.a, origin: 'http://evil.com' })).s, 403);
});
test('validation rejects bad input', async () => {
  const r = await call('/api/launchpad/projects', { method: 'POST', cookie: S.a, body: proj({ title: 'x', url: 'javascript:alert(1)', category: 'nope', tags: ['A B', 'x', 'y', 'z', 'w', 'v'] }) });
  assert.equal(r.s, 400); assert.ok(r.d.fields.title && r.d.fields.url && r.d.fields.category && r.d.fields.tags);
  assert.equal((await call('/api/launchpad/projects', { method: 'POST', cookie: S.a, body: proj({ logo_url: 'http://insecure.com/a.png' }) })).s, 400);
});
test('create, unique slugs, XSS-safe rendering', async () => {
  const x = '<script>alert(1)</script>';
  const r1 = await call('/api/launchpad/projects', { method: 'POST', cookie: S.a, body: proj({ title: 'Same Name ' + R, description: x + ' description text here' }) });
  const r2 = await call('/api/launchpad/projects', { method: 'POST', cookie: S.a, body: proj({ title: 'Same Name ' + R }) });
  assert.equal(r1.s, 201); assert.equal(r2.s, 201); assert.notEqual(r1.d.slug, r2.d.slug); S.slug = r1.d.slug; S.slug2 = r2.d.slug;
  const page = await call('/launchpad/project/' + S.slug);
  assert.equal(page.s, 200); assert.ok(!page.text.includes(x)); assert.ok(page.text.includes('&lt;script&gt;alert(1)')); assert.ok(page.text.includes('rel="canonical"'));
  assert.equal((await call('/launchpad/project/does-not-exist')).s, 404);
});
test('ownership: others cannot edit or delete', async () => {
  assert.equal((await call('/api/launchpad/projects/' + S.slug, { method: 'PUT', cookie: S.b, body: proj() })).s, 404);
  assert.equal((await call('/api/launchpad/projects/' + S.slug, { method: 'DELETE', cookie: S.b })).s, 404);
  assert.equal((await call('/api/launchpad/projects/' + S.slug, { method: 'PUT', cookie: S.a, body: proj({ title: 'Renamed ' + R }) })).s, 200);
  const d = await call('/api/launchpad/projects/' + S.slug); assert.equal(d.d.project.title, 'Renamed ' + R); assert.equal(d.d.project.slug, S.slug);
});
test('voting: one vote per user, toggle, no self-vote, auth', async () => {
  const v = '/api/launchpad/projects/' + S.slug + '/vote';
  assert.equal((await call(v, { method: 'POST' })).s, 401);
  assert.equal((await call(v, { method: 'POST', cookie: S.a })).s, 403);
  const a = await call(v, { method: 'POST', cookie: S.b }), b = await call(v, { method: 'POST', cookie: S.b });
  assert.equal(a.d.vote_count, 1); assert.equal(b.d.vote_count, 1);
  assert.equal((await call(v, { method: 'POST', cookie: S.c })).d.vote_count, 2);
  assert.equal((await call(v, { method: 'DELETE', cookie: S.b })).d.vote_count, 1);
  assert.equal((await call(v, { method: 'DELETE', cookie: S.b })).d.vote_count, 1);
  assert.equal((await call('/api/launchpad/projects/' + S.slug, { cookie: S.c })).d.project.voted, true);
});
test('comments: validation, permissions, counts', async () => {
  const base = '/api/launchpad/projects/' + S.slug + '/comments';
  assert.equal((await call(base, { method: 'POST', body: { body: 'hi' } })).s, 401);
  assert.equal((await call(base, { method: 'POST', cookie: S.b, body: { body: '   ' } })).s, 400);
  assert.equal((await call(base, { method: 'POST', cookie: S.b, body: { body: 'x'.repeat(1001) } })).s, 400);
  const c = await call(base, { method: 'POST', cookie: S.b, body: { body: 'Nice <b>work</b>' } }); assert.equal(c.s, 201);
  const list = await call(base, { cookie: S.a }); const cm = list.d.comments.find(x => x.id === c.d.id);
  assert.equal(cm.body, 'Nice <b>work</b>'); assert.equal(cm.can_delete, true); assert.equal(cm.mine, false);
  assert.equal((await call('/api/launchpad/comments/' + c.d.id, { method: 'PUT', cookie: S.c, body: { body: 'hijack' } })).s, 404);
  assert.equal((await call('/api/launchpad/comments/' + c.d.id, { method: 'DELETE', cookie: S.c })).s, 403);
  assert.equal((await call('/api/launchpad/comments/' + c.d.id, { method: 'PUT', cookie: S.b, body: { body: 'edited' } })).s, 200);
  assert.equal((await call('/api/launchpad/projects/' + S.slug)).d.project.comment_count >= 1, true);
  assert.equal((await call('/api/launchpad/comments/' + c.d.id, { method: 'DELETE', cookie: S.a })).s, 200); // owner moderates
});
test('feed: search, filter, sort, trending, featured', async () => {
  const f = q => call('/api/launchpad/projects?' + q);
  assert.ok((await f('q=' + encodeURIComponent('Renamed ' + R))).d.projects.some(p => p.slug === S.slug));
  assert.equal((await f('q=zzzz' + R + 'nomatch')).d.projects.length, 0);
  assert.equal((await f('q=%25')).d.projects.length, 0); // LIKE wildcards are escaped
  assert.ok((await f('category=devtools&q=' + R)).d.projects.length >= 1);
  assert.equal((await f('category=game&q=' + R)).d.projects.length, 0);
  assert.ok((await f('tab=trending')).d.projects.some(p => p.slug === S.slug));
  assert.equal((await f('tab=featured')).d.projects.length, 0);
  assert.equal((await call('/api/launchpad/projects/' + S.slug + '/vote', { method: 'POST', cookie: S.b })).s, 200);
  const sorted = (await f('sort=votes&q=' + R)).d.projects; assert.equal(sorted[0].slug, S.slug);
  assert.equal((await call('/api/admin/projects/' + S.slug, { method: 'POST', cookie: S.a, body: { featured: true } })).s, 403);
  assert.equal((await call('/api/admin/projects/' + S.slug, { method: 'POST', cookie: S.adm, body: { featured: true } })).s, 200);
  const ft = await f('tab=featured'); assert.ok(ft.d.has_featured && ft.d.projects.some(p => p.slug === S.slug));
  await call('/api/admin/projects/' + S.slug, { method: 'POST', cookie: S.adm, body: { featured: false } });
});
test('profile page and delete cascade', async () => {
  const pg = await call('/ta' + R); assert.equal(pg.s, 200); assert.ok(pg.text.includes('/launchpad/project/' + S.slug));
  assert.equal((await call('/launchpad/profile/ta' + R)).s, 301);
  assert.equal((await call('/api/launchpad/projects/' + S.slug2, { method: 'DELETE', cookie: S.a })).s, 200);
  assert.equal((await call('/api/launchpad/projects/' + S.slug2)).s, 404);
});
