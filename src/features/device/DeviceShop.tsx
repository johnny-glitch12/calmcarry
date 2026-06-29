import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText, GlowOrb, PrimaryButton, Reveal, Screen, StatusChip } from '@/components';
import { DEVICE_BENEFITS, DEVICE_NAME, openCheckout, type PurchaseReason } from '@/content/store';
import { dur, ease, PRESS_SCALE, useTheme } from '@/theme';

/** A tappable reason-to-buy card. Its own component so useTheme() resolves to the
 *  Screen theme (light surfaces by day, dark by night). */
function ReasonCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => {
    scale.value = withTiming(to, { duration: dur.press, easing: ease.out });
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press(PRESS_SCALE);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => press(1)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityHint="Opens the secure web store">
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: 16,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            ...c.shadow,
          },
          aStyle,
        ]}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: c.panel,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Feather name={icon} size={19} color={c.textAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium" tone="title">
            {title}
          </AppText>
          <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        </View>
        <Feather name="external-link" size={17} color={c.accent} />
      </Animated.View>
    </Pressable>
  );
}

export function DeviceShop() {
  const router = useRouter();
  const { c } = useTheme();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/device'));
  const buy = (reason?: PurchaseReason) => openCheckout(reason);

  return (
    <Screen mode="light" scroll contentStyle={{ paddingTop: 8 }}>
      <Reveal index={0}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ marginBottom: 16 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </Pressable>
        <AppText variant="caption" tone="muted">
          Glow Orb store
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Get another Glow Orb
        </AppText>
      </Reveal>

      {/* product card — the orb twin + what you're buying */}
      <Reveal index={1} style={{ marginTop: 22 }}>
        <View
          style={{
            borderRadius: 22,
            backgroundColor: c.panel,
            borderWidth: 1,
            borderColor: c.panelStrong,
            padding: 22,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <GlowOrb size={72} reserveGlow aura />
            <View style={{ flex: 1 }}>
              <AppText variant="h2" tone="title" style={{ fontSize: 19 }}>
                {DEVICE_NAME}
              </AppText>
              <View style={{ marginTop: 8, flexDirection: 'row' }}>
                <StatusChip label="24-month warranty" icon="shield" />
              </View>
            </View>
          </View>

          <View style={{ marginTop: 18, gap: 12 }}>
            {DEVICE_BENEFITS.map((b) => (
              <View key={b} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Feather name="check" size={17} color={c.textAccent} style={{ marginTop: 2 }} />
                <AppText variant="bodyMedium" style={{ flex: 1, color: c.text }}>
                  {b}
                </AppText>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 20, gap: 8 }}>
            <PrimaryButton label="Buy now, secure checkout" onPress={() => buy()} />
            <AppText
              variant="caption"
              tone="muted"
              style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, marginTop: 2 }}>
              Price &amp; shipping shown at checkout on theglowcompany.co
            </AppText>
          </View>
        </View>
      </Reveal>

      {/* reasons / quick paths */}
      <Reveal index={2} style={{ marginTop: 26, gap: 12 }}>
        <ReasonCard
          icon="plus-circle"
          title="Buy an extra"
          subtitle="A second Orb for a partner, a guest room, or each child"
          onPress={() => buy('extra')}
        />
        <ReasonCard
          icon="refresh-cw"
          title="Buy a replacement"
          subtitle="Lost it, or out of warranty? Order a brand-new one"
          onPress={() => buy('replacement')}
        />
      </Reveal>

      {/* in-warranty path stays a claim, not a sale */}
      <Reveal index={3} style={{ marginTop: 22, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="tool" size={14} color={c.textAccent} />
          <AppText variant="label" tone="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
            Faulty and still in warranty?{' '}
          </AppText>
          <Pressable
            onPress={() => router.push('/replacement-claim')}
            accessibilityRole="button"
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            style={{ paddingVertical: 6 }}>
            <AppText variant="label" style={{ color: c.textAccent }}>
              File a free claim
            </AppText>
          </Pressable>
        </View>
      </Reveal>
    </Screen>
  );
}
