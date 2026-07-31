# CalmCarry Privacy Policy

**DRAFT FOR LEGAL REVIEW. NOT YET PUBLISHED. NOT LEGAL ADVICE.**
Every value in [SQUARE BRACKETS] needs a real answer before this goes live.

**Version:** 0.1 (draft)
**Last updated:** [DATE]
**Applies to:** the CalmCarry mobile app and the CalmCarry API.

> This is the app's own policy. It is deliberately separate from The Glow Company's
> shop policy, which covers buying physical products from the website. The app
> currently links users to the shop policy, which does not describe the app.
> [COUNSEL] Confirm whether these stay two documents or become one.

---

## Who we are

CalmCarry is operated by [FULL LEGAL ENTITY NAME], [REGISTERED ADDRESS], [COUNTRY].

> **[COUNSEL - BLOCKING]** If the app operator and The Glow Company are separate
> legal entities, and either one collects or maintains personal information, decide
> which is the controller (or whether they are joint controllers) and name the right
> one here. This same answer must be used in the children's notice and the security
> programme. Getting it wrong makes every "we" in this document point at the wrong
> company.

Contact us about anything in this policy:
- Email: [PRIVACY@DOMAIN]
- Post: [POSTAL ADDRESS]
- [If required: EU/UK representative, and a Data Protection Officer if one is appointed]

---

## The short version

- We ask for as little as we can, and we do not sell it. Ever.
- There are no advertising or cross-app tracking SDKs in this app.
- We do not listen to your room, record your sleep, or score your nights.
- A child profile is different: nothing about your child is sent to us at all. See
  the separate Children's Privacy Notice.
- You can export everything we hold about you, or delete your account, from inside
  the app in a couple of taps.

---

## What we collect, and why

### If you create an account
| What | Why |
|---|---|
| Email address | To identify your account, sign you in, and send password resets and verification codes |
| Your name | To greet you in the app |
| A one-way hash of your password | So we can check your password without ever storing it |
| Whether your email is verified | So your account stays recoverable |
| Your app preferences (for example your chosen bedtime reminder time, saved favourites) | So your settings follow you to a new phone |

If you sign in with Apple or Google, we receive the email address and name that
provider releases to us. If you use Sign in with Apple's Hide My Email, we only ever
see the relay address. For Sign in with Apple we also store a token that exists for
one purpose only: so that if you delete your account, we can tell Apple to revoke it.

### If you subscribe
Your subscription tier, status, plan and renewal date, plus the store's own reference
for the purchase. **Your card details never reach us.** Payment is handled entirely by
Apple or Google.

### If you register a Glow Orb
The device serial number, an optional nickname, the model, and warranty status. If you
make a warranty claim, we store the details of that claim.

### While you use the app
| What | Why | How long |
|---|---|---|
| Which sessions you played and when (tied to your account) | So your progress, recents and streaks work | Deleted after 400 days |
| Anonymous app-usage events | To understand which parts of the app help, keyed to a random per-install identifier and never to your name, email or account | Deleted after 400 days |
| Saved sound mixes | So you can reload a mix you built | Until you delete it or your account |
| Community posts, if you write one | To show the wins wall. Posts appear under a generic handle, not your name | Until you delete your account |
| A push token, if you turn on reminders | To deliver the reminders you asked for | Until you turn them off or delete your account |

You can turn off the account-linked session records and the anonymous usage events at
any time: **Settings, then "Share anonymous usage data".** Turning it off stops the
sending immediately and discards anything still queued on your device.

### What we do NOT collect
No microphone access and no audio recording. No sleep tracking, snore detection or
sleep score. No location. No contacts, calendar or photos. No advertising identifier.
No health-app data. No biometric data: Face ID is used only to unlock the parent gate,
and that check happens on your phone, so we never receive your face or fingerprint.

---

## Children

Nothing about a child is sent to us. When a parent creates a child profile, the first
name they type is stored on the phone and is never uploaded, so we cannot see it,
search it, or produce it. While a child profile is active the app records no usage
analytics and sends no crash reports, shows no advertising, and offers nothing social.

See the **CalmCarry Children's Privacy Notice** for the full explanation.

