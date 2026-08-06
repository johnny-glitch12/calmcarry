# App Store Connect questionnaires - answer sheet

**Written 2026-08-04 from the app's actual data inventory, not from intent.**
Every answer below is traceable to a database column or a code path, cited inline.
Apple treats a wrong answer here as a 5.1.1(v) violation, and it is one of the few
things they can check automatically against the binary.

Fill these in App Store Connect under **App Privacy** and **Age Rating**.

---

## PART 1 - App Privacy

### Do you or your third-party partners collect data from this app?
**YES.**

### Is any data used to track you? (as Apple defines "tracking")
**NO.** There is no advertising SDK, no attribution SDK, no IDFA access, and no data
is shared with data brokers or joined with third-party data for ad targeting.
`app.json` already declares `NSPrivacyTracking: false` with an empty
`NSPrivacyTrackingDomains`, and the binary ships a `PrivacyInfo.xcprivacy` saying the
same. **Do not** enable App Tracking Transparency.

---

### Data types to declare

#### 1. Contact Info → Email Address
- **Collected:** YES
- **Linked to the user:** YES
- **Used for tracking:** NO
- **Purpose:** App Functionality *(only)*
- *Source:* `owners.email` - account identity, sign-in, password reset and
  verification codes.

#### 2. Contact Info → Name
- **Collected:** YES · **Linked:** YES · **Tracking:** NO
- **Purpose:** App Functionality
- *Source:* `owners.name` - used to greet the user. Also the adult profile name.

#### 3. Identifiers → User ID
- **Collected:** YES · **Linked:** YES · **Tracking:** NO
- **Purpose:** App Functionality
- *Source:* `owners.id`, referenced by `session_logs.ownerId`, `devices.ownerId`,
  `community_posts.ownerId`, `push_tokens.ownerId`.

#### 4. Usage Data → Product Interaction
- **Collected:** YES · **Linked:** YES · **Tracking:** NO
- **Purpose:** App Functionality, **and** Analytics
- *Source:* TWO distinct paths, and the linked one governs the answer:
  - `session_logs` stores `ownerId` + `contentId` + `startedAt`, i.e. **which
    sessions an account played**. This is account-linked, so "Linked: YES".
  - `analytics_events` stores a random per-install `anonId` (never the account id),
    which on its own would be "Not Linked".
  - Declare **Linked**, because the stricter of the two is true.
- *Note:* the user can switch both off in Settings → "Share anonymous usage data",
  and kids-mode records neither.

#### 5. Purchases → Purchase History
- **Collected:** YES · **Linked:** YES · **Tracking:** NO
- **Purpose:** App Functionality
- *Source:* `entitlements` (tier, status, plan, expiry, store transaction ref).
  **No payment details ever reach us** - Apple handles the transaction.

#### 6. User Content → Other User Content
- **Collected:** ~~YES~~ → **NO for this release.**
- *Why it changed:* the community wall is OFF (`COMMUNITY_ENABLED` in
  `src/lib/flags.ts`), and every entry point that could publish - the tab, the route
  itself, and the Listen screen's mix-share button - is gated, enforced by
  `src/lib/__tests__/communityGate.test.ts`. The shipped binary cannot create a
  `community_posts` row, so declaring User Content would be inaccurate in the other
  direction.
- **Restore this to YES in the same release that turns the wall on**, along with the
  User Generated Content answer in Part 2 and the collection row in the privacy policy.

---

### Data types to explicitly NOT declare

| Do NOT declare | Why |
|---|---|
| **Diagnostics / Crash Data** | Crash reporting is a strict no-op. `monitoring.native.ts` only initialises Sentry when `EXPO_PUBLIC_SENTRY_DSN` is set; it is **empty in `.env.example` and absent from every `eas.json` build profile**, so no crash data leaves any shipped build. Declaring it would be inaccurate. **If a DSN is ever added, this answer must change in the same release.** |
| **Health & Fitness** | No sleep tracking, no scores, no HealthKit. |
| **Location** | Never requested. |
| **Audio Data** | No microphone permission and no recording. Audio is playback only. |
| **Contacts / Photos / Calendar** | Never requested. |
| **Sensitive Info** | None. |
| **Biometrics** | Face ID unlocks the parent gate **on the device**; the result never leaves the phone and no biometric data is received. |
| **Precise/Coarse Location, Advertising Data** | None. |

---

### Children's data
Kids Mode collects a first name **which is stored only on the device and never
transmitted** (`ProfileProvider` gates create/rename/delete on adult profiles only,
enforced by `src/lib/__tests__/kidsPrivacy.test.ts`). Because it is never received by
the operator, it is not declared as collected data.

