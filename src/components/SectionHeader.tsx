import { View } from 'react-native';

import { type, useTheme } from '@/theme';

import { lightTap } from '@/lib/haptics';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Props = {
  title: string;
  /** small sentence-case kicker above the title */
  kicker?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * SectionHeader — left-aligned (F-pattern, §7) section title with an optional
 * uppercase kicker and a trailing text action. The action dips to 0.6 opacity
 * on press (ease-out, dur.press) so it feels alive, not dead (§4).
 */
export function SectionHeader({ title, kicker, actionLabel, onAction }: Props) {
  const { c } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {kicker ? (
          // sentence-case `meta` (13px, no tracking) instead of the all-caps 11px
          // `caption` micro-label — far easier to read with tired, dark-adapted
          // eyes; tone="accent" still sets it apart from the title.
          <AppText variant="meta" tone="accent" numberOfLines={1} style={{ marginBottom: 4 }}>
            {kicker}
          </AppText>
        ) : null}
        <AppText variant="h2" tone="title" numberOfLines={2}>
          {title}
        </AppText>
      </View>
      {actionLabel ? (
        <PressableScale
          onPress={onAction}
          onPressIn={lightTap}
          hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          dimTo={0.85}>
          <AppText numberOfLines={1} style={[type.label, { color: c.textAccent }]}>{actionLabel}</AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}