> **[COUNSEL]** Confirm the age-gating position and the target-audience declarations
> to be filed with Apple and Google. The app is deliberately not enrolled in Apple's
> Kids Category or Google Play's Designed for Families programme.

---

## Who we share it with

**We do not sell your personal information, and we do not share it for advertising.**

We use a small number of service providers to run the app. They process data on our
instructions only:

| Provider | What it handles |
|---|---|
| [HOSTING PROVIDER] | Runs the API |
| [DATABASE PROVIDER] | Stores the data described above |
| [CRASH REPORTING PROVIDER] | Crash and error diagnostics from adult profiles only, disabled entirely in a child profile. [Only applies if this is enabled at launch] |
| Apple and Google | Sign-in and subscription payments, under their own privacy policies |
| [EMAIL PROVIDER] | Sends password reset and verification codes |

We may also disclose information if the law requires it, or to protect the rights and
safety of users.

> **[COUNSEL - BLOCKING]** Name each provider explicitly and confirm none of them
> constitutes a "disclosure" of children's personal information as 16 CFR 312.2
> defines it. That determination decides whether the cheaper consent route stays
> available if the app's architecture ever changes.

---

## How long we keep it

We keep personal information only as long as we need it.

- **Session records and anonymous usage events: 400 days**, then deleted
  automatically by a daily job. We keep them that long so month-to-month and seasonal
  patterns remain meaningful, and no longer than that.
- **Account information:** kept while your account exists, and erased when you delete
  it, apart from billing and tax records we are legally required to retain.
- **A child's first name:** never sent to us, so never retained by us. It is removed
  from the device when the profile or the app is deleted.

> **[COUNSEL]** Confirm 400 days is defensible per category against a stated business
> need, and confirm the retention period for billing records under [JURISDICTION] tax
> law.

---

## Your rights

Wherever you live, you can:
- **Export your data.** Settings, then "Export my data" produces a file of what is
  tied to your account.
- **Delete your account and data.** Settings, then "Delete account". This is permanent
  and immediate. Note it does not cancel a subscription: cancel that in your Apple or
  Google account settings.
- **Turn off usage measurement.** Settings, then "Share anonymous usage data".
- **Correct your details** by editing them in the app, or by emailing us.

Depending on your country you may also have the right to object to or restrict
processing, to data portability, and to complain to your data protection authority
([UK: the ICO. EU: your national authority. UAE: the UAE Data Office. Australia: the
OAIC]).

> **[COUNSEL]** Confirm the legal bases table below, and whether a separate UK/EU
> representative must be named.

**Legal bases (UK/EU GDPR):** performance of a contract (running your account and
subscription); legitimate interests (keeping the service secure and working, and
understanding aggregate usage); consent (push notifications, and usage measurement,
which you can withdraw at any time); legal obligation (tax and accounting records).

---

## Where your data is held

Our servers and database are hosted in [REGION]. If you use the app from outside that
region, your information is transferred there.

> **[COUNSEL - BLOCKING]** Confirm the hosting and database regions and the transfer
> mechanism for UK/EU users (for example Standard Contractual Clauses or the UK
> Addendum), and whether UAE PDPL cross-border requirements apply.

---

## How we protect it

Traffic between the app and our servers is encrypted in transit. Passwords are stored
only as one-way hashes. Sign-in tokens are held in your phone's secure keychain.
Changing your password immediately ends every other signed-in session. Administrative
access to the database is restricted, and rate limiting protects sign-in and password
reset against automated guessing.

No service can promise perfect security, but we design so that the most sensitive
thing in a family's account, a child's information, is never in our systems at all.

---

## Changes to this policy

If we make a material change we will update the date at the top and tell you in the
app before the change takes effect.

---

## Contact

[PRIVACY@DOMAIN] | [POSTAL ADDRESS]

---

### Reviewer note (delete before publishing)

Every factual claim above was written against the app as built and checked in code.
If the app changes in any of these ways, this policy becomes false and must be updated
in the same release:
- a child's name, or any child data, is sent to the server
- an advertising, attribution or third-party analytics SDK is added
- microphone or sleep tracking is added
- kids mode gains server-delivered content, push, or anything social
The first two are enforced by `src/lib/__tests__/kidsPrivacy.test.ts`, which fails the
build. The rest are not, and rely on whoever writes the release.
