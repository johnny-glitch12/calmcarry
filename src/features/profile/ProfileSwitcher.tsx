import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components';
import { hasParentPin } from '@/lib/parentGate';
import { useTheme } from '@/theme';

import { useProfile, type Profile } from './ProfileProvider';

function Avatar({ profile, active, onPress }: { profile: Profile; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const initial = (profile.name[0] || '?').toUpperCase();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${profile.name}${active ? ', current' : ''}`} style={{ alignItems: 'center', width: 64 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: active ? c.textAccent : c.panel,
          borderWidth: 2,
          borderColor: active ? c.textAccent : c.lineSage,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {profile.type === 'kids' ? (
          <Feather name="smile" size={22} color={active ? '#FFFFFF' : c.textAccent} />
        ) : (
          <AppText style={{ fontFamily: 'Montserrat_700Bold', fontSize: 20, color: active ? '#FFFFFF' : c.textAccent }}>
            {initial}
          </AppText>
        )}
      </View>
      <AppText variant="label" tone={active ? 'title' : 'muted'} style={{ marginTop: 6 }} numberOfLines={1}>
        {profile.name}
      </AppText>
    </Pressable>
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
        <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add a profile" style={{ alignItems: 'center', width: 64 }}>
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
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
