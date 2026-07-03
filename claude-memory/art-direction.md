---
name: art-direction
description: CalmCarry visual direction for the de-slop — hybrid light/dark + Higgsfield cover imagery
metadata: 
  node_type: memory
  type: project
  originSessionId: 94c5e2eb-7b65-4f93-821a-de8a870389ef
---

Art direction (decided 2026-06-27, after Mason approved the front-end structure): **hybrid — light by day, premium dark for sleep**, raising both to BetterSleep-grade craft.

**Cover imagery = soft hand-painted WATERCOLOUR illustration** (the user rejected dark cinematic photography — "what the fuck is that" — and supplied a watercolour reference). Generated via the `eb8a5a8a` creative MCP using **`recraft-v4-1`, model_type `standard`**, 1:1, with the brand palette in the `colors` param `["#8FC9BE","#426768","#9DB7B1","#D3EDEA","#E7C9B8"]` (eucalyptus/teal/sage + soft peach). Light, airy, paper texture, loose washes, cohesive fine-art landscapes per track. NOT photographic, NOT dark. Pipeline: generate → download rawUrl PNG → `cwebp -q 84 -resize 1024 1024` → `assets/covers/<name>.webp` (same filenames, no code change). Concurrency cap is 8 jobs on the ultra plan — batch in waves of ≤8.

**Why:** The definitive build-plan PDF specs a LIGHT eucalyptus brand (mint #D3EDEA, teal, charcoal text), but the user wants enterprise polish like BetterSleep (dark, cinematic). Hybrid reconciles both — and the app already half-implements it (`<Screen mode="night">` paints a deep-gradient base + reduced-motion ambient blobs/motes; daytime stays eucalyptus).

**How to apply:** Keep the eucalyptus brand palette — do NOT swap to generic indigo; elevate craft (depth, glass, ambient motion, premium imagery), not the palette. The night/sleep surfaces and the `GlowOrb` are already well-crafted; the real visible "AI slop" is the cover art. Tools: the `ui-ux-pro-max` skill (RN design DB — run `~/.claude/skills/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "<q>" --stack react-native`), the `emil-design-eng` skill (polish philosophy), and the Higgsfield MCP (imagery — needs interactive OAuth each session). The 21st-dev/`magic` MCP is web/React-only — not usable for this React-Native app's codegen. See [[login-system]].
