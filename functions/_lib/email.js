export async function sendEmail(env, { to, subject, html, text }) {
  const url = env.RESEND_API_URL || 'https://api.resend.com/emails';
  const from = env.AUTH_FROM_EMAIL || 'CTRL <noreply@ctrl.monster>';
  const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, html, text }) });
  if (!r.ok) { console.error('resend_failed', r.status, (await r.text()).slice(0, 300)); return false; }
  return true;
}
const wrap = (title, body, btn, href) => `<!doctype html><html><body style="margin:0;background:#050505;padding:32px 16px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:480px;margin:0 auto;background:#0e0e0e;border:1px solid #2a2a2a;border-radius:20px;padding:36px;color:#f2f2f0"><div style="font-size:12px;letter-spacing:.25em;color:#8a8a88;text-transform:uppercase">CTRL</div><h1 style="font-size:26px;margin:18px 0 12px">${title}</h1><p style="color:#a8a8a6;line-height:1.6;margin:0 0 28px">${body}</p><a href="${href}" style="display:inline-block;background:#f2f2f0;color:#050505;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:bold">${btn}</a><p style="color:#6e6e6c;font-size:12px;line-height:1.6;margin:28px 0 0">If you didn’t request this, you can ignore this email. The link works once and expires in 15 minutes.</p></div></body></html>`;
export const loginEmail = (to, link, isNew) => ({ to,
  subject: isNew ? 'Confirm your email for CTRL' : 'Your CTRL sign-in link',
  html: wrap(isNew ? 'Confirm your email' : 'Sign in', isNew ? 'Confirm this address to create your CTRL account.' : 'Use this link to sign in to CTRL.', isNew ? 'Confirm and continue' : 'Sign in', link),
  text: `${isNew ? 'Confirm your email to create your CTRL account' : 'Sign in to CTRL'}:\n${link}\n\nThe link works once and expires in 15 minutes. If you didn’t request this, ignore this email.` });
export const noAccountEmail = (to, origin) => ({ to, subject: 'No CTRL account for this email',
  html: wrap('No account yet', 'Someone tried to log in with this address, but no account exists. You can create one instead.', 'Create an account', `${origin}/#/signup`),
  text: `No CTRL account exists for this email. Create one: ${origin}/#/signup` });
