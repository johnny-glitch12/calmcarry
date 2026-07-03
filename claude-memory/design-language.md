---
name: design-language
description: "How to apply reference/competitor UI to CalmCarry — adopt the look, keep the audit substance; the established chrome (pill nav, text logo, feed community, calm motion)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 94c5e2eb-7b65-4f93-821a-de8a870389ef
---

When the user shares a reference/competitor screen ("make it look like this"), adopt the **visual form** but keep CalmCarry's **audit substance**. They explicitly said "keep our own design spin" + "remember our audit always."

**Why:** the brand's whole differentiator is honest, calm, privacy-first. Copying a competitor's tracking/social-pressure mechanics would betray that even if it looks polished.

**How to apply:**
- **Community is an anonymous wins FEED, never a real social network.** Take the feed look (cards, filter chips, avatars) but NOT: real names, human-face avatars (use a `moon` glyph), followers/following, visible like/acknowledgment **counts**, reply/comment/DM/chat, or "Following/Popular/Trending" sorts. The count-less one-way "Carried this with you" tap and the "Latest / With a mix" filter are the audit-safe stand-ins. Kids never see Community; kids are never tracked.
- **Established chrome (don't rebuild, extend):** floating **pill tab bar** (active = solid brand-**sage** `#74A5A2` pill with icon+label inline + dark-eucalyptus content for WCAG AA; inactive = muted icons; crossfade in place, never slide). **Logo** = theme-tinted TEXT lockup in [[art-direction]] colors (Montserrat-ExtraBold `calm` + ® over Poppins-SemiBold `CARRY`); PNG kept only for native splash/icon.
- **Motion bar (calm, not eye-tiring):** transform+opacity only on the UI thread; UI transitions <300ms; never from `scale(0)`; ALL loops wrapped in `useReducedMotion`; no sliding indicators; keep continuous/large-area motion low-amplitude (the GlowOrb `aura` is opt-in + gentle, dropped from the wind-down hero). See `src/theme/motion.ts`.
- White-on-sage fails AA (2.75:1) — use dark eucalyptus text on sage, or deep teal for white text. Related: [[launch-readiness]].
