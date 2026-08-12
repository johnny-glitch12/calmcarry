/**
 * Self-hosted CalmCarry support page, served at GET /legal/support.
 *
 * Why self-hosted: the App Store listing and the in-app "Help & support" rows must
 * point at a URL that (a) always returns 200 - the storefront contact page bounced
 * through 3 redirects and has returned a 5xx - and (b) does not route users into the
 * retail storefront, which the DEVICE_SHOP_ENABLED gate deliberately avoids for v1
 * (App Store guideline 1.4.1; see the app's src/lib/flags.ts). Same rationale as the
 * self-hosted privacy policy next to this file.
 */
export const SUPPORT_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index,follow">
<title>CalmCarry Support</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #1d2a28;
    background: #f6f8f7;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 680px; margin: 0 auto; padding: 40px 22px 72px; }
  h1 { font-size: 1.7rem; line-height: 1.25; margin: 0 0 .5rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; padding-top: .4rem; border-top: 1px solid #dfe6e4; }
  p, li { font-size: 1rem; }
  a { color: #2f6d6a; }
  ul { padding-left: 1.2rem; }
  .chip { display: inline-block; background: #eef3f2; border-radius: 8px; padding: 2px 8px; font-size: .92em; }
  @media (prefers-color-scheme: dark) {
    body { color: #e7edeb; background: #0f1615; }
    h2 { border-top-color: #26302e; }
    a { color: #8fc9be; }
    .chip { background: #17201e; }
  }
</style>
</head>
<body>
<main>
  <h1>CalmCarry Support</h1>
  <p>CalmCarry is the sleep and wind-down app from GLOWCO INTERNATIONAL LLC. If something
  is not working, or you have a question about your account, subscription, or a
  registered device, we want to hear from you.</p>

  <h2>Contact us</h2>
  <ul>
    <li>Email: <a href="mailto:Admin@glowco.co"><strong>Admin@glowco.co</strong></a></li>
    <li>Post: GLOWCO INTERNATIONAL LLC, 607 Gazetta Way, West Palm Beach, Florida 33413, United States of America</li>
  </ul>
  <p>To help us help you faster, include: the email on your CalmCarry account, your
  device model and iOS version, and what you expected to happen versus what happened.</p>

  <h2>Subscriptions and billing</h2>
  <p>CalmCarry Premium is billed through your Apple or Google account, and cancelling is
  done there too: on iPhone, <span class="chip">Settings &rarr; your name &rarr; Subscriptions</span>.
  Deleting the app or your CalmCarry account does not cancel a subscription. Refunds for
  App Store purchases are handled by Apple at
  <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>.</p>

  <h2>Your account and data</h2>
  <p>You can export everything tied to your account (Settings &rarr; &ldquo;Export my data&rdquo;)
  or delete your account and its data permanently (Settings &rarr; &ldquo;Delete account&rdquo;)
  from inside the app, no email required. The full details are in our
  <a href="/legal/privacy">Privacy Policy</a>.</p>

  <h2>The CalmCarry device</h2>
  <p>Questions about a physical CalmCarry device, an order, or a warranty claim are
  handled by the same team at <a href="mailto:Admin@glowco.co">Admin@glowco.co</a>.
  You can register a device and start a warranty claim from inside the app.</p>
</main>
</body>
</html>`;
