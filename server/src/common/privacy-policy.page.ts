/**
 * Self-hosted CalmCarry privacy policy, served at GET /legal/privacy.
 *
 * CANONICAL SOURCE: docs/legal/privacy-policy.public.html (app repo root). This is
 * the same body wrapped in a standalone, mobile-readable HTML document so the app
 * and the App Store listing can link to a URL we control, without waiting on the
 * Shopify storefront. If the canonical file changes, update this string too (the
 * body below is a verbatim copy of it).
 */
const BODY = `
<h1>CalmCarry Privacy Policy</h1>
<p><strong>Version:</strong> 1.0<br>
<strong>Last updated:</strong> 11 August 2026<br>
<strong>Applies to:</strong> the CalmCarry mobile app and the CalmCarry API.</p>

<h2>Who we are</h2>
<p>CalmCarry is operated by <strong>GLOWCO INTERNATIONAL LLC</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;), which is the data controller for the information described in this policy. GLOWCO INTERNATIONAL LLC is the entity that publishes CalmCarry on the App Store and operates the CalmCarry API; &ldquo;The Glow Company&rdquo; is a brand it trades under.</p>
<p>Contact us about anything in this policy:</p>
<ul>
  <li>Email: Admin@glowco.co</li>
  <li>Post: 607 Gazetta Way, West Palm Beach, Florida 33413, United States of America</li>
</ul>

<h2>The short version</h2>
<ul>
  <li>We ask for as little as we can, and we do not sell it. Ever.</li>
  <li>There are no advertising or cross-app tracking SDKs in this app.</li>
  <li>We do not listen to your room, record your sleep, or score your nights.</li>
  <li>A child profile is different: nothing about your child is sent to us at all. What little a child profile needs is stored only on the phone.</li>
  <li>You can export everything we hold about you, or delete your account, from inside the app in a couple of taps.</li>
</ul>

<h2>What we collect, and why</h2>
<h3>If you create an account</h3>
<table>
  <thead><tr><th>What</th><th>Why</th></tr></thead>
  <tbody>
    <tr><td>Email address</td><td>To identify your account, sign you in, and send password resets and verification codes</td></tr>
    <tr><td>Your name</td><td>To greet you in the app</td></tr>
    <tr><td>A one-way hash of your password</td><td>So we can check your password without ever storing it</td></tr>
    <tr><td>Whether your email is verified</td><td>So your account stays recoverable</td></tr>
    <tr><td>Your app preferences (for example your chosen bedtime reminder time, saved favourites)</td><td>So your settings follow you to a new phone</td></tr>
  </tbody>
</table>
<p>If you sign in with Apple or Google, we receive the email address and name that provider releases to us. If you use Sign in with Apple&rsquo;s Hide My Email, we only ever see the relay address. For Sign in with Apple we also store a token that exists for one purpose only: so that if you delete your account, we can tell Apple to revoke it.</p>

<h3>If you subscribe</h3>
<p>Your subscription tier, status, plan and renewal date, plus the store&rsquo;s own reference for the purchase. <strong>Your card details never reach us.</strong> Payment is handled entirely by Apple or Google.</p>

<h3>If you register a Glow Orb</h3>
<p>The device serial number, an optional nickname, the model, and warranty status. If you make a warranty claim, we store the details of that claim.</p>

<h3>While you use the app</h3>
<table>
  <thead><tr><th>What</th><th>Why</th><th>How long</th></tr></thead>
  <tbody>
    <tr><td>Which sessions you played and when (tied to your account)</td><td>So your progress, recents and streaks work</td><td>Deleted after 400 days</td></tr>
    <tr><td>Anonymous app-usage events</td><td>To understand which parts of the app help, keyed to a random per-install identifier and never to your name, email or account</td><td>Deleted after 400 days</td></tr>
    <tr><td>Saved sound mixes</td><td>So you can reload a mix you built</td><td>Until you delete it or your account</td></tr>
    <tr><td>A push token, if you turn on reminders</td><td>To deliver the reminders you asked for</td><td>Until you turn them off or delete your account</td></tr>
  </tbody>
</table>
<p>You can turn off the account-linked session records and the anonymous usage events at any time: <strong>Settings, then &ldquo;Share anonymous usage data&rdquo;.</strong> Turning it off stops the sending immediately and discards anything still queued on your device.</p>

<h3>What we do NOT collect</h3>
<p>No microphone access and no audio recording. No sleep tracking, snore detection or sleep score. No location. No contacts, calendar or photos. No advertising identifier. No health-app data. No biometric data: Face ID is used only to unlock the parent gate, and that check happens on your phone, so we never receive your face or fingerprint.</p>
<p><strong>No crash or diagnostic reports.</strong> Crash reporting is built into the app but ships switched off, with no destination configured, so no crash or error data leaves your phone in this release.</p>

<h2>Children</h2>
<p>Nothing about a child is sent to us. When a parent creates a child profile, the first name they type is stored on the phone and is never uploaded, so we cannot see it, search it, or produce it. While a child profile is active the app records no usage analytics and sends no crash reports, shows no advertising, and offers nothing social.</p>
<p>Because nothing about a child ever leaves the device, none of our service providers receives it, and there is nothing about your child for us to hold, export, correct, or delete on our servers. The first name stored on the phone is removed when the child profile or the app is deleted. Kids Mode sits inside an adult account, behind a parent gate that the child cannot pass. If you have any question about your child&rsquo;s information, email us at Admin@glowco.co.</p>

<h2>Who we share it with</h2>
<p><strong>We do not sell your personal information, and we do not share it for advertising.</strong></p>
<p>We use a small number of service providers to run the app. They process data on our instructions only:</p>
<table>
  <thead><tr><th>Provider</th><th>What it handles</th><th>Where</th></tr></thead>
  <tbody>
    <tr><td>Railway Corp.</td><td>Runs the CalmCarry API</td><td>United States</td></tr>
    <tr><td>Neon Inc.</td><td>The database storing everything described above</td><td>AWS US East (N. Virginia), United States</td></tr>
    <tr><td>Apple, Google</td><td>Sign-in and subscription payments, under their own privacy policies</td><td>Global</td></tr>
    <tr><td>Resend (resend.com)</td><td>Sends password reset and verification codes</td><td>United States</td></tr>
  </tbody>
</table>
<p>We may also disclose information if the law requires it, or to protect the rights and safety of users.</p>
<p><strong>None of these providers ever receives a child&rsquo;s personal information.</strong> A child&rsquo;s data is never transmitted from the device at all, so it never reaches Railway, Neon, Resend, Apple or Google. No disclosure of children&rsquo;s personal information, as defined by 16 CFR 312.2, takes place.</p>

<h2>How long we keep it</h2>
<p>We keep personal information only as long as we need it.</p>
<ul>
  <li><strong>Session records and anonymous usage events: 400 days</strong>, then deleted automatically by a daily job. We keep them that long so month-to-month and seasonal patterns remain meaningful, and no longer than that.</li>
  <li><strong>Account information:</strong> kept while your account exists, and erased when you delete it.</li>
  <li><strong>Purchases:</strong> recorded by Apple or Google, not by us, and kept under their own policies. This server holds no invoice, receipt or payment ledger of its own.</li>
  <li><strong>A child&rsquo;s first name:</strong> never sent to us, so never retained by us. It is removed from the device when the profile or the app is deleted.</li>
</ul>

<h2>Your rights</h2>
<p>Wherever you live, you can:</p>
<ul>
  <li><strong>Get a copy of your data.</strong> Settings, then &ldquo;Export my data&rdquo; hands you everything tied to your account, ready to save or send on.</li>
  <li><strong>Delete your account and data.</strong> Settings, then &ldquo;Delete account&rdquo;. This is permanent and immediate. Note it does not cancel a subscription: cancel that in your Apple or Google account settings.</li>
  <li><strong>Turn off usage measurement.</strong> Settings, then &ldquo;Share anonymous usage data&rdquo;.</li>
  <li><strong>Correct your details</strong> by editing them in the app, or by emailing us.</li>
</ul>
<p>Depending on your country you may also have the right to object to or restrict processing, to data portability, and to complain to your data protection authority (in the UK, the ICO; in the EU, your national authority; in the UAE, the UAE Data Office; in Australia, the OAIC).</p>
<p><strong>Legal bases (UK/EU GDPR):</strong> performance of a contract (running your account and subscription); legitimate interests (keeping the service secure and working, and understanding aggregate usage); consent (push notifications, and usage measurement, which you can withdraw at any time); legal obligation (tax and accounting records).</p>

<h2>Where your data is held</h2>
<p>Our API is hosted by Railway in the United States, and our database is hosted by Neon in AWS US East (N. Virginia), United States. If you use the app from outside the United States, your information is transferred there.</p>
<p>For users in the UK and the EU/EEA, these transfers are made under the European Commission&rsquo;s <strong>Standard Contractual Clauses</strong>, and the <strong>UK International Data Transfer Addendum</strong> for UK users, which place contractual safeguards on the information when it is processed in the United States.</p>

<h2>How we protect it</h2>
<p>Traffic between the app and our servers is encrypted in transit. Passwords are stored only as one-way hashes. Sign-in tokens are held in your phone&rsquo;s secure keychain. Changing your password immediately ends every other signed-in session. Administrative access to the database is restricted, and rate limiting protects sign-in and password reset against automated guessing.</p>
<p>No service can promise perfect security, but we design so that the most sensitive thing in a family&rsquo;s account, a child&rsquo;s information, is never in our systems at all.</p>

<h2>Changes to this policy</h2>
<p>If we make a material change we will update the date at the top and tell you in the app before the change takes effect.</p>

<h2>Contact</h2>
<p>Admin@glowco.co &nbsp;|&nbsp; 607 Gazetta Way, West Palm Beach, Florida 33413, United States of America</p>
`;

export const PRIVACY_POLICY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index,follow">
<title>CalmCarry Privacy Policy</title>
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
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 22px 72px;
  }
  h1 { font-size: 1.7rem; line-height: 1.25; margin: 0 0 .5rem; }
  h2 { font-size: 1.2rem; margin: 2rem 0 .5rem; padding-top: .4rem; border-top: 1px solid #dfe6e4; }
  h3 { font-size: 1.02rem; margin: 1.3rem 0 .4rem; }
  p, li { font-size: 1rem; }
  a { color: #2f6d6a; }
  ul { padding-left: 1.2rem; }
  table { width: 100%; border-collapse: collapse; margin: .6rem 0 1rem; font-size: .95rem; }
  th, td { text-align: left; vertical-align: top; padding: 8px 10px; border: 1px solid #dfe6e4; }
  th { background: #eef3f2; font-weight: 600; }
  .wrap { overflow-x: auto; }
  @media (prefers-color-scheme: dark) {
    body { color: #e7edeb; background: #0f1615; }
    h2 { border-top-color: #26302e; }
    a { color: #8fc9be; }
    th, td { border-color: #26302e; }
    th { background: #17201e; }
  }
</style>
</head>
<body>
<main>
${BODY}
</main>
</body>
</html>`;
