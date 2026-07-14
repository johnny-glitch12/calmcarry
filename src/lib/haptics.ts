import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** The app's standard light selection tap - fire on press-in of a tappable control.
 *  No-op on web; never throws. */
export function lightTap(): void {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
