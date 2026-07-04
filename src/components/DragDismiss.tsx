import { type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, spring } from '@/theme';

type Props = {
  children: ReactNode;
  /** called once the sheet has animated off-screen */
  onDismiss: () => void;
};

/**
 * DragDismiss — pull-down-to-dismiss for full-screen modal sheets (Player,
 * wind-down). The sheet tracks the finger 1:1 downward (damped 4:1 upward, so
 * it resists rather than walls), and releases on EITHER distance (28% of the
 * screen) OR a flick (velocity), so a quick downward flick dismisses without
 * dragging far. Otherwise it springs back home, keeping the finger's velocity.
 *
 * Purely additive: activates only after a deliberate downward pull (12px), so
 * taps, horizontal swipes and the screens' own controls behave exactly as
 * before — and the visible close buttons remain for accessibility.
 */
export function DragDismiss({ children, onDismiss }: Props) {
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const ty = useSharedValue(0);
  const dismissing = useSharedValue(0);

  const finish = () => onDismiss();

  const pan = Gesture.Pan()
    // deliberate vertical pull only — horizontal motion and taps never capture
    .activeOffsetY(14)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      if (dismissing.value) return;
      // 1:1 with the finger going down; damped resistance going up
      ty.value = e.translationY > 0 ? e.translationY : e.translationY / 4;
    })
    .onEnd((e) => {
      if (dismissing.value) return;
      const flick = e.velocityY > 900; // momentum dismissal — a flick is enough
      const far = e.translationY > height * 0.28;
      if (flick || far) {
        dismissing.value = 1;
        if (reduced) {
          runOnJS(finish)();
          return;
        }
        // exit keeps the gesture's energy: quick, ease-out, then hand off.
        // If the timing is interrupted (navigation raced us), un-strand the sheet
        // so the gesture works again instead of staying locked out.
        ty.value = withTiming(height, { duration: dur.sheet, easing: ease.out }, (done) => {
          if (done) {
            runOnJS(finish)();
          } else {
            dismissing.value = 0;
            ty.value = withSpring(0, spring);
          }
        });
      } else {
        // not enough — spring home carrying the release velocity
        ty.value = withSpring(0, { ...spring, velocity: e.velocityY });
      }
    });

  const style = useAnimatedStyle(() => ({ flex: 1, transform: [{ translateY: ty.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
