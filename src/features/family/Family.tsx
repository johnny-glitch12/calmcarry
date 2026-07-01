import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, View } from 'react-native';

import { AppText, Card, FormField, GlowOrb, PressableScale, PrimaryButton, Reveal, Screen, SectionHeader, Segmented, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile, type AppMode, type Profile } from '@/features/profile/ProfileProvider';
import { ProfileSwitcher } from '@/features/profile/ProfileSwitcher';
import { api } from '@/lib/api';
import { lightTap } from '@/lib/haptics';
import { hasCoppaConsent, recordCoppaConsent } from '@/lib/consent';
import { hasParentPin, parentRecentlyVerified } from '@/lib/parentGate';
import { brand, useTheme } from '@/theme';

type ApiDevice = { id: string; serial: string; model?: string };

export function Family() {
  const { c, isNight } = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const { mode, setMode, addProfile, removeProfile, profiles } = useProfile();

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
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // COPPA: a parent can delete a child's profile + data any time, behind the gate.
  const onRemove = async (p: Profile) => {
    if ((await hasParentPin()) && !parentRecentlyVerified('removeProfile')) {
      router.push('/parent-gate?intent=removeProfile' as Href);
      return;
    }
    if (confirmRemoveId !== p.id) {
      setConfirmRemoveId(p.id); // two-tap confirm — first tap arms, second removes
      return;
    }
    removeProfile(p.id);
    setConfirmRemoveId(null);
  };

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
        <PressableScale
          onPress={back}
          onPressIn={lightTap}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          dimTo={0.85}
          style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
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
              <Card variant="panel" style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="shield" size={16} color={c.textAccent} />
                  <AppText variant="cardTitle" tone="title">
                    A quick parent consent
                  </AppText>
                </View>
                <AppText variant="meta" tone="muted" style={{ lineHeight: 18 }}>
                  A kid profile keeps only a first name. Kids mode is 100% ad-free, has no chat or
                  community, and we never sell or share your child’s data. You can remove the
                  profile and its data any time, below.
                </AppText>
                <PrimaryButton label="I’m the parent or guardian, and I consent" onPress={grantConsentAndAdd} />
                <PressableScale onPress={() => setNeedConsent(false)} accessibilityRole="button" dimTo={0.85} style={{ alignSelf: 'center', paddingVertical: 6 }}>
                  <AppText variant="label" tone="muted">Cancel</AppText>
                </PressableScale>
              </Card>
            ) : (
              <PrimaryButton label="Add to household" onPress={submitAdd} />
            )}
          </View>
        ) : null}
        <AppText variant="meta" tone="muted" style={{ marginTop: 14 }}>
          One subscription covers everyone. Each profile keeps its own picks.
        </AppText>

        {/* remove a child profile + its data (COPPA) — gated, two-tap confirm */}
        {profiles.filter((p) => p.type === 'kids').length > 0 ? (
          <View style={{ marginTop: 14, gap: 8 }}>
            {profiles
              .filter((p) => p.type === 'kids')
              .map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Feather name="smile" size={14} color={c.muted} />
                  <AppText variant="meta" tone="muted" style={{ flex: 1 }}>
                    {p.name}
                  </AppText>
                  <PressableScale
                    onPress={() => onRemove(p)}
                    onPressIn={lightTap}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${p.name}`}
                    dimTo={0.85}>
                    <AppText variant="label" style={{ color: confirmRemoveId === p.id ? brand.coral : c.textAccent }}>
                      {confirmRemoveId === p.id ? 'Tap to confirm' : 'Remove'}
                    </AppText>
                  </PressableScale>
                </View>
              ))}
          </View>
        ) : null}
      </Reveal>

      <Reveal index={2} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Your orbs" title="Your devices" />
        <View style={{ gap: 12 }}>
          {devices.map((d) => (
            <Card
              key={d.id}
              variant="surface"
              padding={14}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <GlowOrb size={44} reserveGlow breathing={false} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="cardTitle" tone="title" numberOfLines={1}>
                  {d.model ?? 'Glow Orb'}
                </AppText>
                <AppText variant="label" tone="muted" style={{ marginTop: 2 }} numberOfLines={1}>
                  {d.serial}
                </AppText>
              </View>
              <StatusChip label="Registered" icon="check" />
            </Card>
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
              <AppText variant="meta" tone="muted">
                No devices registered yet. Register your Glow Orb to activate its warranty and replacement support.
              </AppText>
            </View>
          ) : null}
          <PressableScale
            onPress={() => router.push('/register-device')}
            onPressIn={lightTap}
            accessibilityRole="button"
            scaleTo={0.98}
            dimTo={0.95}>
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
          </PressableScale>
          <PressableScale
            onPress={() => router.push('/shop')}
            onPressIn={lightTap}
            accessibilityRole="button"
            dimTo={0.85}
            style={{ alignItems: 'center', paddingVertical: 6 }}>
            <AppText variant="meta" tone="muted">
              Need another?{' '}
              <AppText variant="label" style={{ color: c.textAccent }}>
                Buy a Glow Orb
              </AppText>
            </AppText>
          </PressableScale>
        </View>
      </Reveal>

      <Reveal index={2} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Kids" title="Child autonomy" />
        <Card variant="surface" style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="smile" size={18} color={c.accent} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" tone="title">
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
            <AppText variant="meta" tone="muted">
              Parent-gated · minimal data · no ads (COPPA-ready)
            </AppText>
          </View>
        </Card>
      </Reveal>

      {/* caregivers — share the household with a partner or grandparent (real) */}
      <Reveal index={3} style={{ marginTop: 24 }}>
        <PressableScale
          onPress={() => router.push('/caregivers' as Href)}
          onPressIn={lightTap}
          accessibilityRole="button"
          scaleTo={0.98}
          dimTo={0.95}>
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" tone="title">
                Caregivers
              </AppText>
              <AppText variant="label" tone="muted">
                Share with a partner or grandparent, one subscription covers everyone
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={c.accent} />
          </View>
        </PressableScale>
      </Reveal>
    </Screen>
  );
}
