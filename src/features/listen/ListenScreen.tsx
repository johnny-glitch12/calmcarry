import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Appear, AppText, Card, Crossfade, Dimmable, PressableScale, Reveal, Screen, SectionHeader, SelectionOverlay } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { MIX_CATALOG, usePlayback, type MixSound } from '@/features/sounds/PlaybackProvider';
import { covers, type CoverKey } from '@/content/covers';
import { TRACKS, trackLoops } from '@/content/library';
import { api } from '@/lib/api';
import { COMMUNITY_ENABLED } from '@/lib/flags';
import { lightTap } from '@/lib/haptics';
import { takePendingMix } from '@/lib/mixShare';
import { dur, ease, spring, themes, useResponsive, useTheme } from '@/theme';

// The bottom "Music" rail = FINITE instrumental pieces that open the full Player
// (guided, with about text). Loopable music (spa, piano blends) lives in the mixer
// above, so this rail is derived to never duplicate it. gymnopedie is the free one.
const MUSIC_IDS = Object.keys(TRACKS).filter((id) => TRACKS[id].category === 'music' && !trackLoops(TRACKS[id]));

const TIMERS = [0, 15, 30, 60] as const;
const GRID_GAP = 14; // uniform gap between sound tiles (both axes, via flex `gap`)


// A single volume-level bar. The accent fill EASES in/out (opacity over a c.line
// base) whenever this level is lit or dimmed - dragging the fader or tapping a bar
// no longer hard-swaps the color (the PIN-dot class of jolt).
function LevelBar({ lit }: { lit: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? (lit ? 1 : 0) : withTiming(lit ? 1 : 0, { duration: dur.press, easing: ease.press });
  }, [lit, reduced, p]);
  const s = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={{ height: 12, borderRadius: 6, backgroundColor: c.line, overflow: 'hidden' }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.accent }, s]} />
    </View>
  );
}

