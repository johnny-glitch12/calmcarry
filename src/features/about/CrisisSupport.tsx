import { Feather } from '@expo/vector-icons';
import { Linking, View } from 'react-native';

import { AppText, PressableScale } from '@/components';
import { CRISIS_RESOURCES } from '@/content/store';
import { lightTap } from '@/lib/haptics';
import { useTheme } from '@/theme';

/**
 * Region-aware crisis/help signpost — deliberately calm styling (muted accent heart
 * and phone, a surface card, no red, no alarm language). Rendered in About, at the
 * foot of Learn, and under the check-in: the places someone lands when the night
 * isn't working. Care, not a medical claim; a signpost, never a diagnosis.
 */
export function CrisisSupport() {
  const { c } = useTheme();
  return (
    <View>
      <AppText variant="label" tone="muted" style={{ marginBottom: 10 }}>
        If tonight feels heavy, you’re not alone
      </AppText>
      <View style={{ borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...c.shadow }}>
        {CRISIS_RESOURCES.map((r, i) => (
          <PressableScale
            key={r.region}
            onPress={() => Linking.openURL(r.url).catch(() => {})}
            onPressIn={lightTap}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}. ${r.contact}.`}
            dimTo={0.95}
            scaleTo={0.98}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: i === CRISIS_RESOURCES.length - 1 ? 0 : 1,
              borderBottomColor: c.line,
            }}>
            <Feather name="heart" size={16} color={c.accent} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium" tone="title" style={{ fontSize: 14 }}>
                {r.name}
              </AppText>
              <AppText variant="label" tone="muted" style={{ marginTop: 2, textTransform: 'none', letterSpacing: 0 }}>
                {r.region} · {r.contact}
              </AppText>
            </View>
            <Feather name="phone" size={15} color={c.accent} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}
