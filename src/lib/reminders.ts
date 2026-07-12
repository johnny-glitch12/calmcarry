import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications (build plan §8/§12: "gentle, opt-in, rare"). Two distinct,
 * separately-cancellable reminders so toggling one never clears the other:
 *  - the nightly wind-down nudge (recurring, user-set time)
 *  - the honest free-trial pre-charge reminder (one-off, before the trial ends)
 * Native-only; on web these are no-ops and the controls are hidden.
 */
const DEFAULT_HOUR = 21;
const DEFAULT_MINUTE = 30; // a gentle 9:30pm local nudge
const supported = Platform.OS !== 'web';
const BEDTIME_ID = 'cc-bedtime-reminder';
const TRIAL_ID = 'cc-trial-ending';

export const remindersSupported = supported;

/** Selectable wind-down times (let users pick — a fixed 9:30pm is wrong for shift
 *  workers, parents, and across time zones). */
export const REMINDER_TIMES = [
  { hour: 21, minute: 0, label: '9:00 PM' },
  { hour: 21, minute: 30, label: '9:30 PM' },
  { hour: 22, minute: 0, label: '10:00 PM' },
  { hour: 22, minute: 30, label: '10:30 PM' },
  { hour: 23, minute: 0, label: '11:00 PM' },
] as const;

// Android 8+ requires a channel; without one our reminders land in an unnamed
// "Miscellaneous" bucket the user can't manage. One calm, named channel for all
// three reminders (they're the same kind of gentle nudge — no need to fragment).
// v2: SILENT by default (LOW importance, no sound) — a "gentle nudge" that plays
// the full default alert sound is a contradiction, and channel settings are
// immutable after first creation, so the quiet settings need a fresh id.
const CHANNEL_ID = 'reminders-v2';
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Gentle reminders',
    importance: Notifications.AndroidImportance.LOW, // silent banner in the shade
    vibrationPattern: [0, 150], // one soft pulse — never an alarm buzz
    sound: null,
  }).catch(() => {});
}

async function ensurePermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

/** Permission for the trial reminder specifically: NEVER pops the OS dialog (the
 *  reminder is scheduled mid-purchase, and interrupting a checkout with a system
 *  prompt is exactly the wrong moment). Uses what's already granted; on iOS asks
 *  for PROVISIONAL authorization, which iOS grants silently and delivers quietly
 *  to Notification Center. On Android with no grant we simply skip scheduling. */
async function quietPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (Platform.OS === 'ios' && current.status === 'undetermined') {
    const asked = await Notifications.requestPermissionsAsync({ ios: { allowProvisional: true } });
    return asked.status === 'granted' || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  return false;
}

/**
 * Enable/disable the nightly reminder at the chosen time. Cancels ONLY the bedtime
 * notification (by id) so an unrelated trial reminder survives. Returns true only if
 * one is actually scheduled (false on web / denied) so the UI never shows a phantom on.
 */
export async function setBedtimeReminder(
  enabled: boolean,
  hour: number = DEFAULT_HOUR,
  minute: number = DEFAULT_MINUTE,
): Promise<boolean> {
  if (!supported) return false;
  try {
    await Notifications.cancelScheduledNotificationAsync(BEDTIME_ID).catch(() => {});
    if (!enabled) return false;
    if (!(await ensurePermission())) return false;
    await Notifications.scheduleNotificationAsync({
      identifier: BEDTIME_ID,
      // silent + passive: lands in Notification Center without lighting up or waking
      // anyone — a nudge you find, never one that finds you
      content: { title: 'A gentle nudge', body: 'Time to wind down with CalmCarry.', sound: false, interruptionLevel: 'passive' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * The honest free-trial pre-charge reminder — fires ~1 day before the trial ends so
 * the user is never surprise-charged (the exact trap CalmCarry's brand exists to avoid).
 * Best-effort; safe to call on trial start.
 */
export async function scheduleTrialEndingReminder(trialDays: number, priceLabel: string): Promise<void> {
  if (!supported || trialDays <= 0) return;
  try {
    // quietPermission, not ensurePermission: this runs mid-purchase, and popping the
    // OS permission dialog over a checkout is the wrong moment for a system prompt.
    if (!(await quietPermission())) return;
    await Notifications.cancelScheduledNotificationAsync(TRIAL_ID).catch(() => {});
    // Fire ~1 day before our presented trial length. We deliberately do NOT assert an
    // exact charge date — the authoritative renewal date lives in the store receipt,
    // not in the app — so we nudge honestly without inventing a guaranteed date.
    const fireAt = new Date(Date.now() + Math.max(trialDays - 1, 1) * 86_400_000);
    // The fire time inherits the exact clock time of purchase, so a midnight purchase
    // would otherwise mean a midnight notification. Clamp to civil hours: anything
    // before 10:00 or after 20:00 becomes 18:00 that day. Moving it can only make the
    // reminder EARLIER relative to the charge (worst case ~6.5h before, still pre-charge).
    const h = fireAt.getHours();
    if (h < 10 || h >= 20) fireAt.setHours(18, 0, 0, 0);
    await Notifications.scheduleNotificationAsync({
      identifier: TRIAL_ID,
      content: {
        title: 'Your free trial is ending soon',
        body: `After the trial, CalmCarry Premium continues at ${priceLabel} unless you cancel. Cancel anytime in your Apple or Google account settings.`,
        sound: false,
        interruptionLevel: 'passive',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
    });
  } catch {
    /* best-effort */
  }
}

/** Clear the trial reminder (e.g. the user cancelled, or already converted). */
export async function clearTrialEndingReminder(): Promise<void> {
  if (!supported) return;
  await Notifications.cancelScheduledNotificationAsync(TRIAL_ID).catch(() => {});
}

const RECAP_ID = 'cc-weekly-recap';

/**
 * Weekly calm recap — one gentle Sunday-evening note pointing back at the app
 * (the calm-nights card shows the real week; the notification itself makes no
 * claims, since local notifications can't know the count at fire time). Opt-in,
 * separately cancellable, and returns whether one is actually scheduled.
 */
export async function setWeeklyRecapReminder(enabled: boolean): Promise<boolean> {
  if (!supported) return false;
  try {
    await Notifications.cancelScheduledNotificationAsync(RECAP_ID).catch(() => {});
    if (!enabled) return false;
    if (!(await ensurePermission())) return false;
    await Notifications.scheduleNotificationAsync({
      identifier: RECAP_ID,
      content: {
        title: 'Your calm week',
        body: 'Take a quiet look back at the nights you wound down this week.',
        sound: false,
        interruptionLevel: 'passive',
      },
      // Sunday 7pm local — after the weekend, before the wind-down hour
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 19, minute: 0, channelId: CHANNEL_ID },
    });
    return true;
  } catch {
    return false;
  }
}
