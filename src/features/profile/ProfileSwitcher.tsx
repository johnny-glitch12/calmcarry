import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Crossfade, PressableScale, SelectionOverlay } from '@/components';
import { lightTap } from '@/lib/haptics';
import { hasParentPin } from '@/lib/parentGate';
import { fonts, useTheme } from '@/theme';

import { useProfile, type Profile } from './ProfileProvider';

function Avatar({ profile, active, onPress }: { profile: Profile; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const initial = (profile.name[0] || '?').toUpperCase();
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${profile.name}${active ? ', current' : ''}`}
      scaleTo={0.94}
      dimTo={0.92}
      style={{ alignItems: 'center', width: 64 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: c.panel,
          borderWidth: 2,
          borderColor: c.lineSage,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        <SelectionOverlay
          active={active}
          style={{ borderRadius: 26, borderWidth: 2, borderColor: c.textAccent, backgroundColor: c.textAccent }}
        />
        {profile.type === 'kids' ? (
          <Crossfade
            active={active}
            style={{ width: 22, height: 22 }}
            front={<Feather name="smile" size={22} color="#FFFFFF" />}
            back={<Feather name="smile" size={22} color={c.textAccent} />}
          />
        ) : (
          <Crossfade
            active={active}
            style={{ width: 24, height: 24 }}
            front={
              <AppText style={{ fontFamily: fonts.display, fontSize: 20, color: '#FFFFFF' }}>{initial}</AppText>
            }
            back={
              <AppText style={{ fontFamily: fonts.display, fontSize: 20, color: c.textAccent }}>{initial}</AppText>
            }
          />
        )}
      </View>
      <Crossfade
        active={active}
        style={{ width: 64, height: 22, marginTop: 6 }}
        front={
          <AppText variant="label" tone="title" numberOfLines={1}>
            {profile.name}
          </AppText>
        }
        back={
          <AppText variant="label" tone="muted" numberOfLines={1}>
            {profile.name}
          </AppText>
        }
      />
    </PressableScale>
  );
}

/** Compact household switcher. Switching into any profile is open from an adult
 *  context; leaving Kids mode is gated by the parent gate (handled elsewhere). */
export function ProfileSwitcher({ onAdd }: { onAdd?: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const { profiles, activeProfile, setActiveProfile } = useProfile();

  // Switching into a KIDS profile requires a parent PIN to already exist (so a
  // child can't enter Kids mode and then create-and-exit). Adult switches are open.
  const onSelect = async (p: Profile) => {
    if (p.id === activeProfile.id) return;
    if (p.type === 'kids') {
      if (await hasParentPin()) setActiveProfile(p.id);
      else router.push('/parent-gate?intent=enterKids' as Href);
      return;
    }
    setActiveProfile(p.id);
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'flex-start' }}>
      {profiles.map((p) => (
        <Avatar key={p.id} profile={p} active={p.id === activeProfile.id} onPress={() => onSelect(p)} />
      ))}
      {onAdd ? (
        <PressableScale
          onPress={onAdd}
          onPressIn={lightTap}
          accessibilityRole="button"
          accessibilityLabel="Add a profile"
          scaleTo={0.94}
          dimTo={0.92}
          style={{ alignItems: 'center', width: 64 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              borderWidth: 2,
              borderColor: c.accent,
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Feather name="plus" size={22} color={c.textAccent} />
          </View>
          <AppText variant="label" tone="muted" style={{ marginTop: 6 }}>
            Add
          </AppText>
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}
