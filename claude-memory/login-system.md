---
name: login-system
description: CalmCarry auth is fully wired with placeholder keys — Apple / Google / email
metadata: 
  node_type: memory
  type: project
  originSessionId: 94c5e2eb-7b65-4f93-821a-de8a870389ef
---

The login system is fully set up with placeholder keys (real values dropped in later; store/COPPA creds come from Glowco). **Apple** (`expo-apple-authentication`, native iOS, config plugin registered in `app.json` as of 2026-06-27), **Google** (`expo-auth-session` id_token flow; the button is gated until `EXPO_PUBLIC_GOOGLE_*` client ids are real, so there's never a dead button), and **email/password** — all verified server-side via `jose` JWKS (`server/src/integrations/social-auth.service.ts`), which fails closed if client ids are unset. Placeholders: `EXPO_PUBLIC_GOOGLE_WEB/IOS/ANDROID_CLIENT_ID` (client) + `APPLE_SIGNIN_CLIENT_ID` / `GOOGLE_SIGNIN_CLIENT_ID` (server). Get-keys steps are in `KEYS_SETUP.md`. Don't rebuild this — it exists. See [[art-direction]].
