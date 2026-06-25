# CalmCarry — Design System (locked to The Glow Company brand)

**Direction:** "Eucalyptus calm" — The Glow Company's light, natural, mint-and-sage world by day; a brand-derived deep-eucalyptus **night mode** for the wind-down/sleep screens where a dark screen at bedtime is the correct choice. Companion to a physical sleep/wellness product you own.

> **Brand source:** [theglowcompany.co](https://www.theglowcompany.co) (Glowco = The Glow Company, a natural sleep/wellness brand). All color comes from their live brand tokens — we do NOT invent a palette.

Cross-validated by the resources Mason/Nidhal provided:
- **ui-ux-pro-max** — "Sleep Tracker" structure + the Expo "Cinema Mobile" RN recipe.
- **emil-design-eng** — animation/polish framework.
- **mobile-app-ui-design** — the anti-AI-slop charter (§7).
- **BetterSleep** = the *vibe* reference (premium calm), NOT the brand. We take its feel, your brand's color.

Stack: **Expo (React Native) + NativeWind + Reanimated + Moti + expo-blur + expo-haptics + @expo-google-fonts**.

---

## 1. Color tokens — from The Glow Company brand

Hybrid: a LIGHT brand theme (default, daytime/utility) and a brand-derived NIGHT theme (sleep screens). Both use the same sage/teal brand spine, so it reads as one product.

```ts
// theme/colors.ts
export const brand = {
  teal:      '#426768', // PRIMARY — deep eucalyptus (emphasis, primary text on light)
  tealDeep:  '#365B59', // pressed/active teal
  sage:      '#74A5A2', // ACCENT — their button/link color; CTAs, active states
  sageHover: '#466D6A', // sage pressed
  mint:      '#D3EDEA', // brand mint — hero washes, accent panels
  mintSoft:  '#E7F3F0', // lighter mint tint
  cream:     '#F2F1EB', // warm neutral background
  slate:     '#485453', // brand text (slate-green)
  white:     '#FFFFFF',
  coral:     '#EF626C', // their sale/alert color — sparing pops ONLY (claims, alerts)
};

export const light = {                 // DEFAULT theme (shop, auth, registration, authenticity, library, account)
  bg:        '#F4F3ED',                // cream-white app base
  wash:      '#E7F3F0',                // soft mint wash (hero tops, section bands)
  surface:   '#FFFFFF',                // cards
  title:     '#2E3F3E',                // headings (deep slate-teal)
  text:      '#485453',                // body
  muted:     'rgba(72,84,83,0.55)',    // secondary
  dim:       'rgba(72,84,83,0.38)',    // hints/disabled
  line:      'rgba(72,84,83,0.12)',    // hairline
  lineSage:  'rgba(116,165,162,0.35)', // accent edges
  ctaBg:     '#74A5A2', ctaText: '#FFFFFF', // primary button = brand sage
  shadow:    '0 8px 22px rgba(66,103,104,0.10)', // tinted to teal, never gray
};

export const night = {                 // sleep screens (wind-down timer, full player, "good night")
  deep:      '#0E1817',                // lowest surface / scrim / good-night floor (never pure #000)
  base:      '#15231F',                // screen base (use LinearGradient #16 2422→#0E1817)
  elevated:  '#1E302D',                // cards
  surface:   'rgba(255,255,255,0.05)',
  line:      'rgba(255,255,255,0.08)',
  lineSage:  'rgba(143,201,190,0.30)',
  title:     '#EAF2EF', text: '#9DB7B1', dim: '#5E7470',
  glow:      '#8FC9BE',                // luminous sage — the orb glow + progress ring on dark
  ctaBg:     '#7FB8AD', ctaText: '#15302B',
};
```

> Their live tokens we matched: `--color-primary #426768`, `--color-accent #75a5a2`, `--color-background #d3edea`, `--color-background-footer #f2f1eb`, `--color-text #485453`, `--color-background-button #74a5a2` / hover `#466d6a`, sale `#ef626c`.

## 2. Typography — matched to The Glow Company

```ts
sans:  'Montserrat'  // @expo-google-fonts/montserrat — THEIR brand font. Site body, headings & buttons
                     // all resolve to Montserrat. Workhorse: all UI, body, labels, buttons, most headings.
serif: 'Fraunces'    // @expo-google-fonts/fraunces — editorial-display accent for hero titles / track names,
                     // the free stand-in for their licensed display serif "Silk Serif". Used sparingly.
```
Scale (sp): Display 30 serif (hero only) · H1 24/600 Montserrat · H2 20/600 · Body 16/400 Montserrat (lineHeight 1.6) · Label 13/500 · Caption 11–12/600 uppercase 0.12em kickers. **Montserrat dominates** (matches their site); the serif is the accent.

> Verified live from theglowcompany.co: body, headings, and buttons all compute to **Montserrat**; their `@font-face` set also loads **Silk Serif** (premium licensed display serif) + Poppins/HarmoniaSans. We match **Montserrat exactly** (free on Google Fonts) and use **Fraunces** for the Silk-Serif display role. If they want 1:1 on the hero titles, license Silk Serif for those; everything else is already brand-exact. Cross-checked against ui-ux-pro-max ("Wellness Calm" Lora+Raleway / "Soft Rounded" Nunito) — Montserrat is the right call because it's literally their brand font, not a lookalike.

## 3. The RN technical recipe ("Cinema Mobile", Expo 10/10)

- **Light screens:** cream `bg` with a `LinearGradient` mint `wash` at the top third; white cards with `light.shadow` (tinted teal) + hairline.
- **Night screens:** `LinearGradient` `#16 2422 → #0E1817`; 2–3 absolutely-positioned blurred sage "blob" Views (`blurRadius 30–50`, `opacity 0.08–0.12`), slow Reanimated `translateX/Y` oscillation over 18–24s.
- **Both:** `borderRadius 16` (orbs/players to 20), hairline borders, `expo-blur` `BlurView intensity={20}` on tab bar/headers (tint light or dark per theme), accent glow behind the orb + primary button.

## 4. Motion spec (Emil × Cinema-Mobile × RN-stack — all agree)

```ts
export const ease = { out: Easing.bezier(0.16,1,0.30,1), inOut: Easing.bezier(0.77,0,0.175,1) };
export const spring = { damping: 20, stiffness: 90 };
export const dur = { press: 140, sheet: 240, modal: 320, breath: 4000 };
```
- Animate **transform + opacity only**; **run on the UI thread** (Reanimated worklets) — no JS-thread animation. **[HIGH]**
- Press feedback: `scale 0.97` + `expo-haptics` Impact Light, ease-out `dur.press`, no ripple.
- Never animate from `scale(0)` — start `scale 0.95` + `opacity 0`.
- Sheets enter from `translateY(100%)`; modals keep center origin. UI animations < 300ms; exit faster than enter.
- Stagger list/section entrances 40–60ms. Tab switches: color/opacity only, no position animation.
- Blur to mask crossfades. Wrap loops in `useReducedMotion()`.

### Signature animations
| Element | Spec |
| --- | --- |
| **GlowOrb breathing** | scale 1.0→1.06 + glow opacity 0.85→1.0, `withRepeat(withTiming(_, {duration:4000, easing:Easing.inOut(Easing.sin)}), -1, true)`. Sage glow (night) / soft mint sphere (light). Static under reduced-motion. |
| **MiniPlayer → FullPlayer** | shared-element expand via `spring`; blur-mask the crossfade; visible down-chevron close. |
| **Wind-down dim arc** | the one long animation that's correct: night overlay opacity 0→0.4 via long `withTiming`; controls fade to just pause; ends on the `night.deep` "good night" floor. |
| **Authenticity check** | sage check draws on (stroke + scale) after a ~2s breathing "checking" state — a crafted trust moment. |

## 5. Build rules (from the RN stack DB)
- **Lists:** `FlashList`/`FlatList` with a `React.memo`'d `renderItem` — never inline. **[HIGH]**
- Lazy-load below-fold content/images (WebP); code-split by route.
- Onboarding always has Skip + Back; never a forced linear tour.

## 6. Component primitives (milestone 2)
`GlowOrb` (sage; device avatar / player art / timer center / auth burst) · `CoverCard` · `StatusChip` (sage shield-check / sparkle) · `CalmMixer` (4–6 tiles, capped) · `PrimaryButton` (sage, scale-0.97, haptic) · `MiniPlayer`+`FullPlayer` · `TabBar` (BlurView, 4 tabs: Tonight / Sounds / Device / You) · `WindDownTimer` ring · `FormField` (sage focus ring) · `SectionHeader`. Each renders correctly in BOTH light and night themes via the theme tokens.

Reference mockup: `~/Downloads/CalmCarry_Mockup.png` (source `/tmp/calmcarry_mockup.html`) — 2 light brand screens + 1 night-mode sleep screen.

---

## 7. The "doesn't look AI-generated" charter (non-negotiable)

From `ceorkm/mobile-app-ui-design` + hard anti-slop rules. **Every screen is audited against this before it ships.**

| The AI-slop tell | What we do instead |
| --- | --- |
| Default purple/violet gradient + glass on everything | Brand mint/sage/cream; gradients are atmospheric background only, never on every card |
| Everything centered & symmetric | Content screens LEFT-aligned, F-pattern; centering only for focus/ritual (auth, timer, player) |
| Every element same visual weight | One "notice-first" element per screen; hierarchy via size + weight + opacity (100/80/60) |
| Random spacing | Strict 8-pt grid (4/8/12/16/24/32/48/64); 2× gap between groups vs within |
| Flat gradient rectangles as imagery | Real cover art / layered tonal motifs; avatars > initials > generic icons; one curated style |
| Emoji + mixed icon styles | One outline icon family, no emoji |
| `rounded-3xl` + heavy gray shadows | radius 16; shadows tinted to the bg (teal), never pure black/gray |
| Rainbow of accents | 60/30/10 — 60% cream/mint base, 30% slate text, 10% sage/teal accent; coral only for meaningful pops |
| Happy-path only | Every screen ships empty / loading / error / success states |
| Generic copy | Specific, branded copy ("Slow tide · 20 min") |
| Pristine machine surfaces | ≤4% film grain so it reads hand-finished |

**Type discipline:** two families, one job each; deliberate scale; max two weights per family. 44×44pt min tap targets. **Peak-End:** craft the peak (authenticity confirm, milestone) and the end (wind-down "good night").

## 8. Architecture discipline (from `dpconde/claude-android-skill`)
That skill is native Android (Kotlin/Compose/Gradle) — NOT used for CalmCarry's Expo/RN code. We carry over its *structure*: feature-based modularization (`features/tonight`, `features/device`, `features/library`), state/UI separation, testing from day one.
