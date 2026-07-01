import { Tabs } from 'expo-router';

import { RevealReplayProvider, TabBar } from '@/components';

export default function TabsLayout() {
  return (
    // The provider makes every Reveal inside the tab screens replay on focus, so
    // switching tabs slides the WIDGETS in one-by-one (staggered). The scene
    // itself does NOT slide (animation: 'none') — the per-widget entrance is the
    // whole transition, which reads far more "designed" than a flat full-screen
    // slide and never flashes the base bright.
    <RevealReplayProvider>
      <Tabs
        screenOptions={{ headerShown: false, freezeOnBlur: true, animation: 'none' }}
        tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="sounds" options={{ title: 'Library' }} />
        <Tabs.Screen name="listen" options={{ title: 'Listen' }} />
        <Tabs.Screen name="community" options={{ title: 'Community' }} />
        <Tabs.Screen name="you" options={{ title: 'Profile' }} />
      </Tabs>
    </RevealReplayProvider>
  );
}
