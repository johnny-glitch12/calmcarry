import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { AppText, FormField, GlowOrb, PrimaryButton, Reveal, Screen, SectionHeader, Segmented, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile, type AppMode } from '@/features/profile/ProfileProvider';
import { ProfileSwitcher } from '@/features/profile/ProfileSwitcher';
import { api } from '@/lib/api';
import { hasCoppaConsent, recordCoppaConsent } from '@/lib/consent';
import { hasParentPin } from '@/lib/parentGate';
import { useTheme } from '@/theme';

type ApiDevice = { id: string; serial: string; model?: string };

export function Family() {
  const { c, isNight } = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const { mode, setMode, addProfile } = useProfile();

  // real registered devices for this account (no hardcoded household). Refetched on
  // focus so a device just registered on /register-device shows up on return.
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!token || token === 'local') {
        setDevicesLoaded(true);
        return;
      }
      let alive = true;
      api
        .devices(token)
        .then((list) => {
          if (alive) setDevices((list as ApiDevice[]) ?? []);
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setDevicesLoaded(true);
        });
      return () => {
        alive = false;
      };
    }, [token])
  );
  const offTrack = isNight ? 'rgba(255,255,255,0.18)' : 'rgba(72,84,83,0.20)';
  const kidsMode = mode === 'kids';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AppMode>('kids');
  const [needConsent, setNeedConsent] = useState(false);

  const finishAdd = () => {
    addProfile(newName, newType);
    setNewName('');
    setAdding(false);
    setNeedConsent(false);
  };
  const submitAdd = async () => {
    if (!newName.trim()) return;
    // COPPA: a kid profile collects a child's data → require recorded parental consent first
    if (newType === 'kids' && !(await hasCoppaConsent())) {
      setNeedConsent(true);
      return;
    }
    finishAdd();
  };
  const grantConsentAndAdd = async () => {
    await recordCoppaConsent();
    finishAdd();
  };
  const enterKids = async () => {
    if (await hasParentPin()) {
      setMode('kids');
      router.replace('/');
    } else {
      router.push('/parent-gate?intent=enterKids' as Href);
    }
  };

  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ marginBottom: 16 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </Pressable>
        <AppText variant="caption" tone="muted">
          Household
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Family & devices
        </AppText>
      </Reveal>

      {/* household profiles — one subscription, whole family */}
      <Reveal index={1} style={{ marginTop: 22 }}>
        <SectionHeader kicker="Who’s it for" title="Profiles" />
        <ProfileSwitcher onAdd={() => setAdding((v) => !v)} />
        {adding ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <FormField label="Name" value={newName} onChangeText={setNewName} placeholder="e.g. Mia" icon="user" />
            <Segmented options={['Adult', 'Kid']} value={newType === 'kids' ? 1 : 0} onChange={(i) => { setNewType(i === 1 ? 'kids' : 'adult'); setNeedConsent(false); }} />
            {needConsent ? (
              <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="shield" size={16} color={c.textAccent} />
                  <AppText variant="bodyMedium" tone="title" style={{ fontSize: 15 }}>
                    A quick parent consent
                  </AppText>
                </View>
                <AppText variant="label" tone="muted" style={{ textTransform: 'none', letterSpacing: 0, lineHeight: 18 }}>
                  A kid profile keeps only a first name and an age band — to pick age-appropriate
                  sounds and stories. Kids mode is 100% ad-free, has no chat or community, and we
                  never sell or share your child’s data. You can delete the profile any time.
                </AppText>
                <PrimaryButton label="I’m the parent or guardian — I consent" onPress={grantConsentAndAdd} />
                <Pressable onPress={() => setNeedConsent(false)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 6 }}>
                  <AppText variant="label" tone="muted">Cancel</AppText>
                </Pressable>
              </View>
            ) : (
              <PrimaryButton label="Add to household" onPress={submitAdd} />
            )}
          </View>
        ) : null}
        <AppText variant="label" tone="muted" style={{ marginTop: 14, textTransform: 'none', letterSpacing: 0 }}>
          One subscription covers everyone — each profile keeps its own picks.
        </AppText>
      </Reveal>

      <Reveal index={2} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Your orbs" title="Your devices" />
        <View style={{ gap: 12 }}>
          {devices.map((d) => (
            <View
              key={d.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 14,
                borderRadius: 16,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                ...c.shadow,
              }}>
              <GlowOrb size={44} reserveGlow breathing={false} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyMedium" tone="title" style={{ fontSize: 15 }}>
                  {d.model ?? 'Glow Orb'}
                </AppText>
                <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
                  {d.serial}
                </AppText>
              </View>
              <StatusChip label="Registered" icon="check" />
            </View>
          ))}
          {devicesLoaded && devices.length === 0 ? (
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: c.panel,
                borderWidth: 1,
                borderColor: c.panelStrong,
              }}>
              <AppText variant="label" tone="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
                No devices registered yet. Register your Glow Orb to activate its warranty and replacement support.
              </AppText>
            </View>
          ) : null}
          <Pressable onPress={() => router.push('/register-device')} accessibilityRole="button">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.accent,
                borderStyle: 'dashed',
              }}>
              <Feather name="plus" size={18} color={c.textAccent} />
              <AppText variant="bodyMedium" style={{ color: c.textAccent }}>
                Add a device
              </AppText>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push('/shop')}
            accessibilityRole="button"
            style={{ alignItems: 'center', paddingVertical: 6 }}>
            <AppText variant="label" tone="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
              Need another?{' '}
              <AppText variant="label" style={{ color: c.textAccent }}>
                Buy a Glow Orb
              </AppText>
            </AppText>
          </Pressable>
        </View>
      </Reveal>

      <Reveal index={2} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Kids" title="Child autonomy" />
        <View
          style={{
            borderRadius: 16,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            ...c.shadow,
            padding: 16,
            gap: 14,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="smile" size={18} color={c.accent} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium" tone="title" style={{ fontSize: 15 }}>
                Kids&apos; mode
              </AppText>
              <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
                A gentle, gamified wind-down a child can run themselves
              </AppText>
            </View>
            <Switch
              value={kidsMode}
              onValueChange={(v) => {
                if (v) enterKids();
                else router.push('/parent-gate?intent=exitKids' as Href);
              }}
              accessibilityLabel="Kids' mode"
              trackColor={{ false: offTrack, true: c.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={offTrack}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="shield" size={14} color={c.textAccent} />
            <AppText variant="caption" tone="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
              Parent-gated · minimal data · no ads (COPPA-ready)
            </AppText>
          </View>
        </View>
      </Reveal>

      {/* caregivers — share the household with a partner or grandparent (real) */}
      <Reveal index={3} style={{ marginTop: 24 }}>
        <Pressable onPress={() => router.push('/caregivers' as Href)} accessibilityRole="button">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderRadius: 16,
              backgroundColor: c.panel,
              borderWidth: 1,
              borderColor: c.panelStrong,
            }}>
            <Feather name="user-plus" size={18} color={c.textAccent} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium" tone="title" style={{ fontSize: 15 }}>
                Caregivers
              </AppText>
              <AppText variant="label" tone="muted">
                Share with a partner or grandparent — one subscription covers everyone
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={c.accent} />
          </View>
        </Pressable>
      </Reveal>
    </Screen>
  );
}
