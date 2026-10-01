import type { ReactNode } from 'react';
import { BASE_CHARS, MAX_LEVEL, UNLOCK_ORDER } from '../layout/colemakDh';
import { useProfileStore } from '../state/profileStore';

interface Feature {
  title: string;
  body: ReactNode;
}

interface Section {
  heading: string;
  features: Feature[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** In-app readme. Thresholds are read from settings so the text never drifts from behaviour. */
export function AboutView() {
  const settings = useProfileStore((s) => s.settings);
  const p = settings.promotion;

  const sections: Section[] = [
    {
      heading: 'Hardware-level input',
      features: [
        {
          title: 'Physical scancodes only',
          body: (
            <>
              Reads <code>event.code</code>, never <code>event.key</code>, so the OS layout (EURkey, US-International dead
              keys, AltGr) can't change what you type.
            </>
          ),
        },
        {
          title: 'Two mapping modes',
          body: (
            <>
              <strong>Positional</strong>: the board sends QWERTY positions and the app remaps them (<code>KeyF</code> → t).{' '}
              <strong>Firmware</strong>: your QMK/ZMK keymap already outputs Colemak-DH. Currently:{' '}
              <strong>{settings.mapping === 'positional' ? 'positional' : 'firmware'}</strong>.
            </>
          ),
        },
        { title: 'Scancode probe', body: 'Settings shows the raw code and OS character for any key, to diagnose your setup.' },
      ],
    },
    {
      heading: 'Progressive unlocking',
      features: [
        {
          title: `${MAX_LEVEL} levels`,
          body: (
            <>
              Starts with <Keys chars={BASE_CHARS} />, then adds one key per level: <Keys chars={UNLOCK_ORDER} />
            </>
          ),
        },
        {
          title: 'Umlauts',
          body: 'The last levels add ä ö ü ß, typed as AltGr + a / o / u / s by default (rebindable in Settings). From then on, German words join the word generator.',
        },
        {
          title: 'Promotion rules',
          body: `Over the last ${p.windowWords} words at a level: accuracy ≥ ${pct(p.minAccuracy)}, rhythm stability ≥ ${pct(
            p.minStability,
          )}, and ${p.minFocusReps} clean presses of the new key.`,
        },
        {
          title: 'No stalling',
          body: `Weak old keys never block an unlock. After ${p.stallAfterWords} words at one level, the targets ease step by step.`,
        },
        {
          title: 'Pick any level',
          body: 'Click a key in the progress strip, or use ‹ ›, to jump to that level forward or back. Key stats are kept; only the current level\'s unlock progress restarts.',
        },
      ],
    },
    {
      heading: 'Word generation',
      features: [
        {
          title: 'Pronounceable nonsense words',
          body: 'A character-level Markov model trained on English builds words from your unlocked keys only.',
        },
        {
          title: 'Weak-key injection',
          body: `Words containing your 3 weakest keys get +${pct(settings.weakBoost)} selection weight until those keys recover.`,
        },
        { title: 'New-key focus', body: 'The newest key is boosted inside words so it gets enough practice to unlock the next.' },
      ],
    },
    {
      heading: 'Typing view',
      features: [
        { title: 'Stop on error', body: 'A wrong key turns the character red and the cursor waits. First-try characters end green; corrected ones stay red.' },
        { title: 'Split keyboard guide', body: 'Lights the target key, names the finger, and colour-codes every key by finger.' },
        { title: 'Live metrics', body: 'WPM, accuracy, active time and errors. Pauses over 1.5 s are not counted.' },
        {
          title: 'Shortcuts',
          body: (
            <>
              <kbd>Esc</kbd> restarts the current line.
            </>
          ),
        },
      ],
    },
    {
      heading: 'Stats & storage',
      features: [
        { title: 'Per-key heatmap', body: 'Error rate or latency for each key, drawn on the split layout.' },
        { title: 'History', body: 'WPM per line with accuracy and level on hover, plus a table of keys from weakest to strongest.' },
        { title: 'Confusions', body: 'Which keys you press by mistake for each target.' },
        {
          title: 'Themes',
          body: 'System, Light, Dark, Catppuccin (Mocha, Macchiato, Frappé, Latte), Dracula, Nord, Gruvbox, Tokyo Night, One Dark, Solarized, Rosé Pine and Monokai. Pick one in Settings.',
        },
        { title: 'Local only', body: 'Progress, stats and settings are saved in this browser (localStorage). Nothing is sent anywhere.' },
      ],
    },
  ];

  return (
    <div className="about">
      <section className="card about-intro">
        <h2>kegex · Colemak-DH trainer</h2>
        <p className="muted">
          A level-based touch-typing trainer for Colemak-DH on split keyboards. Everything below adapts to your settings.
        </p>
      </section>
      {sections.map((s) => (
        <section className="card" key={s.heading}>
          <h2>{s.heading}</h2>
          <dl className="feature-list">
            {s.features.map((f) => (
              <div className="feature" key={f.title}>
                <dt>{f.title}</dt>
                <dd>{f.body}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function Keys({ chars }: { chars: readonly string[] }) {
  return (
    <span className="key-inline">
      {chars.map((c) => (
        <kbd key={c}>{c}</kbd>
      ))}
    </span>
  );
}
