import { Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { TabBar } from '@/components';
import { COMMUNITY_ENABLED } from '@/lib/flags';
import { PlaybackProvider } from '@/features/sounds/PlaybackProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { HandsOnTour } from '@/features/tour/HandsOnTour';
import { QuickActionsBridge } from '@/lib/quickActions';
import { getJSON, setJSON } from '@/lib/store';

/** One-time hands-on walkthrough (Mason). Lives HERE - above the scenes AND the
 *  tab bar - because its spotlight points at the real tab pills and the user
 *  advances by actually tapping them. Starts on the first Home landing (where
 *  the hero target exists), adults only, persisted like the old card tour. */
function TourGate() {
  const { hydrated, mode } = useProfile();
  const pathname = usePathname();
  // idle → (first Home landing, flag unset) → active → done. Once active it stays
  // mounted across the tab taps the tour asks for; 'done' never re-enters.
  const [phase, setPhase] = useState<'idle' | 'active' | 'done'>('idle');
  useEffect(() => {
    if (phase !== 'idle' || !hydrated || mode === 'kids' || pathname !== '/') return;
    // never teach at bedtime: in wind-down hours (20:00-05:00) the user came for
    // sleep, not a walkthrough - the tour simply waits for a daytime open (same
    // rule as the check-in suppression). Also keeps the first NIGHT landing clean:
    // Night Door -> Home with no tour, no newcomer card (that card waits on
    // cc.tourDone), nothing between the person and Begin.
    const hour = new Date().getHours();
    if (hour >= 20 || hour < 5) return;
    let alive = true;
    getJSON('cc.tourDone', false).then((done) => {
      if (!alive) return;
      setPhase((p) => (p === 'idle' ? (done ? 'done' : 'active') : p));
    });
    return () => {
      alive = false;
    };
  }, [phase, hydrated, mode, pathname]);
  if (phase !== 'active') return null;
  return (
    <HandsOnTour
      onDone={() => {
        setPhase('done');
        setJSON('cc.tourDone', true);
      }}
    />
  );
}

export default function TabsLayout() {
  return (
    // PlaybackProvider wraps the Tabs (not a single screen) so the sound mixer keeps
    // playing across tab switches and stays alive underneath pushed modal routes
    // (player / wind-down / sos), which live in the parent stack above this group.
    <PlaybackProvider>
    <View style={{ flex: 1 }}>
    {/* Tab switches are INSTANT (Mason: "make it simple") - the native-tab feel:
    // tap, and you're there. No fade, no dissolve; the screens themselves are
    // calm and each still plays its one-time entrance on FIRST open (Reveal).
    // Several fade recipes were tried (420ms dissolve, 190ms overlap fade) and
    // all read as lag or flicker between two dark screens. */}
    <Tabs
      screenOptions={{
        headerShown: false,
        // freezeOnBlur stays OFF: with a transition it could leave the incoming
        // scene frozen (the kids "Listen not loading" bug), and the sound machine
        // must keep living across tab switches anyway.
        animation: 'none',
      }}
      tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="sounds" options={{ title: 'Library' }} />
      <Tabs.Screen name="listen" options={{ title: 'Listen' }} />
      {/* v1: hidden. The screen stays registered but unreachable, so a deep link
          cannot open a UGC surface we cannot moderate to App Store 1.2. */}
      <Tabs.Screen name="community" options={{ title: 'Community', href: COMMUNITY_ENABLED ? undefined : null }} />
      <Tabs.Screen name="you" options={{ title: 'Profile' }} />
    </Tabs>
    <TourGate />
    {/* home-screen quick actions: registers the "Begin wind-down" shortcut + routes
        its launches. Lives here (a sub-layout) because the routing hook navigates. */}
    <QuickActionsBridge />
    </View>
    </PlaybackProvider>
  );
}
