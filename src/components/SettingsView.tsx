import { useEffect, useState, type ReactNode } from 'react';
import { useProfileStore } from '../state/profileStore';
import { useSessionStore } from '../state/sessionStore';
import {
  defaultChord,
  describeChord,
  effectiveChord,
  resolvePhysicalKey,
  type Chord,
  type ChordOverrides,
  type CodeMapping,
} from '../input/keyMapping';
import { isAltGrHeld, MODIFIER_CODES } from '../input/useHardwareKeyboard';
import { EXTRA_CHARS, MAX_LEVEL } from '../layout/colemakDh';
import { THEME_IDS, THEMES, type Palette, type ThemeId } from '../themes/themes';

/**
 * Why a captured chord can't be used for `char`, or undefined if it's fine.
 * An unmodified layout key would make its own letter untypeable.
 */
function chordProblem(char: string, chord: Chord, mapping: CodeMapping, overrides: ChordOverrides): string | undefined {
  if (!chord.altGr && resolvePhysicalKey(chord.code, mapping)) {
    return `${describeChord(chord, mapping)} already types a letter. Hold AltGr, or use a key outside the layout.`;
  }
  for (const other of EXTRA_CHARS.keys()) {
    if (other === char) continue;
    const o = effectiveChord(other, mapping, overrides);
    if (o && o.code === chord.code && o.altGr === chord.altGr) return `${describeChord(chord, mapping)} is already used for ${other}.`;
  }
  return undefined;
}

function ChordBindings({ mapping, overrides, onChange }: { mapping: CodeMapping; overrides: ChordOverrides; onChange: (next: ChordOverrides) => void }) {
  const [capturing, setCapturing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (capturing === null) return;
    const handler = (e: KeyboardEvent) => {
      if (MODIFIER_CODES.has(e.code)) return; // wait for the actual key while AltGr is held
      e.preventDefault();
      e.stopPropagation();
      const altGr = isAltGrHeld(e);
      if (e.code === 'Escape' && !altGr) {
        setCapturing(null);
        return;
      }
      const chord: Chord = { code: e.code, altGr };
      const problem = chordProblem(capturing, chord, mapping, overrides);
      if (problem) {
        setError(problem);
        return; // stay in capture mode so they can try again
      }
      onChange({ ...overrides, [capturing]: chord });
      setCapturing(null);
      setError(null);
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [capturing, mapping, overrides, onChange]);

  return (
    <div className="chord-list">
      {[...EXTRA_CHARS.keys()].map((char) => {
        const chord = effectiveChord(char, mapping, overrides);
        const custom = overrides[char] !== undefined;
        const isCapturing = capturing === char;
        return (
          <div className={`chord-row${isCapturing ? ' capturing' : ''}`} key={char}>
            <kbd className="chord-char">{char}</kbd>
            <span className="chord-desc">
              {isCapturing ? (
                <span className="capture-hint">Press your combination… (Esc to cancel)</span>
              ) : (
                <>
                  {chord ? describeChord(chord, mapping) : '–'}
                  {!custom && <span className="muted"> · default</span>}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCapturing(isCapturing ? null : char);
              }}
            >
              {isCapturing ? 'Cancel' : 'Change'}
            </button>
            {custom && !isCapturing && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  const { [char]: _removed, ...rest } = overrides;
                  onChange(rest);
                }}
                title={`Back to ${describeChord(defaultChord(char, mapping)!, mapping)}`}
              >
                reset
              </button>
            )}
          </div>
        );
      })}
      {error && <p className="chord-error" role="alert">{error}</p>}
    </div>
  );
}

/** Mini rendering of a theme in its own colours: typed / current / pending text + finger dots. */
function ThemePreview({ p }: { p: Palette }) {
  return (
    <div className="theme-preview" style={{ background: p.surface, color: p.muted, border: `1px solid ${p.border}` }}>
      <span>
        <span style={{ color: p.ok }}>tar</span>
        <span style={{ color: p.bad }}>s</span>
        <span style={{ color: p.text, borderBottom: `2px solid ${p.accent}` }}>t</span>
        <span> nei</span>
      </span>
      <span className="theme-dots">
        {p.fingers.map((c, i) => (
          <i key={i} style={{ background: c }} />
        ))}
      </span>
    </div>
  );
}

function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) {
  const card = (id: ThemeId, name: string, preview: ReactNode) => (
    <button key={id} type="button" className={`theme-card${value === id ? ' on' : ''}`} onClick={() => onChange(id)} aria-pressed={value === id}>
      {preview}
      <span className="theme-name">{name}</span>
    </button>
  );
  return (
    <div className="theme-grid">
      {card(
        'system',
        'System (light / dark)',
        <div className="theme-split">
          <div><ThemePreview p={THEMES.light} /></div>
          <div><ThemePreview p={THEMES.dark} /></div>
        </div>,
      )}
      {THEME_IDS.map((id) => card(id, THEMES[id].name, <ThemePreview p={THEMES[id]} />))}
    </div>
  );
}

