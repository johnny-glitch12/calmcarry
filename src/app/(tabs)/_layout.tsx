import { Tabs } from 'expo-router';
import { Dimensions, Easing } from 'react-native';

import { TabBar } from '@/components';
import { dur } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        // Pages SLIDE across, they don't cross-fade. The old 'fade' put both dark
        // screens at partial opacity and let the base bleed through — that's the
        // "goes bright" flash. This is a pure horizontal translate (no opacity):
        // the current page slides off one edge while the next slides in from the
        // other, edge-to-edge so nothing behind is ever revealed. 'shift' turns the
        // transition machinery on; the custom interpolator below replaces its fade.
        animation: 'shift',
        transitionSpec: { animation: 'timing', config: { duration: dur.nav, easing: Easing.inOut(Easing.ease) } },
        sceneStyleInterpolator: ({ current }) => {
          const w = Dimensions.get('window').width || 400;
          return {
            sceneStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [w, 0, -w],
                  }),
                },
              ],
            },
          };
        },
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
