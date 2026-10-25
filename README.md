# CTRL

Cloudflare Pages site (`public/`) + Pages Functions backend (`functions/`) + D1 database. Auth: Google, GitHub, passwordless email via Resend. No other dependencies (wrangler is dev-only).

## Setup

1. `npm i`
2. `npx wrangler d1 create ctrl` → put the returned `database_id` in `wrangler.toml`.
3. `npm run db:migrate` (remote) / `npm run db:migrate:local`. Re-run this after every update: new migrations (`0002_launchpad.sql` adds projects + bio) only apply when you run it.
4. Cloudflare dashboard → Pages project → Settings → Bind D1 `DB` (already declared in `wrangler.toml`).
5. Secrets (Pages → Settings → Variables and Secrets, or `npx wrangler pages secret put NAME`):

| Name | Purpose |
|---|---|
| `SESSION_SECRET` | HMAC key for OAuth state cookie. `openssl rand -base64 48` |
| `RESEND_API_KEY` | Resend API key (sending access) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |

Non-secret vars live in `wrangler.toml`: `APP_URL` (production origin) and `AUTH_FROM_EMAIL` (`CTRL <noreply@ctrl.monster>`).

6. **Resend:** add and verify the `ctrl.monster` domain (SPF + DKIM DNS records). Sending from noreply@ctrl.monster fails until it is verified.
7. **Google:** OAuth client (Web). Authorized redirect URI: `https://ctrl.monster/api/auth/google/callback`.
8. **GitHub:** OAuth App. Callback URL: `https://ctrl.monster/api/auth/github/callback`.
9. Deploy: `npm run deploy`, or connect the repo (build output dir `public`, no build command).

Providers without credentials are reported by `GET /api/auth/providers`, and the UI shows "isn't available yet" instead of failing.

## API

| Route | |
|---|---|
| `POST /api/auth/email/request` `{email, mode: "login"\|"signup"}` | Sends a single-use link (15 min). Same response whether or not the account exists. |
| `POST /api/auth/email/verify` `{token}` | Consumes the token atomically, creates the user (email verified) if new, starts a session. Errors: `invalid`, `expired`, `used`. |
| `GET /api/auth/{google,github}/start` / `callback` | OAuth code flow, signed state cookie, PKCE (Google). Verified provider email required; links to an existing account with the same verified email. |
| `GET /api/auth/session`, `POST /api/auth/logout` | Current user / end session. |
| `GET /api/auth/providers` | Which methods are configured. |

## Launchpad V1
Real routes: `/launchpad` (feed), `/launchpad/submit`, `/launchpad/project/{slug}` (server-rendered, shareable, with title, description, canonical and social meta), `/launchpad/profile/{username}` (redirects to the creator page `/{username}`). The feed, submit and account screens are part of the single-page app (`/#/launchpad`, `/#/launchpad/submit`, `/#/account`); `/launchpad`, `/launchpad/submit` and `/account` redirect there, so direct visits and refreshes work.

- **Feed:** tabs All / Featured / Trending / Newest, search (name, tagline, description, tags), topic filter, sort by recent activity / most votes / newest, pagination, skeletons, empty and error states. **Featured** only appears when at least one project has the `featured` flag (set by an admin: `POST /api/admin/projects/{slug}` `{"featured":true}`). **Trending** = projects that received votes in the last 7 days, ranked by those votes.
- **Submit:** name, tagline, description, website, optional repo, optional https logo URL, topic, up to 5 tags; preview before publishing; edit later from Account. Server-side validation of everything; ownership comes from the session, never the browser; slugs are generated and unique.
- **Votes:** one per user (database primary key), toggle, no voting for your own project, counts recomputed from the votes table, optimistic UI reconciled with the server.
- **Comments:** 1–1000 chars, login + handle required, edit/delete your own, project owners can delete comments on their projects, rate limited. All user text is rendered with `textContent`/HTML-escaping.
- **Profiles:** public page `ctrl.monster/{handle}` shows name, bio, website and projects. Email and sessions are never exposed.
- Rate limits: 5 submissions/hour, 120 votes/hour, 20 comments/hour per user.