> **[COUNSEL]** Confirm this treatment before submission. It follows the FTC's
> position that information which stays on the device is not "collected", but it is a
> judgement call and it is the load-bearing one for the whole children's position.

---

## PART 2 - Age Rating

Answer in App Store Connect → App Information → Age Rating → Edit.

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | **None** - the app carries a wellness disclaimer and makes no medical claims. Do **not** answer "Infrequent/Mild" here; that flag is for apps giving treatment information, which this deliberately does not. |
| Gambling | None |
| Contests | None |
| Unrestricted Web Access | **NO** - external links open in the system browser and go only to The Glow Company's own pages. |
| **User Generated Content** | **NO** - the community is off in v1. See the note below. |

### The User Generated Content answer matters
The community wall is **disabled for v1** via `COMMUNITY_ENABLED` in `src/lib/flags.ts`,
so there is no user-generated content in the shipped build and Apple's 1.2 obligations
do not apply. That decision was taken because of safeguard 3 below.

If the wall is ever switched on, answering YES obliges all four safeguards:

1. **A method to filter objectionable material** - `HOLD_PATTERNS` in
   `community.service.ts` holds a flagged post for review instead of publishing it. ✅
2. **A mechanism to report offensive content** - `POST /community/report`,
   identity-bound and rate-limited, with thresholds that pull a post from the feed. ✅
3. **The ability to block abusive users** - ❌ **NOT IMPLEMENTED.** There is no
   user-block feature. Posts are anonymous and there is no profile to block, which is
   the usual argument, but Apple has rejected on this before. **This is why v1 ships
   with the wall off.**
4. **A published way to contact you** - the support URL. ✅

> **⚠️ Turning the community on is not a one-line change.** Build user blocking first,
> then flip the flag, then change this answer to YES and re-check the age rating - in
> that order.

> **Gating is per-entry-point, not per-tab.** The flag originally hid only the
> Community tab, while a "Share this mix anonymously" button on the **Listen** screen
> still posted to the wall. The build was publishing user content it gave the user no
> way to see, which would have made a "NO" answer here inaccurate under 5.1.1(v).
> Both are gated now. Before answering NO on any future release, grep for
> `api.createPost` and confirm every caller sits behind `COMMUNITY_ENABLED`.

### Expected rating
**4+** as shipped (community off). **12+**, or a UGC-flagged 4+, if it is ever
switched on.

### Do NOT opt in to
- **Made for Kids** / **Designed for Families** - enrolling forces the full COPPA
  regime and blocks the external Glow Orb checkout link. Kids Mode is a
  parent-gated feature inside an adult app; the app is not child-directed.

---

## PART 3 - App Review notes (paste into "App Review Information")

> **Sign-in is not required to review this app.** Tap "Create account" on the sign-in
> screen to make one in seconds, or skip sign-in entirely - the library, breathing
> exercises, sleep timer and Kids Mode all work without an account.
>
> ⚠️ **Do NOT paste placeholder credentials into App Store Connect.** If you decide a
> demo account is worth providing anyway, create a real one against the live API first
> and put those exact credentials here. A demo login that does not work is a
> guaranteed Guideline 2.1 rejection, and it is a common way to fail review while
> believing you were being helpful.
>
> **The physical "Glow Orb" device is NOT required to review this app.** On the
> device-registration screen, tap "Continue" / "Not now" to skip it and reach the
> full app.
>
> **Kids Mode:** Profile → Mode → Kids. Leaving Kids Mode requires a parent PIN,
> which you set the first time you enter. Kids Mode records no analytics and makes no
> network requests.
>
> **Subscriptions:** the paywall appears after the first completed session, or via
> Profile → Subscription. Prices are $12.99/month and $69.99/year, with a 3-day free
> trial on the annual plan.
>
> **Wellness, not medical.** The app makes no medical claims and shows a disclaimer
> in the Learn and About sections. It is not enrolled in the Kids Category.

---

## Blocking before you can submit

- [ ] **Demo account** created on the live API, credentials pasted above
- [x] **Decision on the community wall** - OFF for v1, both entry points gated. Answer
      User Generated Content **NO** and expect a 4+ rating.
- [ ] **Privacy Policy URL** published and reachable - currently a draft in `docs/legal/`
- [ ] **Screenshots** - 6.7" iPhone required; none exist yet
- [ ] **Paid Apps agreement** Active (Account Holder) - or the subscriptions cannot sell
- [ ] **Subscription products** created with the exact ids `calmcarry.premium.monthly`
      and `calmcarry.premium.annual`, and the 3-day intro offer on the annual
