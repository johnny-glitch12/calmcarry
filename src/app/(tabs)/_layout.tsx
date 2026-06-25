import { Tabs } from 'expo-router';

import { TabBar } from '@/components';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, freezeOnBlur: true }}
      tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="sounds" options={{ title: 'Library' }} />
      <Tabs.Screen name="listen" options={{ title: 'Listen' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="you" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
