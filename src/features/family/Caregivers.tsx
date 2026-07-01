import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Card, FormField, GlowOrb, PrimaryButton, Reveal, Screen, SectionHeader, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { lightTap } from '@/lib/haptics';
import { brand, useTheme } from '@/theme';

type Caregiver = { id: string; name: string; email: string };
type MemberOf = { householdOwnerId: string; name: string } | null;

export function Caregivers() {
  const { c } = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const live = !!token && token !== 'local';

  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [memberOf, setMemberOf] = useState<MemberOf>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    if (!token || token === 'local') {
      setLoaded(true);
      return;
    }
    setError(false);
    api
      .caregivers(token)
      .then((d) => {
        setCaregivers(d.caregivers ?? []);
        setMemberOf(d.memberOf ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoaded(true));
  }, [token]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/family'));

  const invite = async () => {
    if (!token || token === 'local') {
      setNote('Sign in to invite a caregiver.');
      return;
    }
    setBusy(true);
    setNote(undefined);
    try {
      const r = await api.inviteCaregiver(token);
      setInviteCode(r.code);
    } catch {
      setNote('Couldn’t create an invite. Only the household owner can invite.');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    const code = joinCode.trim();
    if (!code) return;
    if (!token || token === 'local') {
      setNote('Sign in to join a household.');
      return;
    }
    setBusy(true);
    setNote(undefined);
    try {
      await api.redeemCaregiver(token, code);
      setJoinCode('');
      setNote('Joined. You now share the household.');
      refresh();
    } catch {
      setNote('That code didn’t work. Check it and try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!token || token === 'local') return;
    // optimistic: drop the row immediately, roll back if the server rejects
    const prev = caregivers;
    setCaregivers((cs) => cs.filter((cg) => cg.id !== id));
    setNote(undefined);
    try {
      await api.removeCaregiver(token, id);
    } catch {
      setCaregivers(prev);
      setNote('Couldn’t remove that caregiver. Please try again.');
    }
  };

  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <Pressable
          onPress={back}
          onPressIn={lightTap}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [{ marginBottom: 16, alignSelf: 'flex-start' }, pressed ? { opacity: 0.6 } : null]}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </Pressable>
        <AppText variant="caption" tone="muted">
          Household
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Caregivers
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
          Share your CalmCarry with a partner or grandparent. One subscription covers everyone: they get the full library, your devices and profiles.
        </AppText>
      </Reveal>

      {/* loading / error states distinct from a genuinely empty household */}
      {live && !loaded ? (
        <View style={{ paddingVertical: 44, alignItems: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : error ? (
        <Reveal index={1} style={{ marginTop: 22 }}>
          <Card variant="panel" style={{ alignItems: 'center', gap: 8 }}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
              We couldn’t load your household just now.
            </AppText>
            <Pressable
              onPress={refresh}
              onPressIn={lightTap}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
              <AppText variant="bodyMedium" tone="accent">
                Tap to retry
              </AppText>
            </Pressable>
          </Card>
        </Reveal>
      ) : memberOf ? (
        <Reveal index={1} style={{ marginTop: 22 }}>
          <Card variant="panel" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Feather name="home" size={18} color={c.textAccent} />
            <AppText variant="cardTitle" tone="title" style={{ flex: 1, minWidth: 0 }} numberOfLines={2}>
              You’re part of {memberOf.name}’s household
            </AppText>
            <StatusChip label="Shared" icon="users" />
          </Card>
        </Reveal>
      ) : (
        <>
          {/* invite */}
          <Reveal index={1} style={{ marginTop: 24 }}>
            <SectionHeader kicker="Add someone" title="Invite a caregiver" />
            {inviteCode ? (
              <Card variant="panel" style={{ alignItems: 'center', gap: 8 }}>
                <AppText variant="meta" tone="muted">
                  Share this code with them (valid 7 days):
                </AppText>
                <AppText variant="display" tone="title" style={{ letterSpacing: 2 }}>
                  {inviteCode}
                </AppText>
                <AppText variant="meta" tone="muted" style={{ textAlign: 'center' }}>
                  They enter it under Profile → Family & devices → Caregivers → “Have a code”.
                </AppText>
              </Card>
            ) : (
              <PrimaryButton label="Create an invite code" onPress={invite} loading={busy} />
            )}
          </Reveal>

          {/* current caregivers */}
          {caregivers.length > 0 ? (
            <Reveal index={2} style={{ marginTop: 28 }}>
              <SectionHeader kicker="In your household" title="Caregivers" />
              <View style={{ gap: 12 }}>
                {caregivers.map((cg) => (
                  <Card key={cg.id} variant="surface" padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <GlowOrb size={40} reserveGlow breathing={false} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="cardTitle" tone="title" numberOfLines={1}>
                        {cg.name}
                      </AppText>
                      <AppText variant="label" tone="muted" numberOfLines={1}>
                        {cg.email}
                      </AppText>
                    </View>
                    <Pressable
                      onPress={() => remove(cg.id)}
                      onPressIn={lightTap}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${cg.name}`}
                      style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
                      <AppText variant="label" style={{ color: brand.coral }}>
                        Remove
                      </AppText>
                    </Pressable>
                  </Card>
                ))}
              </View>
            </Reveal>
          ) : null}

          {/* join someone else's household */}
          <Reveal index={3} style={{ marginTop: 28 }}>
            <SectionHeader kicker="Have a code?" title="Join a household" />
            <FormField label="Invite code" value={joinCode} onChangeText={setJoinCode} placeholder="e.g. BD85-9B5A" icon="key" autoCapitalize="characters" />
            <View style={{ marginTop: 12 }}>
              <PrimaryButton label="Join household" variant="secondary" onPress={join} loading={busy} />
            </View>
          </Reveal>
        </>
      )}

      {note ? (
        <Reveal index={4} style={{ marginTop: 16 }}>
          <AppText variant="meta" style={{ color: brand.coral, textAlign: 'center' }}>
            {note}
          </AppText>
        </Reveal>
      ) : null}
    </Screen>
  );
}
