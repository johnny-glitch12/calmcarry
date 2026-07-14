# Premium content protection - the path to 10/10

## Where we are (honest)

- **Server enforcement: 10/10.** Premium cannot be granted without a real, validated,
  SKU-allowlisted purchase. Receipt validation is fail-closed and not keyed off
  `NODE_ENV`; sandbox receipts are rejected in prod; no dev-grant / seeded-account /
  unlimited-sharing paths remain. The signed-URL endpoint (`content.service.signedUrl`)
  already 403s a non-premium (expiry-aware) account for any `locked` track.
- **Client enforcement: hardened.** The paywall is gated on entitlement only (kids mode
  no longer exempts it), a planted `'local'` token can't restore premium in a store
  build, and a cached `calm_plan` self-expires at `expiresAt` even offline.
- **The remaining gap is physical, not a code bug.** v1 ships **every premium track's
  audio bundled, unencrypted, in the app binary** (`src/content/audio.ts` `require()`s
  each locked track's `.mp3`). Anyone can `unzip` the IPA/APK and extract the paid
  catalogue, and a jailbroken/repackaged binary can flip `isPremium` locally. **No
  client-side code can close this** - the paid bytes are on the device.

The only true fix: **the paid bytes must never reach a non-paying device.** That means
server-gated streaming. The server half is already built; below is the rest.

## The migration (turn-key - server gate + client honor already in place)

1. **Provision a CDN** (Bunny.net / CloudFront) with **private** objects + token auth.
   Set `STREAMING_ENABLED=true`, `CDN_BASE_URL`, `CDN_SIGNING_KEY` (Fly secrets).
   Confirm `server/src/integrations/cdn.service.ts`'s signing scheme matches the provider.
2. **Upload the locked tracks' audio to the private bucket.** Keep FREE tracks and a
   short (~30–60s) **preview clip** per locked track bundled/public - the preview must
   NOT be the full track.
3. **Remove the full locked `.mp3`s from the binary** - drop them from `assets/audio/`
   and their entries in `src/content/audio.ts`. Free tracks + preview clips stay. After
   this, the paid bytes are simply not on the device.
4. **Route ALL playback through `resolveAudioSource`.** Today only `Player` does; wire
   `src/app/wind-down.tsx` and the `ListenScreen` mixer too (the mixer needs one signed
   URL per layered sound).
5. **Harden `resolveAudioSource` (`src/lib/audioSource.ts`):** for a `locked` track, a
   `403`/unusable signed URL is a HARD STOP (route to `/unlock`), NEVER a bundled
   fallback. Previews play the dedicated preview clip, not the full track. (This change
   is deliberately NOT made yet - it is entangled with the preview-clip work above and
   would break the current bundled preview if applied alone.)
6. **Offline playback (the real work item).** A sleep app is used all night, often
   offline - streaming-only would break that for paying users. Add a
   **download-for-offline cache** (`expo-file-system`): on first premium play, fetch the
   signed URL once and cache the file locally, keyed to the premium account; serve from
   cache offline. Clear it on sign-out / entitlement loss.
7. **Verify:** free user + locked track → paywall, no audio, no extractable file on
   disk; premium user → streams, then plays offline from the cache.

## Defense-in-depth (optional, lower priority than the above)

- **TLS certificate pinning** (`expo-build-properties`: iOS `NSPinnedDomains`, Android
  `networkSecurityConfig`) so a user-trusted-CA MITM can't rewrite the `/me` entitlement.
- **Server-signed entitlement claim** (RS256/ES256; client verifies with the shipped
  PUBLIC key) so a tampered cache or MITM response can't forge premium. With streaming
  on this is mostly moot - the client entitlement only decides which lock badges to
  show; the server gates the actual bytes.
- **Move the entitlement cache to SecureStore** (native Keychain/Keystore) so a raw
  storage edit on a jailbroken device fails.

## The honest ceiling

Even with streaming, a **paying** subscriber can screen/audio-record their own stream -
no consumer DRM stops a legitimate user re-capturing content they can play. The goal is
to stop **non-payers** from getting the catalogue for free, and steps 1–7 achieve that:
the bytes never touch a device that hasn't paid.
