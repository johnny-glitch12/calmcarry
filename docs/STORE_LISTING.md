# CalmCarry Store Listing

**Rewritten 2026-08-04, fact-checked line by line against the shipped app.**
The previous version made claims the app cannot back. They are listed at the bottom
under "What was removed and why" so nobody reinstates them.

Counts below are measured from `src/content/library.ts`: **60 tracks** (31
soundscapes, 16 noise colours, 7 music, 4 breathing, 2 guided), **8 free**,
**4 multi-week programs**, **0 sleep tales**.

---

## App Name (30 chars)
`CalmCarry: Calm in Your Palm`
*(28)*

## Subtitle - Apple (30 chars)
`Wind down a busy mind`
*(21)*

## Short Description - Google Play (80 chars)
`Soothing sounds and gentle breathing to help a busy mind finally settle.`
*(71)*

## Promotional Text (170 chars)
`When thoughts won't settle and the day still hums, CalmCarry is the gentle hand to hold. Rest the device in your palm, follow a session, and let yourself wind down.`
*(162)*

---

## Full Description

**Some nights, the mind just won't switch off.**

CalmCarry is the official companion app to The Glow Company's handheld CalmCarry device - a warm, gentle way to wind down when thoughts are racing and you can't seem to settle. CalmCarry is not a medical device and does not diagnose, treat, or prevent any condition. It's simply a calmer corner of your evening: something to hold, something to follow, and a little more quiet at the end of a long day.

**For the ones who are tired of being tired**

If you've rocked a baby at 3am and still couldn't fall back asleep yourself. If you've worked your way through every bottle on the shelf and woke up groggy anyway. If your evenings feel wired when they should feel winding-down - this was made with you in mind. No labels. No fixing. Just a gentle place to land.

**Hold the device. Follow the cues.**

Rest the CalmCarry device in your palm and set it to a comfortable level - you'll feel a gentle pulsing or tingling in the centre of your hand. Open the app, choose a session, and let the on-screen cues walk you through it: when to breathe in, when to hold, when to let go. The device works perfectly on its own. The app is an optional way to go deeper.

**What's inside**

- **60 sounds to drift to** - rain, ocean, fire, forest, wind, fans and hums, plus the full range of noise colours, layerable in a mixer that keeps playing while you move around the app
- **A sleep timer that actually works** - set it and the sound fades out on time, even with your phone locked
- **Four breathing exercises** - box breathing, the cyclic sigh, extended exhale and 4-7-8, paced by a breathing circle you follow with your own breath. No voice, nothing to listen to, just the rhythm
- **Two guided sessions** - a body-relaxation sweep and an end-of-day wind-down. The narration is an AI voice for now, while human recordings are produced, and the app tells you so before you play them
- **Four multi-week programs** - including a free seven-night starter you can finish without paying, and a 14-night reset for the small hours
- **A one-tap rescue** for nights that go sideways: a sighing pacer, a grounding exercise, and somewhere to set the day down
- **My CalmCarry** - register your device, confirm it's genuine, and keep your warranty in one place

**A safe space for little ones, too**

Kids Mode is parent-gated behind a PIN. Inside there are calming sounds chosen for younger ears - and nothing else: no chat, no ads, no social, and no analytics. The first name you type for your child stays on your phone and is never uploaded to us.

**Free to start. Honest about the rest.**

CalmCarry is free to use. The free tier includes eight sounds and sessions, all four breathing exercises, and the complete seven-night starter program - a real week of wind-downs, not a teaser.

Premium opens the full 60-sound library, every program, and the whole sound machine, shared across your household: **$12.99/month or $69.99/year**. The annual plan opens with a **3-day free trial**, and the app shows you the exact date of your first charge before you start it. Cancel any time in your Apple or Google account settings - the app takes you straight there in one tap. Subscriptions are billed through your Apple or Google account.

**The Glow Company way**

We make warm, natural things for rest and wellbeing - and we see you as a person, never a patient. No advertising, no cross-app tracking, and we never sell your data. Just a gentle hand to hold at the end of the day.

---

## Keywords - Apple (100 chars)
`calm,sleep,sounds,wind down,relax,busy mind,bedtime,breathe,soothing,white noise,sleep timer,rest`
*(96)*

## What's New (v1.0)
Hello, and welcome to CalmCarry.

This is our very first release - the gentle companion to your CalmCarry device. Inside you'll find 60 sounds with a layerable mixer and a sleep timer that fires even when your phone is locked, four paced breathing exercises, two guided sessions, four multi-week wind-down programs, a one-tap rescue for hard nights, and a parent-gated Kids Mode.

Register your device under "My CalmCarry" to confirm it's genuine and keep your warranty close.

We made this to help busy minds find a little more quiet. Rest it in your palm, follow along, and let yourself settle.

## Promo Taglines
1. Calm, in the palm of your hand.
2. For minds that won't switch off.
3. Hold it. Breathe. Let the day go.
4. A gentle hand to hold at bedtime.
5. When thoughts race, find your quiet.

---

## What was removed and why

Each of these was in the previous listing and is **not true of the app**. Shipping
them risks rejection under App Store 2.3.1 (accurate metadata), and one is a
regulatory problem in its own right.

| Removed claim | Why |
|---|---|
| "**Sleep tales** - slow, gentle stories for grown-ups" | There are **zero** story tracks. The same claim was removed from the in-app paywall for the same reason. |
| "**offline downloads**" (sold as a Premium benefit) | The download feature was deliberately removed - audio is bundled, so there is nothing to download. Selling a feature that does not exist is the clearest possible 2.3.1 reject. |
| "**Short watch-and-learn clips**" and "video" | These are text articles. `videoUrl` is optional and no real footage ships. |
| "**we'll remind you before any renewal**" | The app cannot guarantee it - a local notification is best-effort. It was removed from the app as a **ROSCA** risk and must not survive in the listing. |
| "**there's no free trial**" | Wrong, and backwards: the annual plan **does** open with a 3-day trial (`TRIAL_DAYS = 3`). A listing that contradicts the paywall is a guaranteed rejection. |
| "the daily **mood check-in**" | Retrospective mood tracking was cut. The check-in is forward-looking ("what would feel good right now?") and stores no mood history. |
| "a **four-sound** mixer" | The mixer is built from every loopable track, not four. |
| "**No tracking**" (unqualified) | True of advertising and cross-app tracking, but hosting and error-reporting providers do process data. The in-app privacy screen was corrected to say both halves; this should match it. |
| "a quiet, anonymous **community** (adults only)" | The community wall is **off in v1** (`COMMUNITY_ENABLED` in `src/lib/flags.ts`), because Apple's guideline 1.2 requires the ability to block abusive users and CalmCarry has no block feature. Advertising a feature the binary does not ship is a 2.3.1 reject, and it would also contradict the User Generated Content answer of **NO** in `APP_STORE_QUESTIONNAIRES.md`. Restore this line only in the release that turns the wall back on. |

**Rule for whoever edits this next:** every feature sentence here maps to something
in `src/content/library.ts` or a shipped screen. If you add a line, add the feature
first.
