import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppText, GlowOrb, PressableScale, PrimaryButton, Reveal, Screen, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';

type Phase = 'checking' | 'owner' | 'none';

/**
 * First-run owner match (build plan §6/§10): quietly match the account email to a
 * Glowco order to confirm ownership. Found → verified-owner badge + warranty.
 * Not found → register by serial, or skip ("I don't have one yet"). Never gates
 * entry. The email->order match runs server-side against the authenticated email.
 */
export function ClaimDevice() {
  const router = useRouter();
  const { token } = useAuth();
  const [phase, setPhase] = useState<Phase>('checking');

  useEffect(() => {
    if (!token || token === 'local') {
      setPhase('none');
      return;
    }
    let alive = true;
    // Never let a slow/captive network gate entry: if the match hasn't answered in
    // ~5s, fall through to the (non-gating) 'none' screen so there's always a way in.
    const fallback = setTimeout(() => alive && setPhase('none'), 5000);
    api
      .ownershipMatch(token)
      .then((r) => {
        if (!alive) return;
        clearTimeout(fallback);
        setPhase(r.verifiedOwner ? 'owner' : 'none');
      })
      .catch(() => {
        if (!alive) return;
        clearTimeout(fallback);
        setPhase('none');
      });
    return () => {
      alive = false;
      clearTimeout(fallback);
    };
  }, [token]);

  const enter = () => router.replace('/');

  return (
    <Screen scroll contentStyle={{ alignItems: 'center', paddingTop: 48 }}>
      <GlowOrb size={132} reserveGlow aura burst={phase === 'owner'}>
        {phase === 'owner' ? <Feather name="check" size={40} color="#FFFFFF" /> : null}
      </GlowOrb>

      {phase === 'checking' ? (
        <Reveal index={0} style={{ alignItems: 'center', marginTop: 16 }}>
          <AppText variant="h1" tone="title">
            Looking for your Glow Orb…
          </AppText>
          <AppText variant="body" tone="muted" style={{ marginTop: 8, textAlign: 'center', maxWidth: 300 }}>
            Checking your account for a Glow Company order.
          </AppText>
          <PressableScale
            onPress={enter}
            accessibilityRole="button"
            dimTo={0.85}
            style={{ alignItems: 'center', paddingVertical: 14, minHeight: 44, justifyContent: 'center', marginTop: 28 }}>
            <AppText variant="body" tone="muted">
              Not now
            </AppText>
          </PressableScale>
        </Reveal>
      ) : phase === 'owner' ? (
        <>
          <Reveal index={0} style={{ alignItems: 'center', marginTop: 16 }}>
            <AppText variant="h1" tone="title">
              Found your Glow Orb
            </AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 8, textAlign: 'center', maxWidth: 300 }}>
              You’re a registered owner. Your warranty is active and owner content is unlocked.
            </AppText>
          </Reveal>
          <Reveal index={1} style={{ marginTop: 16 }}>
            <StatusChip label="Registered owner · warranty active" icon="shield" confirm />
          </Reveal>
          <Reveal index={2} style={{ alignSelf: 'stretch', marginTop: 28 }}>
            <PrimaryButton label="Continue" onPress={enter} />
          </Reveal>
        </>
      ) : (
        <>
          <Reveal index={0} style={{ alignItems: 'center', marginTop: 16 }}>
            <AppText variant="h1" tone="title" style={{ textAlign: 'center' }}>
              Make it yours
            </AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 8, textAlign: 'center', maxWidth: 320 }}>
              Have a Glow Orb? Register its serial to activate the warranty and unlock owner
              perks. You can always do this later. The app works either way.
            </AppText>
          </Reveal>
          <Reveal index={1} style={{ alignSelf: 'stretch', marginTop: 28, gap: 10 }}>
            <PrimaryButton label="Continue" onPress={enter} />
            <PressableScale
              onPress={() => router.push('/register-device' as Href)}
              accessibilityRole="button"
              dimTo={0.85}
              style={{ alignItems: 'center', paddingVertical: 14, minHeight: 44, justifyContent: 'center' }}>
              <AppText variant="body" tone="muted">
                Register my Glow Orb
              </AppText>
            </PressableScale>
          </Reveal>
        </>
      )}
    </Screen>
  );
}
