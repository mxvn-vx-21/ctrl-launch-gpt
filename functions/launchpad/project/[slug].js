import { esc, page } from '../../_lib/ui.js';
const SC = `(()=>{const S=document.body.dataset.slug,q=s=>document.querySelector(s);let me=null,voted=false,count=+q('#vc').textContent;
const api=(p,o={})=>fetch(p,{credentials:'same-origin',headers:{'content-type':'application/json'},...o}).then(async r=>({ok:r.ok,d:await r.json().catch(()=>({}))}));
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const E={unauthorized:'Please log in again.',no_handle:'Claim a handle on your account page first.',own_project:'You can’t vote for your own project.',rate_limited:'Too many requests. Try again later.',invalid:'Comments must be 1–1000 characters.',forbidden:'Request blocked. Reload and try again.'};
const msg=t=>{const m=q('#cm');m.textContent=t||'';m.hidden=!t};
const paint=()=>{const b=q('#vote');b.classList.toggle('on',voted);b.setAttribute('aria-pressed',String(voted));q('#vc').textContent=count};
q('#vote').onclick=async()=>{if(!me){msg('Log in to vote.');return}const on=!voted,pv=[voted,count];voted=on;count+=on?1:-1;paint();const r=await api('/api/launchpad/projects/'+S+'/vote',{method:on?'POST':'DELETE'});if(r.ok){voted=r.d.voted;count=r.d.vote_count;msg('')}else{voted=pv[0];count=pv[1];msg(E[r.d.error]||'Vote failed.')}paint()};
async function comments(){const r=await api('/api/launchpad/projects/'+S+'/comments'),L=q('#cl');L.replaceChildren();if(!r.ok){L.append(el('p','empty','Could not load comments.'));return}
if(!r.d.comments.length)L.append(el('p','empty','No comments yet.'));
r.d.comments.forEach(c=>{const w=el('div','cm'),hd=el('div','ch'),a=el('a',null,'@'+c.username);a.href='/'+c.username;hd.append(a,el('span',null,' · '+new Date(c.created_at).toLocaleString()+(c.edited_at?' (edited)':'')));const b=el('p','cb',c.body),act=el('div','ca');w.append(hd,b,act);
if(c.mine){const e=el('button','sm','Edit');e.onclick=()=>{const t=el('textarea','fi');t.value=c.body;t.maxLength=1000;const s=el('button','sm','Save');s.onclick=async()=>{const r2=await api('/api/launchpad/comments/'+c.id,{method:'PUT',body:JSON.stringify({body:t.value})});if(r2.ok)comments();else msg(E[r2.d.error]||'Failed.')};b.replaceWith(t);act.replaceChildren(s)};act.append(e)}
if(c.can_delete){const d=el('button','sm','Delete');d.onclick=async()=>{if(!confirm('Delete this comment?'))return;const r2=await api('/api/launchpad/comments/'+c.id,{method:'DELETE'});if(r2.ok)comments();else msg(E[r2.d.error]||'Failed.')};act.append(d)}
L.append(w)});q('#cc').textContent=r.d.comments.length}
q('#cf').onsubmit=async e=>{e.preventDefault();const t=q('#ct'),b=q('#cb2');b.disabled=true;const r=await api('/api/launchpad/projects/'+S+'/comments',{method:'POST',body:JSON.stringify({body:t.value})});b.disabled=false;if(r.ok){t.value='';msg('');comments()}else msg(E[r.d.error]||'Could not post comment.')};
(async()=>{const[a,p]=await Promise.all([api('/api/auth/session'),api('/api/launchpad/projects/'+S)]);me=a.d.user;if(p.ok){voted=p.d.project.voted;count=p.d.project.vote_count;paint()}
if(me)q('#cf').hidden=false;else q('#li').hidden=false;comments()})()})();`;
export async function onRequestGet({ request, env, params }) {
  const slug = String(params.slug || '').toLowerCase();
  const nf = () => page({ title: 'Project not found · CTRL', desc: 'This project does not exist.', body: '<div class="eb">404</div><h1>Project not found.</h1><p><a class="b" href="/#/launchpad">Back to Launchpad</a></p>', status: 404 });
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(slug)) return nf();
  const p = await env.DB.prepare('SELECT p.id,p.slug,p.title,p.tagline,p.description,p.url,p.repo_url,p.logo_url,p.category,p.vote_count,p.comment_count,p.created_at,u.username,u.name uname FROM projects p JOIN users u ON u.id=p.user_id WHERE p.slug=? AND u.username IS NOT NULL').bind(slug).first();
  if (!p) return nf();
  const tags = (await env.DB.prepare('SELECT tag FROM project_tags WHERE project_id=? ORDER BY tag').bind(p.id).all()).results;
  const origin = env.APP_URL ? new URL(env.APP_URL).origin : new URL(request.url).origin, canon = `${origin}/launchpad/project/${p.slug}`;
  const title = `${p.title} · CTRL Launchpad`;
  const head = `<link rel="canonical" href="${esc(canon)}"><meta property="og:url" content="${esc(canon)}"><meta property="og:type" content="website">${p.logo_url ? `<meta property="og:image" content="${esc(p.logo_url)}">` : ''}`;
  const body = `${p.logo_url ? `<img class="logo" src="${esc(p.logo_url)}" alt="" referrerpolicy="no-referrer">` : ''}<div class="eb">${esc(p.category)}</div><h1>${esc(p.title)}</h1><p class="lead">${esc(p.tagline)}</p>
<p class="ch">by <a href="/${esc(p.username)}">${esc(p.uname || p.username)} (@${esc(p.username)})</a> · launched ${esc(new Date(p.created_at).toISOString().slice(0, 10))}</p>
<div class="row">${tags.map(t => `<span class="chip">#${esc(t.tag)}</span>`).join('')}</div>
<div class="row"><button class="vbtn" id="vote" type="button" aria-pressed="false">▲ <span id="vc">${p.vote_count}</span></button><a class="b p" href="${esc(p.url)}" target="_blank" rel="noopener nofollow ugc">Visit website ↗</a>${p.repo_url ? `<a class="b" href="${esc(p.repo_url)}" target="_blank" rel="noopener nofollow ugc">Repository ↗</a>` : ''}</div>
${p.description ? `<p class="pre">${esc(p.description)}</p>` : ''}
<h2 id="comments">Comments (<span id="cc">${p.comment_count}</span>)</h2><p id="cm" hidden role="status"></p><div id="cl"></div>
<form id="cf" hidden><textarea class="fi" id="ct" maxlength="1000" placeholder="Add a comment" aria-label="Comment" required></textarea><button class="b p" id="cb2" type="submit">Post comment</button></form>
<p id="li" hidden><a class="b" href="/#/login">Log in</a> to vote or comment.</p>`;
  return page({ title, desc: p.tagline, body, head, script: SC, extra: { bodyAttrs: ` data-slug="${esc(p.slug)}"`, 'cache-control': 'no-cache' } });
}
