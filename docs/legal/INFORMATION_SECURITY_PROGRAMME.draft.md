# CalmCarry Written Information Security Programme

**DRAFT FOR REVIEW. NOT YET ADOPTED. NOT LEGAL ADVICE.**
Values in [SQUARE BRACKETS] must be filled in and the document dated and signed before it counts as adopted.

**Version:** 0.1 (draft)
**Adopted:** [DATE]
**Owner:** [NAMED INDIVIDUAL, ROLE]
**Next review due:** [DATE + 12 MONTHS]

---

## Why this document exists

The amended COPPA Rule at 16 CFR 312.8(b) requires an operator that collects or maintains personal information from children to establish, implement and maintain a **written** children's information security programme containing the five elements below. The compliance date for the amended Rule was **22 April 2026**, which has passed.

CalmCarry's position is that kids mode does not transmit any personal information about a child to our servers (see `docs/legal/CHILDRENS_PRIVACY_NOTICE.draft.md`). This document is written anyway, for two reasons: the obligation attaches to maintaining as well as collecting, and the cost of having it is a few pages while the cost of not having it, if a regulator disagrees with our reading, is an enforceable violation.

> **[COUNSEL]** Confirm whether the operator for these purposes is the app developer, The Glow Company, or both, and name the same entity or entities here as in the children's privacy notice (16 CFR 312.4(d)(1)).

---

## 1. A named individual who coordinates the programme

**Coordinator:** [NAME], [ROLE], [EMAIL]

This person is accountable for: keeping this document current, running the annual assessment in section 2, approving changes to how children's data is handled, and being the contact for any parent or regulator enquiry.

> **[OWNER ACTION]** This must be a real named person, not a team or a company. One name.

---

## 2. Annual risk assessment, internal and external

Performed at least once every 12 months and after any material change to the kids surface.

**Internal risks considered:**
- A code change begins transmitting a child profile to the server. *Current control:* `src/lib/__tests__/kidsPrivacy.test.ts` fails the build if `api.createProfile` / `api.updateProfile` is called for a kids-type profile, or if any file under `src/features/kids/` imports the API layer, calls `fetch`, or calls `track`.
- Analytics or crash reporting begins firing while a child profile is active. *Current control:* `track()` returns early when kids mode is active and Sentry is closed in kids mode; both are asserted on the transport in the same test file, with a positive control proving the assertion can observe a real send.
- A third-party SDK is added that would receive children's data. *Current control:* the same test fails the build if an advertising, attribution or third-party analytics package appears in `package.json`. This is treated as a legal change, not a dependency change, because disclosure to third parties removes both the internal-operations exemption and the email-plus consent option.
- A child reaches adult areas of the app. *Current control:* the parent gate (salted SHA-256 PIN with lockout, optional Face ID) plus a route allow-list that redirects any non-kids route while a child profile is active.

**External risks considered:**
- Credential stuffing against parent accounts. *Current control:* per-IP throttling on credential routes, verified in production (16 attempts: 10 allowed, 6 blocked). Password reset codes are bcrypt-hashed, time-limited, and their attempt budget is not refillable by requesting a new code.
- Interception in transit. *Current control:* TLS end to end; the API is served over HTTPS only.
- Compromise of a stored secret. *Current control:* secrets live in the host's environment, not in the repository; `.gitignore` covers `.env*` and key material.
- Unauthorised access to the database. *Current control:* managed Postgres with TLS required; access limited to the service.

> **[OWNER ACTION]** Record the date each assessment is performed and by whom. An assessment that is not written down did not happen.

---

## 3. Safeguards proportionate to the sensitivity of the data

Because kids mode transmits nothing about a child, the strongest safeguard is architectural rather than procedural: there is no children's data at rest on our servers to protect.

Supporting safeguards:
- Authentication tokens are held in the platform keychain / keystore, not in general storage.
- The parent gate is required to leave kids mode and to reach account, purchase and deletion actions.
- Adult analytics are first-party only, keyed to a random per-install identifier, with a strict property allow-list; there is no third-party analytics SDK.
- Account deletion is available in-app and erases server-side records; the local wipe only proceeds on a confirmed server deletion.
- A daily automated purge enforces the retention limit (see section 5).

---

## 4. Regular testing and monitoring of the safeguards' effectiveness

- The invariants in section 2 run on **every push and every pull request** in CI, and the build fails if any of them regresses. CI covers both the app and the server (typecheck, lint, and the full test suites).
- `/health` reports the resolved client address and proxy hop count, so a silent failure of the rate limiter is one request to detect after any hosting change. This exists because the limiter was once perfectly wired and still dead in production.
- The retention purge runs daily and fails loudly (a red build) if it cannot authenticate or reach the API.

> **[OWNER ACTION]** Record the date of the most recent verification that the rate limiter and the retention purge both work in production. Both were verified on 2026-07-31.

---

## 5. Retention and deletion

CalmCarry retains personal information only as long as reasonably necessary for the purpose it was collected, and does not retain it indefinitely. See the published retention policy in the app's privacy screen and in the privacy notice (16 CFR 312.10).

- Session records and anonymous analytics events: **400 days**, then automatically deleted by the daily purge.
- Account records: kept while the account exists; erased on account deletion, except where tax or fraud law requires a billing record to be kept.
- Children's first names: never transmitted, so never retained by us. Deleted from the device when the profile is deleted or the app is removed.

> **[COUNSEL]** Confirm 400 days is defensible per data category against a stated business need. The Rule sets no numeric cap but requires the need to be articulated.

---

## 6. Service providers

> **[COUNSEL]** Enumerate every recipient of data and confirm whether any of them constitutes a "disclosure" of children's personal information as 16 CFR 312.2 defines it, since that determines whether the email-plus consent method remains available. At minimum: hosting, managed database, crash reporting, content delivery, push notifications, transactional email, and the payment platforms.

---

## Change log

| Date | Version | Change | By |
|---|---|---|---|
| [DATE] | 0.1 | Initial draft prepared for review | [NAME] |
