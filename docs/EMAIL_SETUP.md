# Email setup (Resend) - what you do, what I do

Password reset and email verification are **not working today**. The server has no
`SMTP_URL`, so `MailService` logs the message instead of sending it
(`server/src/config.ts:76-79`). The app tells the user "we emailed you a code", the API
returns HTTP 200, and nothing is ever sent. Anyone who signs up with an email address
and forgets their password is locked out permanently.

This is the fix, split into the part only you can do and the part I do.

---

## Your part (about 20 minutes)

**1. Create the Resend account.** Go to <https://resend.com> and sign up. The free tier
is 3,000 emails a month and 100 a day, which is far more than a launch needs.

**2. Add and verify the sending domain.** In Resend: **Domains → Add Domain**, enter
`theglowcompany.co`. Resend shows you 3 DNS records (one MX, two TXT - SPF and DKIM).
Those have to be added wherever the domain's DNS lives - if the site is on Shopify,
that is Shopify Admin → Settings → Domains, otherwise it is the registrar. **This is
the step that needs Mason** if he controls the domain. Verification usually completes
within an hour.

> Quicker alternative for testing only: Resend gives you `onboarding@resend.dev`
> immediately with no DNS at all. It works, but it sends from a resend.dev address,
> which looks wrong to a customer and can land in spam. Fine to unblock App Review,
> not fine to leave in place.

**3. Create the API key.** **API Keys → Create API Key**, permission **Sending access**,
name it `calmcarry-prod`. Copy it once - Resend never shows it again.

**4. Tell me it exists.** Do **not** paste the key into this chat. Add it to Railway
yourself:

Railway dashboard → project **calmcarry-api** → service **calmcarry-api** →
**Variables** → **New Variable**, twice:

| Name | Value |
|---|---|
| `SMTP_URL` | `smtps://resend:YOUR_API_KEY@smtp.resend.com:465` |
| `MAIL_FROM` | `CalmCarry <no-reply@theglowcompany.co>` |

(The username is the literal word `resend`. Only the key changes.)

Then press **Deploy**.

---

## My part (about 15 minutes, after you say it is set)

1. Verify the variables are present on the service without printing their values.
2. Trigger a real password-reset against production to a mailbox you nominate, and
   confirm the mail actually arrives - not just that the API returned 200, which it
   already does today while sending nothing.
3. Confirm the reset code works end to end and that the rate limiter still holds on
   the reset endpoint.
4. Fill the `[EMAIL PROVIDER]` row in `docs/legal/PRIVACY_POLICY.md` with Resend and
   its region, since a processor has to be named in the policy before it is published.

---

## Why not just hide the button

I offered that and you chose the vendor, which is the better long-term call: email
sign-in stays available, and account recovery is something a sleep app genuinely needs
at 3am. Worth knowing what the trade is - hiding it would have been 20 minutes and no
vendor, but it would have made Sign in with Apple the only account path in v1.

## If Resend is not verified before submission

Do not ship the broken path. Tell me and I will hide "Forgot password?" for v1 as a
20-minute change, and we turn it back on in 1.1 once DNS is sorted. A reviewer who
taps it and gets a code that never arrives is a Guideline 2.1 rejection.
