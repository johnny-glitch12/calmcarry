// Login wall for the CalmCarry preview (Vercel Edge Middleware, HTTP Basic Auth).
// Prompts for a username + password before anything (landing or app) loads.
// Credentials can be overridden by Vercel env vars PREVIEW_USER / PREVIEW_PASS;
// the defaults below are a throwaway preview gate - rotate anytime.
export const config = { matcher: '/(.*)' };

export default function middleware(request) {
  const USER = process.env.PREVIEW_USER || 'mason@321';
  const PASS = process.env.PREVIEW_PASS || '123mason';
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
