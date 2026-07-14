# Device QA checklist - pre-submission smoke test

Everything below is **built, type-checked, and web-verified** but needs one pass on real
hardware (iPhone + one Android) before store submission. Web preview cannot exercise
native font metrics, notifications, background audio, StoreKit, or RN's Switch/pointer
responders. Ordered by risk. Check each box on both platforms unless noted.

## 1. Kids mode entry (rebuilt - highest priority)
The pre-seeded "Leo" is gone; first entry now creates the kid profile through consent.
- [ ] Fresh install → Family → Kids mode toggle → parental-consent card appears inline
      (name/type inputs hidden), "I'm the parent…" → parent-PIN create screen → PIN set
      → lands in Kids home with a "Little one" profile created.
- [ ] Account screen → Mode → Kids with no consent on file routes to Family (the consent
      surface), not a silent no-op.
- [ ] Cancel on the consent card (entry flow) closes the whole panel; in the add-profile
      flow it returns to the form.
- [ ] Exit kids via PIN still works; removing the kid profile works; re-entry re-uses the
      existing consent (no second card).
- [ ] A kid in a FREE household sees NO locked tiles: Sounds rails and Listen mixer show
      only playable content (new filters).

## 2. Night Door + time-to-first-audio
- [ ] Cold start between 20:00 and 05:00 lands on the Night Door; one tap → wind-down
      audio playing. Time the unlock→audio path with a stopwatch: target < 6s.
- [ ] "Not now" lands on the full Home. Back gesture behaves.
- [ ] Cold start via a notification/deep link (e.g. player route) does NOT show the
      Night Door; navigating Home later does not surface it mid-session.
- [ ] Kids profile active at night: straight to Kids home, no Night Door.
- [ ] Daytime cold start: no Night Door, brand splash as usual.
- [ ] Android warm start (app killed vs backgrounded): Night Door appears once per cold
      start only (module-eval semantics; verify a backgrounded resume doesn't re-show it).

## 3. Notifications (all changed - must hear silence)
- [ ] Bedtime reminder fires at the chosen time with NO sound, listed quietly
      (iOS: Notification Center, passive; Android: silent banner in the shade,
      channel "Gentle reminders").
- [ ] UPGRADED dev installs: notifications scheduled before this build sit on the OLD
      loud channel until the toggle is flipped off/on once. Re-toggle and confirm silent.
- [ ] Start an annual purchase (sandbox): NO OS permission dialog appears mid-checkout.
      With notifications never granted, iOS still delivers the trial reminder quietly
      (provisional); Android simply skips it.
- [ ] Buy near midnight (sandbox): trial reminder is scheduled for a civil hour (~18:00),
      not the small hours (check the pending notification in settings/adb).
- [ ] Kids mode: no reminder/recap toggles visible in Account.

## 4. Orb-aware ritual copy
- [ ] With NO device registered: wind-down says "Wind down" (never "Hold your orb");
      Player rotates breath cues only; Home hero says "settle in somewhere soft".
- [ ] Register a device (serial), same night: wind-down says "Hold your orb. Wind down";
      Player rotates the orb cues; hero says "rest it in your palm".
- [ ] Sign out: orb copy reverts to the no-device wording.
- [ ] Wind-down orb breathes visibly asymmetric (4s in / 6s out) and matches the Player's
      breath ring rhythm; pause stops it, resume restarts with the arrival bloom.

## 5. Layout under Dynamic Type (collision batch)
Set iOS Text Size to maximum (and Android font scale 1.3+), then:
- [ ] Player: centerpiece scrolls rather than overlapping the top bar/controls.
- [ ] Parent gate: keypad scrolls on small screens (iPhone SE class), never clips.
- [ ] Home status chips, Listen tiles, claim-issue chips grow instead of truncating into
      neighbors; paywall price row never overlaps the note.
- [ ] Onboarding sounds step fits an iPhone SE without cut-off.

## 6. Audio lifecycle (regressions to re-confirm)
- [ ] Wind-down plays all night in background with the phone locked (Android: survives
      past 3 minutes; lock-screen Now Playing controls work).
- [ ] Session end at 20:00 fades to silence and lands on the check-in.
- [ ] Kids Listen tab: audio keeps playing when switching tabs (freezeOnBlur fix).
- [ ] Signed-in on airplane mode: track starts from the bundled asset in ~≤2.5s.

## 7. Monetization surfaces
- [ ] Home shows NO Calm Plan card ever (deleted); paywall appears only from locked-
      content taps and shows the tapped track's name in the subtitle.
- [ ] Annual disclosure shows a concrete date ("from <date>"); "Manage subscription"
      opens the store's subscription settings.
- [ ] Sandbox IAP end-to-end: purchase → server validation → premium unlocks; restore
      purchases works on a second device.

## 8. Events (needs the API reachable)
- [ ] `time_to_first_audio` and `session_start` arrive server-side for an adult profile;
      NOTHING arrives while a kid profile is active.

Known not-yet-built (do not test): home-screen quick actions (native dep not added),
streaming/CDN path (branch `feat/streaming-content-protection`, off until CDN keys).
