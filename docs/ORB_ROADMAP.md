# CalmCarry positioning + orb hardware roadmap (memo for Glowco)

From the 2026-07 pre-mortem. The app-side fixes shipped; these are the calls only
Glowco can make. Blunt on purpose.

## Positioning: the companion, not the competitor

Calm and Headspace win on content breadth and brand. CalmCarry cannot out-catalog
them and should stop trying: every bundled track added narrows the gap by zero and
bloats the binary. The defensible position is the one Calm cannot copy: **a physical
ritual anchor with an app that gets out of the way.**

- Sell the orb as the product; the app is its nervous system. Marketing language:
  "hold something, hear something, breathe" — never "10,000 sounds".
- The app's single health metric is **time_to_first_audio** (now instrumented).
  Every release should hold or lower it. If a feature adds a screen between unlock
  and audio, it loses.
- Content strategy: keep the honest in-house catalog as the free spine; licensed
  breadth arrives only via the already-built CDN/streaming path (off until keys),
  never as more bundled files.

## Hardware roadmap (the real fix for "the orb earns no credit")

Today the orb is standalone and the app never talks to it. Copy-only pairing shipped
(orb-aware ritual lines, gated on registration). The next levers are hardware:

1. **v1.5 — device-side session start.** A press on the orb IS the ritual start.
   The app becomes optional at bedtime: the person who wants zero screens gets zero
   screens, and the app becomes the daytime companion (library, family, warranty).
   This single change dissolves the app-device friction paradox.
2. **v2 — BLE presence, minimal scope.** Not data sync: just "a session happened"
   (timestamp + duration) so calm nights count without the phone. Resist telemetry;
   the brand promise is no tracking in the bedroom.
3. **Intensity child-lock in hardware.** The app's kids mode is COPPA-clean, but the
   microcurrent level is set ON the device. What stops a child from turning it up is
   a hardware/legal question the app cannot answer. Needs a physical or firmware
   answer plus counsel's sign-off before kids-facing marketing leans on the orb.
   Note: shop copy currently says "one for every bedside… or each child", and kids
   sessions in device-registered households show orb-hold cues. If counsel wants
   distance between children and the microcurrent claim set, both are one-line
   copy changes — say the word.
4. **Packaging → ritual.** The QR in the box should deep-link to registration + the
   first wind-down, not a marketing page. First-night activation is the whole game.

## What the app will NOT do (agreed discipline)

- No fake "connected" language while no data link exists (purged, keep it purged).
- No efficacy claims for the microcurrent; the bounded "What is doing the work?"
  article is the ceiling of the claim set.
- No timed upsells, no streaks that can break, no loud notifications. The pre-mortem
  verdict stands: in this category, the quietest app wins.