function Tile({ label, cover, level, locked, width, onToggle, onLevel }: {
  label: string;
  cover: CoverKey;
  level: number;
  locked?: boolean;
  /** exact pixel width from the grid (uniform tiles → every row symmetrical) */
  width: number;
  onToggle: () => void;
  onLevel: (l: number) => void;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const on = level > 0;

  // locked → unlocked (after a purchase) eases rather than snapping the scrim.
  const l = useSharedValue(locked ? 1 : 0);
  useEffect(() => {
    l.value = reduced ? (locked ? 1 : 0) : withTiming(locked ? 1 : 0, { duration: dur.sheet, easing: ease.out });
  }, [locked, reduced, l]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: 0.54 + 0.18 * l.value }));

  // Fader drag: slide across the volume strip to set the level continuously
  // (taps on the individual bars still work - the pan only activates after a
  // deliberate horizontal pull, and vertical motion stays with the ScrollView).
  const stripW = useSharedValue(0);
  const lastLvl = useSharedValue(0);
  const tickLevel = (l: number) => {
    if (!on) return; // sound turned off mid-drag (stopAll / timer) - don't resurrect it
    lightTap(); // one light tick per step, like a physical detent
    onLevel(l);
  };
  const levelPan = Gesture.Pan()
    .enabled(on && !locked)
    .activeOffsetX([-6, 6])
    .failOffsetY([-16, 16]) // generous vertical window so the mixer's scroll always wins
    .onBegin(() => {
      lastLvl.value = 0;
    })
    .onUpdate((e) => {
      const w = stripW.value;
      if (w <= 0) return;
      const lvl = Math.min(3, Math.max(1, 1 + Math.floor((e.x / w) * 3)));
      if (lvl !== lastLvl.value) {
        lastLvl.value = lvl;
        runOnJS(tickLevel)(lvl);
      }
    });

  // Turning a sound ON should feel alive, not a hard flip: the accent ring fades
  // in, the badge pops + swaps plus→volume, the tile lifts, the bars brighten.
  // transform + opacity only (we overlay the accent ring rather than animate a
  // borderColor), reduced-motion-safe, one-shot (no eye-tiring loop).
  const a = useSharedValue(on ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    // ON gets the sheet-speed arrival; OFF is an exit and must be quicker (~2/3).
    a.value = reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: on ? dur.sheet : dur.exit, easing: ease.out });
    if (on && !reduced) {
      pop.value = withSequence(
        withTiming(1.18, { duration: dur.press, easing: ease.out }),
        withSpring(1, spring),
      );
    } else if (!on && !reduced) {
      // settle the badge back to rest on toggle OFF (interrupts a mid-flight pop)
      pop.value = withTiming(1, { duration: dur.press, easing: ease.out });
    }
  }, [on, reduced, a, pop]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: a.value }));
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * a.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: a.value }));
  const plusStyle = useAnimatedStyle(() => ({ opacity: 1 - a.value }));
  const volStyle = useAnimatedStyle(() => ({ opacity: a.value }));
  const barsStyle = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * a.value }));

  return (
    <View style={{ width }}>
      <PressableScale
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}${locked ? ', premium, locked' : on ? ', on' : ', off'}`}>
        <Animated.View
          style={[
            { minHeight: 116, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', ...c.shadow },
            liftStyle,
          ]}>
          <Image source={covers[cover]} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
          {/* locked tiles carry a heavier scrim so tired eyes read them as dimmed/paywalled
              before committing a tap - the darkening EASES when a purchase unlocks it */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgb(20,30,28)' }, scrimStyle]} />
          <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
            <View style={{ alignSelf: 'flex-end', width: 26, height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: locked ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              {/* accent fill fades in behind the icon when active (opacity-only) */}
              {!locked ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.accent }, fillStyle]} /> : null}
              <Animated.View style={badgeStyle}>
                <Crossfade
                  style={{ width: 14, height: 14 }}
                  active={!!locked}
                  front={<Feather name="lock" size={14} color="#FFFFFF" />}
                  back={
                    <View style={{ width: 14, height: 14 }}>
                      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, plusStyle]}>
                        <Feather name="plus" size={14} color="#FFFFFF" />
                      </Animated.View>
                      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, volStyle]}>
                        <Feather name="volume-2" size={14} color="#FFFFFF" />
                      </Animated.View>
                    </View>
                  }
                />
              </Animated.View>
            </View>
            <View>
              <AppText variant="cardTitle" style={{ color: '#FFFFFF' }} numberOfLines={2}>{label}</AppText>
              {locked ? (
                <Appear enter={dur.nav}>
                  <AppText variant="meta" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                    Premium
                  </AppText>
                </Appear>
              ) : null}
            </View>
          </View>
          {/* accent activation ring - fades in over the tile edge (avoids animating borderColor) */}
          {!locked ? (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { borderRadius: 16, borderWidth: 2, borderColor: c.accent }, ringStyle]}
            />
          ) : null}
        </Animated.View>
      </PressableScale>
      {/* per-sound volume - 3 levels: tap a bar OR slide across the strip like a
          fader (the drag ticks a light haptic at each step). Locked tiles show a
          matching spacer instead. */}
      {locked ? (
        <View style={{ height: 12, marginTop: 8 }} />
      ) : (
        <GestureDetector gesture={levelPan}>
          <Animated.View
            onLayout={(e) => {
              stripW.value = e.nativeEvent.layout.width;
            }}
            style={[{ flexDirection: 'row', gap: 6, marginTop: 8, height: 12 }, barsStyle]}>
            {[1, 2, 3].map((l) => (
              <PressableScale
                key={l}
                onPress={() => onLevel(l)}
                disabled={!on}
                hitSlop={{ top: 18, bottom: 18, left: 6, right: 6 }}
                style={{ flex: 1 }}
                accessibilityRole="button"
                accessibilityState={{ selected: on && level >= l, disabled: !on }}
                accessibilityLabel={`${label} volume, level ${l}`}>
                <LevelBar lit={on && level >= l} />
              </PressableScale>
            ))}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

export function ListenScreen() {
  const { c: ambientC } = useTheme();
  const router = useRouter();
  const { isPremium, token } = useAuth();
  const { mode } = useProfile();
  const kids = mode === 'kids';
  // kids mode forces "cozy dusk" (<Screen mode="kids">); read that palette DIRECTLY
  // - this body runs above its own Screen's provider, so an ambient useTheme() would
  // return the app's light/night appearance and mis-paint the content. Adult mode
  // keeps its ambient (night-forced) theme.
  const c = kids ? themes.kids : ambientC;
  // responsive sound grid: measure the grid width, fit exactly `gridCols` uniform
  // tiles with a fixed gap (2 phone / 3 tablet / 4 wide) - every row symmetrical
  const { gridColumns: gridCols } = useResponsive();
  const [gridW, setGridW] = useState(0);
  const [shareNote, setShareNote] = useState<string | null>(null);

  // The players, the sleep timer, saved mixes, and cross-tab persistence all live
  // in PlaybackProvider now, so a running mix survives leaving this tab. This screen
  // is just the mixer's face.
  const { levels, activeLayers, anyOn, toggle, setVolume, sleepMinutes, setSleepTimer, stopAll, mixes, saveMix, loadMix, applyExternalLevels } = usePlayback();

  // A shared community mix hands off in-memory and lands here on focus - apply it
  // once (the provider re-gates + clamps it). No pause-on-blur: the mix persists.
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingMix();
      if (pending) {
        applyExternalLevels(pending);
        lightTap();
      }
    }, [applyExternalLevels])
  );

  const onToggle = (s: MixSound) => {
    lightTap();
    // premium sounds open the Calm Plan for free adults (kids never see the paywall)
    if (s.premium && !isPremium) {
      router.push('/unlock' as Href);
      return;
    }
    toggle(s.id);
  };

  const onTimer = (mins: number) => {
    lightTap();
    setSleepTimer(mins);
  };

  const onSaveMix = () => {
    if (!anyOn) return;
    lightTap();
    saveMix();
  };
  const onLoadMix = (m: (typeof mixes)[number]) => {
    lightTap();
    loadMix(m);
  };

  // Share the CURRENT live mix to the community wall - anonymous, adults + signed-in
  // only (kids never post). The name is built from the active sound titles.
  const shareMix = async () => {
    if (!anyOn || kids || !token || token === 'local') return;
    lightTap();
    setShareNote(null);
    const name = activeLayers.slice(0, 3).map((id) => TRACKS[id]?.title ?? 'Sound').join(' · ') || 'A shared mix';
    const levelsOut: Record<string, number> = {};
    activeLayers.forEach((id) => (levelsOut[id] = levels[id]));
    try {
      await api.createPost(token, 'Shared a mix to drift to.', { name, levels: levelsOut });
      setShareNote('Shared anonymously to the community.');
    } catch {
      setShareNote('Couldn’t share that just now. Please try again.');
    }
  };

  const tileWidth = (gridW - (gridCols - 1) * GRID_GAP) / gridCols;
  const controlsIndex = 2 + MIX_CATALOG.length;

  return (
    <Screen mode={kids ? 'kids' : 'night'} scroll tabBarSpacing wide contentStyle={{ paddingHorizontal: 0 }}>
      <Reveal index={0} style={{ paddingHorizontal: 24 }}>
        <AppText variant="caption" tone="muted">
          Listen
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Sound machine
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
          Layer sounds, set their volume, and let them play all night.
        </AppText>
      </Reveal>

      {/* saved mixes - the fastest path back to last night's blend, so it sits first */}
      {mixes.length > 0 ? (
        <Reveal index={1} style={{ marginTop: 24 }}>
          <View style={{ paddingHorizontal: 24 }}>
            <SectionHeader kicker="Saved" title="Your mixes" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}>
            {mixes.map((m, i) => (
              <Appear key={i} enter={dur.sheet}>
                <PressableScale onPress={() => onLoadMix(m)} accessibilityRole="button" dimTo={0.95}>
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineSage, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="disc" size={15} color={c.textAccent} />
                    <AppText variant="cardTitle" tone="title" numberOfLines={1}>
                      {m.name}
                    </AppText>
                  </View>
                </PressableScale>
              </Appear>
            ))}
          </ScrollView>
        </Reveal>
      ) : null}

      {/* sound palette - the WHOLE loopable catalog, grouped by kind. UNIFORM tiles +
          fixed gap: tile width is computed from the measured grid width so N columns
          always fit exactly, and justify CENTER balances a partial last row. Kids
          never see a locked tile (premium ones are hidden, not paywalled). */}
      {MIX_CATALOG.map((group, gi) => {
        const sounds = group.sounds.filter((s) => !(kids && s.premium && !isPremium));
        if (sounds.length === 0) return null;
        return (
          <Reveal key={group.key} index={2 + gi} style={{ marginTop: 24, paddingHorizontal: 24 }}>
            <SectionHeader title={group.label} />
            <View
              onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GRID_GAP }}>
              {gridW > 0
                ? sounds.map((s) => (
                    <Tile
                      key={s.id}
                      label={s.label}
                      cover={s.cover}
                      level={levels[s.id] ?? 0}
                      locked={s.premium && !isPremium}
                      width={tileWidth}
                      onToggle={() => onToggle(s)}
                      onLevel={(l) => setVolume(s.id, l)}
                    />
                  ))
                : null}
            </View>
          </Reveal>
        );
      })}

      {/* master controls */}
      <Reveal index={controlsIndex} style={{ marginTop: 28, paddingHorizontal: 24 }}>
        {/* sleep timer - one direct tap to any duration, no blind cycle-and-read loop */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Feather name="moon" size={16} color={c.textAccent} />
          <AppText variant="cardTitle" tone="title">
            Sleep timer
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {TIMERS.map((m) => {
            const active = sleepMinutes === m;
            return (
              <PressableScale
                key={m}
                onPress={() => onTimer(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m === 0 ? 'Timer off' : `Sleep timer ${m} minutes`}
                style={{ flex: 1 }}
                scaleTo={0.98}
                dimTo={0.95}>
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
                  <SelectionOverlay active={active} style={{ borderRadius: 14, borderWidth: 1, borderColor: c.accent, backgroundColor: c.panelStrong }} />
                  <AppText variant="cardTitle" tone="title">
                    {m === 0 ? 'Off' : `${m}`}
                  </AppText>
                </View>
              </PressableScale>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <PressableScale
            onPress={onSaveMix}
            disabled={!anyOn}
            accessibilityRole="button"
            style={{ flex: 1 }}
            scaleTo={0.98}
            dimTo={0.95}>
            <Dimmable active={anyOn}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
                <Feather name="bookmark" size={16} color={c.textAccent} />
                <AppText variant="cardTitle" tone="title">
                  Save mix
                </AppText>
              </View>
            </Dimmable>
          </PressableScale>
        </View>

        {/* Stop all - THE in-bed action: a full-width chip, above share, so silencing
            everything reads before the lesser share/save affordances */}
        {anyOn ? (
          <Appear enter={dur.sheet}>
            <PressableScale
              onPress={stopAll}
              accessibilityRole="button"
              accessibilityLabel="Stop all sounds"
              scaleTo={0.98}
              dimTo={0.95}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
              <Feather name="square" size={16} color={c.textAccent} />
              <AppText variant="cardTitle" tone="title">
                Stop all
              </AppText>
            </PressableScale>
          </Appear>
        ) : null}

        {/* Gated on COMMUNITY_ENABLED like every other route into the wall. This
            button was missed when the community was switched off for v1: the tab was
            hidden but this still POSTED to the wall, so the app was publishing user
            content it gave the user no way to see - and contradicting the "no UGC in
            v1" answer the store questionnaire is built on. See src/lib/flags.ts. */}
        {COMMUNITY_ENABLED && anyOn && !kids && !!token && token !== 'local' ? (
          <Appear enter={dur.sheet}>
            <PressableScale
              onPress={shareMix}
              accessibilityRole="button"
              accessibilityLabel="Share this mix anonymously to the community"
              dimTo={0.9}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line }}>
              <Feather name="share-2" size={16} color={c.textAccent} />
              <AppText variant="cardTitle" tone="title">
                Share this mix anonymously
              </AppText>
            </PressableScale>
          </Appear>
        ) : null}
        {shareNote ? (
          <Appear enter={dur.nav}>
            <AppText variant="meta" tone="muted" style={{ textAlign: 'center', marginTop: 8 }} numberOfLines={2}>
              {shareNote}
            </AppText>
          </Appear>
        ) : null}
      </Reveal>

      {/* Music - finite, lyric-free instrumental pieces that open the full Player.
          Last, because the layerable sound palette above is the fastest path to
          something calming; a piece of music is a deliberate choice. */}
      {MUSIC_IDS.length > 0 ? (
      <Reveal index={controlsIndex + 1} style={{ marginTop: 28, paddingHorizontal: 24 }}>
        <SectionHeader kicker="Music" title="Lyric-free, to drift to" />
        <View style={{ gap: 12 }}>
          {MUSIC_IDS.map((id) => {
            const t = TRACKS[id];
            if (!t) return null;
            const locked = !!t.locked && !isPremium;
            return (
              <PressableScale
                key={id}
                onPress={() => router.push((locked ? `/unlock?id=${id}` : `/player?id=${id}`) as Href)}
                onPressIn={lightTap}
                accessibilityRole="button"
                accessibilityLabel={`Play ${t.title}`}
                scaleTo={0.98}
                dimTo={0.95}>
                <Card variant="surface" padding={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Image source={covers[t.cover]} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" accessibilityIgnoresInvertColors />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium" tone="title">
                      {t.title}
                    </AppText>
                    <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
                      Lyric-free · {t.duration}
                    </AppText>
                  </View>
                  <Crossfade
                    style={{ width: 18, height: 18 }}
                    active={locked}
                    front={<Feather name="lock" size={18} color={c.textAccent} />}
                    back={<Feather name="play" size={18} color={c.textAccent} />}
                  />
                </Card>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>
      ) : null}
    </Screen>
  );
}
