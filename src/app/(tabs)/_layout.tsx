import { Tabs } from 'expo-router';

import { TabBar } from '@/components';
import { dur } from '@/theme';

export default function TabsLayout() {
  return (
    // Tab switches cross-FADE (opacity only) at nav speed — never a hard cut and
    // never a full-screen slide. An instant scene swap is a jolt to a settling
    // brain; a soft dissolve lets the eye follow the change. Each screen still
    // does its subtle one-time entrance the first time it's opened (Reveal), so
    // this only softens the switch itself — no re-staggering, no slop.
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: dur.nav } },
      }}
      tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="sounds" options={{ title: 'Library' }} />
      <Tabs.Screen name="listen" options={{ title: 'Listen' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="you" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
