import { Tabs } from 'expo-router';
import { Easing } from 'react-native';

import { TabBar } from '@/components';
import { dur } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        // Switching a tab is a page change — give it a gentle cross-fade instead of a
        // hard cut. `animation` runs on RN's Animated (not Reanimated), so the timing
        // uses react-native's Easing; dur.nav keeps it consistent with drill-downs.
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: dur.nav, easing: Easing.out(Easing.ease) } },
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
