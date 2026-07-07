import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components';

/**
 * SleepyStars — the kids "game" layer over the player (Mason: something to do
 * while the audio plays, that HELPS sleep instead of fighting it). Deliberately
 * wind-down mechanics: tap the sky and a soft star blooms where you touched,
 * twinkles, then drifts down and settles out like falling dust. No score, no
 * fail, no speed, nothing to win — the interaction itself slows down. Audio is
 * untouched (this is a passive touch layer). Reduced motion: stars just fade.
 */
type Star = { id: number; x: number; y: number };

const MAX_STARS = 14;
const LIFE_MS = 6000;
// monotonic id — two taps in the same millisecond must not collide
let nextStarId = 1;

function DriftStar({ star, onDone }: { star: Star; onDone: (id: number) => void }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(1, { duration: LIFE_MS, easing: Easing.out(Easing.quad) });
    const id = setTimeout(() => onDone(star.id), LIFE_MS + 100);
    return () => clearTimeout(id);
  }, [p, star.id, onDone]);

  // deterministic per-star variation (no Math.random in render): size + sway from the id
  const size = 18 + (star.id % 4) * 5;
  const sway = ((star.id % 5) - 2) * 8;

  const style = useAnimatedStyle(() => {
    // bloom in fast, linger, settle out — opacity rises over the first fifth
    // of the life and eases away over the rest
    const o = p.value < 0.2 ? p.value * 5 : 1 - (p.value - 0.2) / 0.8;
    return {
      opacity: Math.max(0, Math.min(1, o)),
      transform: reduced
        ? []
        : [{ translateY: p.value * 46 }, { translateX: p.value * sway }, { scale: 0.8 + p.value * 0.3 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: star.x - size / 2, top: star.y - size / 2 }, style]}>
      {/* soft halo + star glyph — literal light colors over the dark artwork scrim */}
      <View
        style={{
          width: size * 2,
          height: size * 2,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: size,
          backgroundColor: 'rgba(191,230,220,0.18)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <AppText style={{ fontSize: size, lineHeight: size * 1.2, color: '#F4F8F7' }}>✦</AppText>
      </View>
    </Animated.View>
  );
}

export function SleepyStars() {
  const [stars, setStars] = useState<Star[]>([]);
  const [touched, setTouched] = useState(false);

  const remove = useCallback((id: number) => {
    setStars((s) => s.filter((st) => st.id !== id));
  }, []);

  return (
    <View
      // sits over the player's artwork area only (the caller sizes it); receives
      // taps itself but never steals the player's controls below
      style={{ position: 'absolute', top: 64, left: 0, right: 0, height: '44%' }}
      onTouchStart={(e) => {
        const { locationX, locationY } = e.nativeEvent;
        setTouched(true);
        setStars((s) => {
          const next: Star = { id: nextStarId++, x: locationX, y: locationY };
          const kept = s.length >= MAX_STARS ? s.slice(1) : s;
          return [...kept, next];
        });
      }}>
      {stars.map((s) => (
        <DriftStar key={s.id} star={s} onDone={remove} />
      ))}
      {!touched ? (
        <AppText
          variant="caption"
          style={{
            position: 'absolute',
            top: 18,
            alignSelf: 'center',
            color: 'rgba(244,248,247,0.55)',
            textTransform: 'none',
            letterSpacing: 0.4,
          }}>
          tap the sky, little star
        </AppText>
      ) : null}
    </View>
  );
}
