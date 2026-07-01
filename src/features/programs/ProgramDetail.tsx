import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AppText, Card, PressableScale, PrimaryButton, Reveal, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { covers } from '@/content/covers';
import { PROGRAMS, TRACKS } from '@/content/library';
import { lightTap } from '@/lib/haptics';
import { getProgramDone } from '@/lib/programs';
import { useTheme } from '@/theme';

export function ProgramDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const { isPremium } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  // fall back to the FREE starter arc (not a locked premium program) for a bad/legacy link
  const program = (id && PROGRAMS[id]) || PROGRAMS['first-week'];
  const locked = !!program.locked && !isPremium;

  // real completion state — refreshes when returning from the player
  const [done, setDone] = useState<number[]>([]);
  useFocusEffect(
    useCallback(() => {
      getProgramDone(program.id).then(setDone);
    }, [program.id])
  );

  const open = (day: number, trackId?: string) => {
    if (locked) return router.push(`/unlock?id=${program.id}` as Href);
    if (!trackId) return;
    router.push(`/player?id=${trackId}&program=${program.id}&day=${day}` as Href);
  };
  // "Begin" resumes at the first night not yet done (else night 1)
  const nextStep = program.steps.find((s) => !done.includes(s.day)) ?? program.steps[0];

  const back = () => (router.canGoBack() ? router.back() : router.replace('/sounds'));

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
          scaleTo={0.92}
          style={{ marginBottom: 16 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
        <Image
          source={covers[program.cover]}
          style={{ width: '100%', height: 180, borderRadius: 20 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <AppText variant="caption" tone="accent" style={{ marginTop: 18 }}>
          {program.weeks}-week reset · for {program.avatar}
        </AppText>
        <AppText variant="display" tone="title" style={{ marginTop: 6 }}>
          {program.title}
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
          {program.subtitle}
        </AppText>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 20 }}>
        {locked ? (
          <PrimaryButton label="Unlock with the Calm Plan" onPress={() => router.push(`/unlock?id=${program.id}` as Href)} />
        ) : (
          <PrimaryButton
            label={done.length === 0 ? 'Begin program' : done.length >= program.steps.length ? 'Revisit a night' : `Continue · night ${nextStep.day}`}
            onPress={() => open(nextStep.day, nextStep.trackId)}
          />
        )}
      </Reveal>

      <Reveal index={2} style={{ marginTop: 32 }}>
        <AppText variant="caption" tone="accent" style={{ marginBottom: 4 }}>
          The plan
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <AppText variant="h2" tone="title">
            Your nightly steps
          </AppText>
          {!locked ? (
            <AppText variant="label" tone="muted">
              {done.length} of {program.steps.length} nights
            </AppText>
          ) : null}
        </View>
        <View style={{ gap: 12 }}>
          {program.steps.map((step) => {
            const t = step.trackId ? TRACKS[step.trackId] : undefined;
            const isDone = done.includes(step.day);
            return (
              <PressableScale
                key={step.day}
                onPress={() => open(step.day, step.trackId)}
                onPressIn={lightTap}
                accessibilityRole="button"
                accessibilityState={{ selected: isDone }}
                dimTo={0.95}
                scaleTo={0.98}>
                <Card
                  variant={isDone ? 'panel' : 'surface'}
                  padding={14}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: isDone ? c.accent : c.panel,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {isDone ? (
                      <Feather name="check" size={18} color="#FFFFFF" />
                    ) : (
                      <AppText style={{ fontFamily: 'Montserrat_700Bold', fontSize: 16, color: c.textAccent }}>
                        {step.day}
                      </AppText>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="cardTitle" tone="title">
                      {step.title}
                    </AppText>
                    {t ? (
                      <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
                        {t.title} · {t.duration}
                      </AppText>
                    ) : null}
                  </View>
                  <Feather name={locked ? 'lock' : isDone ? 'rotate-ccw' : 'play'} size={16} color={c.accent} />
                </Card>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>
    </Screen>
  );
}
