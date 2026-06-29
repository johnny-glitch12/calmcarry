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

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
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
      content: { title: 'A gentle nudge', body: 'Time to wind down with CalmCarry.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
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
    if (!(await ensurePermission())) return;
    await Notifications.cancelScheduledNotificationAsync(TRIAL_ID).catch(() => {});
    // Fire ~1 day before our presented trial length. We deliberately do NOT assert an
    // exact charge date — the authoritative renewal date lives in the store receipt,
    // not in the app — so we nudge honestly without inventing a guaranteed date.
    const fireAt = new Date(Date.now() + Math.max(trialDays - 1, 1) * 86_400_000);
    await Notifications.scheduleNotificationAsync({
      identifier: TRIAL_ID,
      content: {
        title: 'Your free trial is ending soon',
        body: `After the trial, CalmCarry Premium continues at ${priceLabel} unless you cancel. You can cancel anytime in one tap.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
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
