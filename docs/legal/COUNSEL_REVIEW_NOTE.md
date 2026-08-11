# CalmCarry Privacy Policy v2.1 — Counsel Sign-off Note

**For:** GLOWCO INTERNATIONAL LLC counsel
**Re:** CalmCarry Privacy Policy, Version 2.1, effective 11 August 2026
**Live copy:** https://calmcarry-api-production.up.railway.app/legal/privacy (served by the app + the App Store listing)
**Canonical source:** `docs/legal/privacy-policy.public.html` in the app repo

The policy was drafted to be accurate to the app as actually built (verified against the source code) and was red-teamed across UK/EU GDPR, CCPA/CPRA, COPPA, and Apple 5.1.1. All issues that a **drafting change** could fix have been applied. The items below are the ones that a drafting change **cannot** close — they need a lawyer's decision, an appointment, or a fact confirmed by the owner. None of them block the App Store submission; they are the path to a clean legal sign-off.

---

## A. Needs a lawyer's decision or appointment

1. **EU and UK Article 27 representatives (highest priority).** GLOWCO INTERNATIONAL LLC is a US controller offering the app to UK/EEA users, and the processing is ongoing (accounts, subscriptions), so the Article 27 exemption does not apply. The law requires appointing, by written mandate, an **EU-based representative** and a **separate UK-based representative**, and naming each (identity + contact) in the "Who we are" section. The policy currently states this obligation honestly and directs UK/EEA users to Admin@glowco.co in the interim, but the representatives must actually be appointed and named. (Third-party services provide this for a few hundred £/€ per year.)

2. **EU analytics — opt-in vs opt-out.** The pseudonymous usage analytics use an on-device per-install identifier and currently run **opt-out** (on by default). The policy bases this on legitimate interests, which matches the implementation. However, PECR (UK) / the ePrivacy Directive (EU) generally require **prior opt-in consent** to store/read an identifier on an EU/UK user's device. Decision needed: (a) accept the residual risk as-is, or (b) make analytics opt-in for EU/UK users. Option (b) is a small code change we can make on request.

3. **Children's section — re-confirm.** You reviewed an earlier version. The children's section was rewritten to (i) anchor on the no-collection theory rather than "not directed to children," (ii) scope the guarantees to *child-identifying* data, (iii) add an actual-knowledge deletion backstop for standard accounts, and (iv) add a "refuse further collection" clause. Please re-confirm this section.

4. **Vendor contracts.** The policy states we rely on **Standard Contractual Clauses + the UK IDTA** for US transfers and that each provider is contractually bound. Please confirm signed **Data Processing Agreements / SCCs** are in place with **Railway, Neon, and Resend**.

5. **Entity / group structure.** The controller is named as **GLOWCO INTERNATIONAL LLC** (this matches the Apple developer account: team NTTDKF8D29). The Glow Company retail site's own policy names a different entity ("CALMSTORE LIMITED / GLOWCO INTERNATIONAL PTY LTD"). Please confirm GLOWCO INTERNATIONAL LLC is the correct controller for the app and that the "retail brand associated with our group" wording is accurate.

## B. Facts for the owner to confirm (then we finalize the wording)

6. **COPPA phone number.** A formal COPPA notice lists a telephone number. We re-anchored on "no collection → COPPA notice-and-consent not triggered," so it is not strictly required, but if you want belt-and-braces, provide a staffed number and we'll add it.

7. **Neon database region.** The policy says the database is in **AWS US East**. Confirm the live Neon project's region matches (Neon dashboard).

8. **Vercel is dormant.** The live API runs on **Railway** (confirmed). The repo also contains dormant Vercel scaffolding. Confirm no Vercel deployment of the API holds data; if it does, we add Vercel as a US host.

9. **Email provider.** The policy names **Resend** as the transactional-email processor. Email is **not yet connected** (no SMTP configured on the server), so reset/verification emails are not currently sending. Once Resend is connected (account + verified domain + `SMTP_URL`), the wording is exactly accurate. If you use a different provider, tell us and we'll rename it.

## C. Optional code hardening we can do on request

10. **Make the child-data guarantee bulletproof.** Today the "child data never leaves the device" guarantee holds because the *client* declines to send it, but the *server* is technically built to accept a kids profile + age band. We can remove `kids`/age-band from the server's profile input so the backend literally cannot store child data. Recommended; say the word.

---

*Prepared as an engineering-side accuracy pass, not legal advice. The document is drafted to a professional standard and verified against the code, but a licensed attorney should sign off on items in Section A before you rely on it.*
