// Login wall for the CalmCarry preview (Vercel Edge Middleware, HTTP Basic Auth).
// Prompts for a username + password before anything (landing or app) loads.
// Credentials come ONLY from the Vercel env vars PREVIEW_USER / PREVIEW_PASS -
// no defaults live in source (this repo is public). Unset env = locked shut.
export const config = { matcher: '/(.*)' };

export default function middleware(request) {
  const USER = process.env.PREVIEW_USER || '';
  const PASS = process.env.PREVIEW_PASS || '';
  if (!USER || !PASS) {
    return new Response('Preview credentials are not configured.', {
      status: 503,
      headers: { 'content-type': 'text/plain' },
    });
  }
  const expected = 'Basic ' + btoa(`${USER}:${PASS}`);
  const provided = request.headers.get('authorization') || '';

  if (provided !== expected) {
    return new Response('Authentication required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="CalmCarry preview", charset="UTF-8"',
        'content-type': 'text/plain',
      },
    });
  }
  // authorized → fall through to the static asset
}