| Route | |
|---|---|
| `GET /api/launchpad/projects?tab=&q=&category=&sort=&page=` | Feed |
| `POST /api/launchpad/projects` | Create |
| `GET`/`PUT`/`DELETE /api/launchpad/projects/{slug}` | Detail / edit / delete (owner) |
| `POST`/`DELETE /api/launchpad/projects/{slug}/vote` | Vote / remove vote |
| `GET`/`POST /api/launchpad/projects/{slug}/comments` | Comments |
| `PUT`/`DELETE /api/launchpad/comments/{id}` | Edit / delete comment |
| `GET /api/launchpad/me`, `PUT /api/launchpad/profile`, handle routes | Account |

Not built: nested comments, notifications, image upload (logos are https URLs), the cursor/tilt effects on the server-rendered project and profile pages (they use a simpler static style).

**Apply the new migration without a terminal:** Cloudflare dashboard → Storage & Databases → D1 → your database → Console. Paste the entire contents of `migrations/0004_launchpad_v1.sql` and run it once. (0001–0003 must already be applied. If a statement errors with "duplicate column", that part already ran; run only the statements after it.) Then redeploy via Git as usual.

Tests: `tests/launchpad.test.mjs` (`node --test tests/launchpad.test.mjs`) needs Node 20+ and a local `wrangler pages dev`; it is for a developer machine or CI, not required for deployment.

## Deploy (static sites)
Users upload a `.html` file or a `.zip` of a built site at `/#/deploy` and get `https://{name}.ctrl.monster`.
- Zips: a single top-level folder is stripped automatically, or give a directory (e.g. `dist`). `index.html` is required. Dotfiles (`.env`, `.git`), path traversal, executables and server scripts are rejected/dropped.
- Limits: 10 MB upload, 30 MB unpacked, 8 MB per file, 500 files, 5 sites per user, last 3 deployments kept (rollback available).
- Files live in R2 (`ctrl-sites`), metadata in D1. A separate Worker (`serve/`) serves `*.ctrl.monster` because Pages custom domains can't be wildcards. User sites run on subdomains so their scripts can't read CTRL's session cookie (host-only cookie).
- Static sites only. Build commands are intentionally not part of the product.

Setup:
1. `npx wrangler r2 bucket create ctrl-sites`
2. Re-run `npm run db:migrate` (adds sites, deployments, reports).
3. Redeploy Pages (R2 binding `SITES` is in `wrangler.toml`).
4. Fill the D1 `database_id` in `serve/wrangler.toml`, then `cd serve && npx wrangler deploy`.
5. DNS: add a proxied wildcard record `*` for `ctrl.monster` (e.g. AAAA `100::`, proxied). Universal SSL covers `*.ctrl.monster` (one level only).
6. Optional secret `ADMIN_EMAILS` (comma-separated): lets those accounts `POST /api/admin/sites/{slug}` `{"disabled":true}` to take a site down and `GET /api/admin/reports` to read reports from `POST /api/report`.

Caveat: unzipping runs inside a Pages Function. On the Workers Free plan the CPU limit is very low, so larger zips may fail; the Paid plan removes that problem.

## Security notes
- Email-link and session tokens are random 256-bit values; only SHA-256 hashes are stored. Cookie `bb_session`: HttpOnly, Secure, SameSite=Lax, 30 days, sliding renewal.
- Email links open `/#/verify?token=…` and need a button press (POST), so mail scanners that prefetch links can't consume them. The token sits in the URL fragment and isn't sent to servers.
- POST endpoints require a same-origin `Origin` header. Rate limits (D1): 5 emails/15 min per address, 20/hour per IP, 30 verifies/hour per IP.
- Strict headers/CSP in `public/_headers`. No secrets in client code.
- Schema is ready for creator profiles (`users.username`, `oauth_accounts`).

## Status
Tested locally (wrangler pages dev + mock Resend; 9 automated Launchpad tests pass: validation, auth/origin, ownership, votes, comments, search/filter/sort/trending/featured, XSS escaping): site create/deploy (zip + html), serving via the Worker, rollback, delete, bad-zip/path/exe rejection, reports and admin guard; Launchpad handle claim/check, profile, project create/delete, feed, public page rendering (HTML-escaped), auth guards and origin checks; email request → link → verify → session → logout, token reuse/invalid, origin check, rate limit, OAuth start redirect and forged-callback rejection.
**Not tested:** real Resend delivery, real Google/GitHub round trips, production Pages deployment, `_redirects` pretty URLs (`/login` → `/#/login`), UI in a browser.
Deployed: no.
