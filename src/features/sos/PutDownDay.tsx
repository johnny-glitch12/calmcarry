import { useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';

import { Appear, AppText, FlowTransition, PrimaryButton } from '@/components';
import { getJSON, setJSON } from '@/lib/store';
import { dur, type as typeScale, useTheme } from '@/theme';

/** Where tonight's parked thoughts live. Deliberately not in lib/store's KEYS:
 *  nothing reads it yet - a morning surface can adopt it later. */
const SOS_NOTES_KEY = 'cc.sosNotes';

type SosNote = { at: string; lines: string[] };

const PLACEHOLDERS = [
  'What is on your mind for tomorrow?',
  'Anything else?',
  'One more, if it helps',
] as const;

/**
 * PutDownDay - a max-dim brain dump. Up to three one-line thoughts, written
 * once and folded away until morning: the promise is "it is kept", not "it is
 * organised". No list view, no editing, no reading back tonight.
 */
export function PutDownDay({ onDriftBack }: { onDriftBack: () => void }) {
  const { c } = useTheme();
  const [lines, setLines] = useState<string[]>(['', '', '']);
  const [closed, setClosed] = useState(false);
  const kept = lines.map((l) => l.trim()).filter(Boolean);

  const setLine = (i: number, t: string) => setLines((prev) => prev.map((v, j) => (j === i ? t : v)));

  const putDown = () => {
    Keyboard.dismiss();
    // newest first, capped so the key can never grow unbounded
    getJSON<SosNote[]>(SOS_NOTES_KEY, [])
      .then((prior) =>
        setJSON(SOS_NOTES_KEY, [{ at: new Date().toISOString(), lines: kept }, ...prior].slice(0, 30)),
      )
      .catch(() => {});
    setClosed(true);
  };

  return (
    <FlowTransition style={{ flex: 1 }}>
      {closed ? (
        // fold-away confirmation: the form fades out, this eases in after it
        <Appear style={{ flex: 1 }} delay={dur.exit}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <AppText variant="h1" tone="title" style={{ textAlign: 'center' }}>
              Closed until morning
            </AppText>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
              It is written down now. It will keep until you wake.
            </AppText>
          </View>
          <PrimaryButton label="Drift back" onPress={onDriftBack} style={{ marginBottom: 8 }} />
        </Appear>
      ) : (
        <Appear style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
            <AppText variant="h2" tone="title">
              Put the day down
            </AppText>
            <AppText variant="body" tone="muted" style={{ marginBottom: 4 }}>
              Three lines at most. Out of your head, kept for morning.
            </AppText>
            {PLACEHOLDERS.map((ph, i) => (
              <TextInput
                key={ph}
                value={lines[i]}
                onChangeText={(t) => setLine(i, t)}
                placeholder={ph}
                placeholderTextColor={c.dim}
                accessibilityLabel={ph}
                maxLength={80}
                returnKeyType={i === PLACEHOLDERS.length - 1 ? 'done' : 'next'}
                style={[
                  typeScale.body,
                  {
                    minHeight: 52,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: c.line,
                    backgroundColor: c.surface,
                    paddingHorizontal: 14,
                    color: c.text,
                    // RN web needs an explicit outline reset
                    outlineWidth: 0,
                  } as object,
                ]}
              />
            ))}
          </View>
          <PrimaryButton
            label="Put it down"
            onPress={putDown}
            disabled={kept.length === 0}
            style={{ marginBottom: 8 }}
          />
        </Appear>
      )}
    </FlowTransition>
  );
}
