import { View } from 'react-native';

import { AppText, GlowOrb, Reveal, Screen } from '@/components';

type Props = {
  kicker: string;
  title: string;
  body: string;
};

/**
 * Placeholder — a calm EMPTY state for tabs not yet built. Every screen ships
 * an empty/loading/error/success state (§7); this is the empty state. Text
 * settles in with the shared staggered Reveal so it matches the rest of the app.
 */
export function Placeholder({ kicker, title, body }: Props) {
  return (
    <Screen mode="light" tabBarSpacing>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <GlowOrb size={120} reserveGlow aura />
        <Reveal index={0} style={{ alignItems: 'center' }}>
          <AppText variant="caption" tone="accent">
            {kicker}
          </AppText>
        </Reveal>
        <Reveal index={1} style={{ alignItems: 'center' }}>
          <AppText variant="h1" tone="title" style={{ textAlign: 'center' }}>
            {title}
          </AppText>
        </Reveal>
        <Reveal index={2} style={{ alignItems: 'center' }}>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
            {body}
          </AppText>
        </Reveal>
      </View>
    </Screen>
  );
}
