import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText, PressableScale } from '@/components';
import { covers, type CoverKey } from '@/content/covers';
import { lightTap } from '@/lib/haptics';
import { dur, ease, fonts, kidsDusk } from '@/theme';

/**
 * SlidePuzzle — a genuine little game a child can play WHILE the bedtime audio keeps
 * running (Mason). Launched from a button on the kids player; the audio player stays
 * mounted underneath, so sound never stops. The picture is the track's own watercolour
 * cover, sliced 3×3 (one empty space). Tap a piece next to the gap to slide it; get the
 * picture back together.
 *
 * Tuned for bedtime, not arcade: no timer, no score to beat, no fail state, no loud
 * win — just a soft "you did it" and the picture healing over. Calm, quiet, optional.
 */

const GRID = 3; // 3×3 = 8 pieces + one gap — easy for small hands
const SIZE = GRID * GRID; // 9 cells
const EMPTY = SIZE - 1; // piece id of the blank (bottom-right when solved)
const SOLVED = Array.from({ length: SIZE }, (_, i) => i);

const rc = (i: number) => ({ r: Math.floor(i / GRID), c: i % GRID });
const adjacent = (a: number, b: number) => {
  const pa = rc(a);
  const pb = rc(b);
  return Math.abs(pa.r - pb.r) + Math.abs(pa.c - pb.c) === 1;
};

/** Shuffle by walking the gap through random valid moves — always solvable (a random
 *  permutation would be unsolvable half the time). */
function shuffled(): number[] {
  const s = [...SOLVED];
  let empty = EMPTY;
  let last = -1;
  for (let n = 0; n < 60; n++) {
    const moves = [empty - GRID, empty + GRID, empty % GRID ? empty - 1 : -1, (empty + 1) % GRID ? empty + 1 : -1].filter(
      (m) => m >= 0 && m < SIZE && m !== last && adjacent(m, empty),
    );
    const pick = moves[Math.floor(Math.random() * moves.length)];
    [s[empty], s[pick]] = [s[pick], s[empty]];
    last = empty;
    empty = pick;
  }
  // never hand back an already-solved board
  return s.every((v, i) => v === i) ? shuffled() : s;
}

function isSolved(s: number[]): boolean {
  return s.every((v, i) => v === i);
}

function Piece({
  pieceId,
  slot,
  tile,
  board,
  cover,
  reduced,
  solved,
  onPress,
}: {
  pieceId: number;
  slot: number;
  tile: number;
  board: number;
  cover: CoverKey;
  reduced: boolean;
  solved: boolean;
  onPress: () => void;
}) {
  const { r, c } = rc(slot); // where this piece currently sits
  const tx = c * tile;
  const ty = r * tile;
  const x = useSharedValue(tx);
  const y = useSharedValue(ty);
  useEffect(() => {
    x.value = reduced ? tx : withTiming(tx, { duration: 200, easing: ease.out });
    y.value = reduced ? ty : withTiming(ty, { duration: 200, easing: ease.out });
  }, [tx, ty, reduced, x, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));

  // the gap: invisible while playing; on solve it fills in so the picture completes
  if (pieceId === EMPTY && !solved) return null;

  const piece = rc(pieceId); // which slice of the picture this piece shows
  return (
    <Animated.View style={[{ position: 'absolute', width: tile, height: tile }, style]}>
      <Pressable
        onPress={() => {
          if (!solved) {
            lightTap();
            onPress();
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="puzzle piece"
        style={{
          width: tile,
          height: tile,
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
        }}>
        <Image
          source={covers[cover]}
          style={{ width: board, height: board, transform: [{ translateX: -piece.c * tile }, { translateY: -piece.r * tile }] }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    </Animated.View>
  );
}

export function SlidePuzzle({ cover, onClose }: { cover: CoverKey; onClose: () => void }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  // fit the board to the screen with breathing room; snap to a whole-pixel tile so
  // the sliced picture lines up exactly.
  const tile = Math.floor(Math.min(width - 56, height - 320, 330) / GRID);
  const board = tile * GRID;

  const [slots, setSlots] = useState<number[]>(shuffled);
  const [moves, setMoves] = useState(0);
  const solved = useMemo(() => isSolved(slots), [slots]);

  const tap = (i: number) => {
    setSlots((prev) => {
      const empty = prev.indexOf(EMPTY);
      if (!adjacent(i, empty)) return prev;
      const next = [...prev];
      [next[i], next[empty]] = [next[empty], next[i]];
      return next;
    });
    setMoves((m) => m + 1);
  };

  const restart = () => {
    lightTap();
    setSlots(shuffled());
    setMoves(0);
  };

  return (
    // full-screen cozy-dusk overlay ABOVE the player — the audio player stays mounted
    // underneath, so the bedtime sound keeps playing while they play.
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(21,42,38,0.94)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}>
      {/* close */}
      <PressableScale
        onPress={onClose}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Close the puzzle"
        dimTo={0.85}
        style={{ position: 'absolute', top: 56, right: 24, width: 40, height: 40, borderRadius: 20, backgroundColor: kidsDusk.elevated, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="x" size={20} color={kidsDusk.title} />
      </PressableScale>

      <AppText style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: '#9AD6C4', marginBottom: 6, textAlign: 'center' }}>
        {solved ? 'You did it!' : 'Slide the pieces'}
      </AppText>
      <AppText variant="body" tone="muted" style={{ color: kidsDusk.muted, marginBottom: 18, textAlign: 'center' }}>
        {solved ? 'The picture is back together. Nice and calm.' : 'Tap a piece next to the gap to slide it.'}
      </AppText>

      {/* the board */}
      <View style={{ width: board, height: board, borderRadius: 16, overflow: 'hidden', backgroundColor: kidsDusk.deep, ...kidsDusk.shadow }}>
        {slots.map((pieceId, slot) => (
          <Piece
            key={pieceId}
            pieceId={pieceId}
            slot={slot}
            tile={tile}
            board={board}
            cover={cover}
            reduced={reduced}
            solved={solved}
            onPress={() => tap(slot)}
          />
        ))}
      </View>

      {/* gentle footer: a quiet move count (no timer, no target) + shuffle/done */}
      <AppText variant="caption" tone="dim" style={{ color: kidsDusk.dim, marginTop: 16, textTransform: 'none', letterSpacing: 0.3 }}>
        {moves} {moves === 1 ? 'move' : 'moves'}
      </AppText>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <PressableScale
          onPress={restart}
          accessibilityRole="button"
          accessibilityLabel={solved ? 'Play again' : 'Shuffle'}
          dimTo={0.9}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, backgroundColor: kidsDusk.elevated, borderWidth: 1, borderColor: kidsDusk.lineSage }}>
          <Feather name="shuffle" size={16} color={kidsDusk.glow} />
          <AppText style={{ fontFamily: fonts.medium, fontSize: 15, color: kidsDusk.title }}>{solved ? 'Again' : 'Shuffle'}</AppText>
        </PressableScale>
        <PressableScale
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Done, back to listening"
          dimTo={0.9}
          style={{ paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, backgroundColor: kidsDusk.ctaBg }}>
          <AppText style={{ fontFamily: fonts.medium, fontSize: 15, color: kidsDusk.ctaText }}>Done</AppText>
        </PressableScale>
      </View>
    </View>
  );
}
