export const onRequestGet = ({ request, params }) => Response.redirect(`${new URL(request.url).origin}/${encodeURIComponent(String(params.username || '').toLowerCase())}`, 301);