/** Live scancode tester: shows exactly what the browser reports for each press. */
function ScancodeProbe() {
  const [last, setLast] = useState<{ code: string; key: string } | null>(null);
  return (
    <input
      className="probe"
      placeholder="Focus here and press a key…"
      readOnly
      onKeyDown={(e) => {
        e.preventDefault();
        setLast({ code: e.code, key: e.key });
      }}
      value={last ? `code: ${last.code}   ·   key (OS layout): ${JSON.stringify(last.key)}` : ''}
    />
  );
}

export function SettingsView() {
  const settings = useProfileStore((s) => s.settings);
  const update = useProfileStore((s) => s.updateSettings);
  const resetProgress = useProfileStore((s) => s.resetProgress);
  const resetSitting = useSessionStore((s) => s.resetSitting);
  const nextLesson = useSessionStore((s) => s.nextLesson);

  const promo = settings.promotion;
  const setPromo = (patch: Partial<typeof promo>) => update({ promotion: { ...promo, ...patch } });

  return (
    <div className="settings">
      <section className="card">
        <h2>Theme</h2>
        <ThemePicker value={settings.theme} onChange={(theme) => update({ theme })} />
      </section>

      <section className="card">
        <h2>Keyboard input</h2>
        <fieldset className="radio-group">
          {(
            [
              ['positional', 'Board sends QWERTY positions', 'The trainer remaps physical positions to Colemak-DH (e.g. the key sending KeyF types “t”). Use this if your OS or firmware layout is QWERTY/EURkey.'],
              ['firmware', 'Firmware already outputs Colemak-DH', 'Your QMK/ZMK/Vial keymap is Colemak-DH, so the “t” position already sends KeyT. The trainer reads it as-is.'],
            ] as Array<[CodeMapping, string, string]>
          ).map(([value, label, help]) => (
            <label key={value} className="radio">
              <input type="radio" name="mapping" checked={settings.mapping === value} onChange={() => update({ mapping: value })} />
              <span>
                <strong>{label}</strong>
                <small>{help}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="muted">Either way only <code>event.code</code> is read; the OS layout (EURkey, US-Intl, dead keys) has no effect.</p>
        <ScancodeProbe />
      </section>

      <section className="card">
        <h2>Umlauts (levels {MAX_LEVEL - EXTRA_CHARS.size + 1}–{MAX_LEVEL})</h2>
        <p className="muted">
          Typed as a chord, AltGr + the base letter by default, like Colemak's and EURkey's AltGr layers. If your board
          types them differently (e.g. a dedicated firmware key), click Change and press it.
        </p>
        <ChordBindings mapping={settings.mapping} overrides={settings.chords} onChange={(chords) => update({ chords })} />
      </section>

      <section className="card">
        <h2>Training</h2>
        <NumberField label="Target speed (WPM)" value={settings.targetWpm} min={10} max={150} onChange={(v) => update({ targetWpm: v })} help="Drives per-key confidence; it does not gate unlocks." />
        <NumberField label="Words per line" value={settings.lessonWords} min={5} max={60} onChange={(v) => update({ lessonWords: v })} />
        <NumberField label="Weak-key boost (%)" value={Math.round(settings.weakBoost * 100)} min={0} max={200} onChange={(v) => update({ weakBoost: v / 100 })} help="Extra selection weight for words containing your weakest keys." />
        <label className="check">
          <input type="checkbox" checked={settings.showKeyboard} onChange={(e) => update({ showKeyboard: e.target.checked })} />
          Show keyboard guide
        </label>
      </section>

      <section className="card">
        <h2>Unlocking</h2>
        <NumberField label="Rolling window (words)" value={promo.windowWords} min={5} max={100} onChange={(v) => setPromo({ windowWords: v })} />
        <NumberField label="Minimum accuracy (%)" value={Math.round(promo.minAccuracy * 100)} min={80} max={100} onChange={(v) => setPromo({ minAccuracy: v / 100 })} />
        <NumberField label="Minimum stability (%)" value={Math.round(promo.minStability * 100)} min={0} max={100} onChange={(v) => setPromo({ minStability: v / 100 })} help="1 − coefficient of variation of per-word WPM over the window." />
        <NumberField label="New-key clean reps" value={promo.minFocusReps} min={8} max={100} onChange={(v) => setPromo({ minFocusReps: v })} />
        <NumberField label="Ease thresholds after (words)" value={promo.stallAfterWords} min={50} max={2000} onChange={(v) => setPromo({ stallAfterWords: v })} help="Anti-stall: past this many words at one level, accuracy and stability targets relax step by step." />
      </section>

      <section className="card danger">
        <h2>Data</h2>
        <div className="row">
          <button type="button" onClick={nextLesson}>New line</button>
          <button
            type="button"
            className="danger-btn"
            onClick={() => {
              if (window.confirm('Reset all progress and key statistics? Settings are kept.')) {
                resetProgress();
                resetSitting();
              }
            }}
          >
            Reset progress
          </button>
        </div>
      </section>
    </div>
  );
}

function NumberField(props: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; help?: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) props.onChange(Math.max(props.min, Math.min(props.max, v)));
        }}
      />
      {props.help && <small>{props.help}</small>}
    </label>
  );
}
