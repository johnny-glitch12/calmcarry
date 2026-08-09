# Cover art: the working recipe

As of 2026-08 each distinct real-scene track has its own cover (37 generated in one
pass). The only covers still shared are intentional: breathing exercises, guide
entries, kids tracks, and colored-noise near-twins.

This is the validated prompt formula for generating more in the existing style.
Model: `nano_banana_pro`, `aspect_ratio: "1:1"`, ~2 credits each.

## The prompt

> FULL BLEED watercolour painting filling the entire square frame edge to edge. No
> border, no white margin, no paper edge, no frame. Painted on textured cold-press
> paper so grain shows through. Palette: muted sage and eucalyptus green, deep teal,
> misty off-white, sparing soft peach accents. Subject: **[SUBJECT]**. Layered
> translucent washes, granulation, gentle bleeding, **[MOOD]**, no people, no text.

**The FULL BLEED clause is load-bearing.** A first attempt said "torn-paper collage
edges" and produced a painting *of* a piece of paper - white deckled border on a grey
background - which does not match the existing covers at all. Say full bleed, and say
what you do not want (border, margin, paper edge, frame).

## Clusters that need their own art, worst first

| Cover | Tracks sharing it | Suggested new subjects |
|---|---|---|
| `whiteNoise` | 7 | desk fan, air conditioner, tumble dryer, winter wind, gentle shush |
| `rainfall` | 6 | rain on a window ✅, rain on a tent, rain far away, heavy rain ✅, piano in the rain |
| `forestStream` | 6 | green noise, rain in the forest, soft wind, wind in the leaves, forest at dusk |
| `shoreline` | 6 | rain over the sea, beach bonfire, sea from the dunes, morning shoreline, storm rolling in |
| `fireside` | 6 | rain by the fire, dying embers ✅, forest campfire, fireside hush, the cabin |
| `brownNoise` | 6 | soft fan, ceiling fan, night train ✅, night drive, deep brown noise |
| `boxBreathing` | 4 | cyclic sigh, extended exhale, 4-7-8 |
| `dawnWoods` | 4 | mountain wind, birds far off, morning keys |

~30 covers at 2 credits each is about **60 credits**, against a balance of 4,600.

## After generating

1. Convert to `.webp` (the existing covers are webp, ~200 KB each):
   `cwebp -q 82 in.png -o assets/covers/name.webp`
2. Add the key to `src/content/covers.ts`
3. Point the track at it in `src/content/library.ts`
4. Rebuild - covers are bundled, so they only appear in a new binary

Keep them square and around 1024x1024: they are displayed small, and the file size
matters more than resolution at that scale.
