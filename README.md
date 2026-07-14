# CalmCarry

The companion mobile app for **The Glow Company** (Glowco · [theglowcompany.co](https://www.theglowcompany.co)) - a natural sleep/wellness brand. Built by **Task Force AI Dev. Services L.L.C.**

> Design direction: **"Eucalyptus calm"** - a hybrid that is light and on-brand by day (onboarding, auth, registration, authenticity, library, account) and a brand-derived **deep-eucalyptus night mode** for the wind-down / player / sleep screens. The palette is locked to The Glow Company's live brand tokens. See [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) and [`V1_SCOPE.md`](./V1_SCOPE.md) - both are authoritative and locked.

## Stack

- **Expo** (SDK 56) · React Native 0.85 · React 19 · React Compiler · New Architecture
- **expo-router** (file-based routing)
- **NativeWind v4** (Tailwind for RN) for utility styling - color tokens mirror `src/theme/colors.ts`
- **Reanimated v4** (+ react-native-worklets) and **Moti** for motion, all on the UI thread
- **expo-blur · expo-haptics · expo-linear-gradient**
- Fonts: **Montserrat** (The Glow Company's brand font) for UI, **Fraunces** as the display serif (stand-in for their licensed Silk Serif), via `@expo-google-fonts`

## Run it

```bash
npm install

npx expo start          # dev menu - press i / a / w, or scan the QR with Expo Go
npx expo start --web     # browser (used for visual verification in this env)
npx expo start --ios     # requires full Xcode + an iOS simulator
npx expo start --android # requires Android SDK + an emulator/device
```

> **Note:** the dev machine used to build the milestone-2 scaffold had only Xcode Command Line Tools (no simulators) and no Android SDK, so screens were verified on **Expo web** and are **Expo Go-ready** for real-device testing. Install full Xcode (App Store) for an iOS simulator.

```bash
npx tsc --noEmit         # typecheck (clean)
```

## Architecture (feature-modular, DESIGN_SYSTEM §8)

```
src/
  app/                     # expo-router routes (thin)
    _layout.tsx            # root: font loading, providers, Stack
    (tabs)/                # 4-tab shell with the custom BlurView TabBar
      index.tsx            # → Tonight
      sounds.tsx · device.tsx · you.tsx   # empty-state placeholders
    wind-down.tsx          # night-mode wind-down player (the "Begin wind-down" target)
  theme/                   # canonical design tokens
    colors.ts              # brand + light + night token sets (the single source of truth)
    typography.ts          # Montserrat/Fraunces scale + font map
    motion.ts              # §4 easing / spring / durations
    ThemeContext.tsx       # per-screen <ThemeProvider mode="light|night">
  components/              # §6 primitives - each renders in BOTH themes
    AppText · Screen · GlowOrb · PrimaryButton · CoverCard
    StatusChip · SectionHeader · TabBar
  features/
    tonight/TonightScreen.tsx
    shared/Placeholder.tsx
```

**Theming is per-screen, not OS-driven** - light by default, `mode="night"` for sleep screens. Each `<Screen>` sets the theme and paints the atmospheric background (mint wash on light; eucalyptus gradient + drifting sage blobs on night).

## Status

Milestone 2 (design system + key screens): **GlowOrb, PrimaryButton, CoverCard, StatusChip, TabBar, SectionHeader, Screen, AppText** primitives built with §4 motion; **Tonight** (light) and **Wind-down** (night) screens shipped and verified. Next: device/registration + authenticity flows, the sound library, auth + Shopify entitlement, and the NestJS backend (see `V1_SCOPE.md`).
