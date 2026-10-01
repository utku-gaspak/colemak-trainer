import { memo } from 'react';
import { fingerLabel, halfRows, SPACE_KEY, type Finger, type Hand, type PhysicalKey } from '../layout/colemakDh';
import { ALT_GR } from '../input/keyMapping';

export interface HeatCell {
  /** 0..1 normalised intensity. */
  value: number;
  /** Text printed on the key (e.g. "12%"). */
  label: string;
  /** Tooltip text. */
  detail: string;
}

interface SplitKeyboardProps {
  /** Character to highlight as the next target (guide mode). */
  target?: string;
  /** Mistyped character to flash (guide mode). */
  wrong?: string | null;
  unlocked: ReadonlySet<string>;
  /** When present, render as a heatmap instead of a finger guide. */
  heat?: Readonly<Record<string, HeatCell | undefined>>;
  focus?: ReadonlySet<string>;
  /** Show the QWERTY scancode under each key, useful for diagnosing firmware mapping. */
  showCodes?: boolean;
  /** Secondary character per key char, shown in the corner (a → ä). */
  altLabels?: Readonly<Record<string, string>>;
  /** Target needs AltGr held: lights the AltGr indicator. */
  altGrActive?: boolean;
}

export const FINGERS: readonly Finger[] = ['pinky', 'ring', 'middle', 'index', 'thumb'];

interface KeyCapProps {
  k: PhysicalKey;
  isTarget: boolean;
  isWrong: boolean;
  locked: boolean;
  isFocus: boolean;
  heat?: HeatCell;
  heatMode: boolean;
  showCodes: boolean;
  alt?: string;
}

const KeyCap = memo(function KeyCap({ k, isTarget, isWrong, locked, isFocus, heat, heatMode, showCodes, alt }: KeyCapProps) {
  const classes = ['key', `finger-${k.finger}`];
  if (k.homing) classes.push('homing');
  if (locked) classes.push('locked');
  if (isTarget) classes.push('target');
  if (isWrong) classes.push('wrong');
  if (isFocus) classes.push('focus');
  if (heatMode) classes.push('heat', heat ? (heat.value > 0.55 ? 'heat-strong' : 'heat-weak') : 'heat-empty');

  const style = heatMode && heat ? { ['--heat' as string]: `${Math.round(heat.value * 100)}%` } : undefined;
  const label = k.char === ' ' ? 'space' : k.char;
  const title = heat ? `${label}: ${heat.detail}` : `${label} · ${fingerLabel(k)} · ${k.code}`;

  return (
    <div className={classes.join(' ')} style={style} title={title} data-code={k.code}>
      <span className="key-char">{k.char === ' ' ? '␣' : k.char}</span>
      {alt && !heatMode && <span className="key-alt" aria-label={`${ALT_GR}: ${alt}`}>{alt}</span>}
      {heatMode ? (
        <span className="key-sub">{heat?.label ?? '–'}</span>
      ) : (
        showCodes && <span className="key-sub">{k.code.replace(/^Key/, '')}</span>
      )}
    </div>
  );
});

function Half({ hand, props }: { hand: Hand; props: SplitKeyboardProps }) {
  const heatMode = props.heat !== undefined;
  const render = (k: PhysicalKey) => (
    <KeyCap
      key={`${hand}-${k.code}`}
      k={k}
      isTarget={!heatMode && props.target === k.char}
      isWrong={!heatMode && props.wrong === k.char}
      locked={k.char !== ' ' && !props.unlocked.has(k.char)}
      isFocus={props.focus?.has(k.char) ?? false}
      heat={props.heat?.[k.char]}
      heatMode={heatMode && k.char !== ' '}
      showCodes={props.showCodes ?? false}
      alt={props.altLabels?.[k.char]}
    />
  );
  return (
    <div className={`half half-${hand}`}>
      {halfRows(hand).map((row, i) => (
        <div className="key-row" key={i}>
          {row.map(render)}
        </div>
      ))}
      <div className="key-row thumb-row">
        {hand === 'right' && !heatMode && (props.altGrActive || Object.keys(props.altLabels ?? {}).length > 0) && (
          <div className={`key mod-key${props.altGrActive ? ' target' : ''}`} title={ALT_GR === 'AltGr' ? 'AltGr (right Alt)' : 'Option (⌥)'}>
            <span className="key-char">{ALT_GR}</span>
          </div>
        )}
        {render(SPACE_KEY)}
      </div>
    </div>
  );
}

/**
 * Visual 3x5+1 split board. In guide mode the target key is lit and the
 * finger responsible is named; in heatmap mode keys are shaded by `heat`.
 */
export function SplitKeyboard(props: SplitKeyboardProps) {
  return (
    <div className={`split-keyboard${props.heat ? ' is-heatmap' : ''}`}>
      <Half hand="left" props={props} />
      <Half hand="right" props={props} />
    </div>
  );
}

export function FingerLegend({ active }: { active?: PhysicalKey }) {
  return (
    <div className="finger-legend" aria-label="Finger colours">
      {FINGERS.map((f) => (
        <span key={f} className={`legend-item finger-${f}${active?.finger === f ? ' active' : ''}`}>
          <i className="swatch" aria-hidden />
          {f}
        </span>
      ))}
    </div>
  );
}
