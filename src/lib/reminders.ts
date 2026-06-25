import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * The nightly wind-down reminder (build plan §8/§12: "gentle, opt-in, rare").
 * Implemented as a REAL repeating LOCAL notification via expo-notifications —
 * no server/push keys required. Local notifications are native-only, so on web
 * this is a no-op and the toggle is hidden (we never show a control that can't work).
 */
const HOUR = 21;
const MINUTE = 30; // a gentle 9:30pm local nudge
const supported = Platform.OS !== 'web';

export const remindersSupported = supported;

/**
 * Enable/disable the nightly reminder. On enable, asks OS permission and
 * schedules a real daily notification; on disable, cancels it. Returns true
 * only if a real reminder is now scheduled (false on web / denied permission),
 * so the UI never shows "on" for something that isn't actually scheduled.
 */
export async function setBedtimeReminder(enabled: boolean): Promise<boolean> {
  if (!supported) return false;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return false;

    const current = await Notifications.getPermissionsAsync();
    let granted = current.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: { title: 'A gentle nudge', body: 'Time to wind down with CalmCarry.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: HOUR, minute: MINUTE },
    });
    return true;
  } catch {
    return false;
  }
}
