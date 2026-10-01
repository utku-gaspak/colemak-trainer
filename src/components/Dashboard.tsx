import { useMemo, useState, type PointerEvent } from 'react';
import { keyConfidence, keyErrorRate, MIN_SAMPLES, targetLatencyMs, type KeyStat } from '../engine/keyStats';
import { ALL_KEYS, ALL_LEVEL_CHARS, EXTRA_CHARS, unlockedChars } from '../layout/colemakDh';
import { useProfileStore, type LessonSummary } from '../state/profileStore';
import { SplitKeyboard, type HeatCell } from './SplitKeyboard';

type HeatMode = 'errors' | 'latency';

/** Fixed scales (not relative to the current max) so colours stay comparable over weeks. */
const ERROR_SCALE_MAX = 0.2;
const LATENCY_SCALE = [150, 700] as const;

function heatFor(stat: KeyStat | undefined, mode: HeatMode): HeatCell | undefined {
  if (!stat || stat.attempts === 0) return undefined;
  if (mode === 'errors') {
    const rate = keyErrorRate(stat);
    return {
      value: Math.min(1, rate / ERROR_SCALE_MAX),
      label: `${(rate * 100).toFixed(0)}%`,
      detail: `${(rate * 100).toFixed(1)}% errors · ${stat.misses} misses in ${stat.attempts} reps`,
    };
  }
  if (stat.ewmaLatency === null) return undefined;
  const [lo, hi] = LATENCY_SCALE;
  return {
    value: Math.max(0, Math.min(1, (stat.ewmaLatency - lo) / (hi - lo))),
    label: `${Math.round(stat.ewmaLatency)}`,
    detail: `${Math.round(stat.ewmaLatency)} ms average (smoothed) · ${stat.attempts} reps`,
  };
}

export function Dashboard() {
  const keyStats = useProfileStore((s) => s.keyStats);
  const lessons = useProfileStore((s) => s.lessons);
  const unlockedCount = useProfileStore((s) => s.unlockedCount);
  const totalWords = useProfileStore((s) => s.totalWords);
  const targetWpm = useProfileStore((s) => s.settings.targetWpm);
  const [mode, setMode] = useState<HeatMode>('errors');

  const unlocked = useMemo(() => new Set(unlockedChars(unlockedCount)), [unlockedCount]);
  const heat = useMemo(() => {
    const out: Record<string, HeatCell | undefined> = {};
    for (const c of [...ALL_KEYS.map((k) => k.char), ...EXTRA_CHARS.keys()]) out[c] = heatFor(keyStats[c], mode);
    return out;
  }, [keyStats, mode]);

  const rows = useMemo(
    () =>
      ALL_LEVEL_CHARS.filter((c) => keyStats[c])
        .map((c) => ({ char: c, stat: keyStats[c]!, conf: keyConfidence(keyStats[c], targetWpm) }))
        .sort((a, b) => a.conf - b.conf),
    [keyStats, targetWpm],
  );

  const recent = lessons.slice(-20);
  const avg = (f: (l: LessonSummary) => number) => (recent.length ? recent.reduce((a, l) => a + f(l), 0) / recent.length : 0);

  return (
    <div className="dashboard">
      <div className="stat-tiles">
        <Tile label="Level" value={String(unlockedCount + 1)} />
        <Tile label="WPM · last 20 lines" value={avg((l) => l.wpm).toFixed(0)} />
        <Tile label="Accuracy · last 20 lines" value={recent.length ? `${(avg((l) => l.accuracy) * 100).toFixed(1)}%` : '–'} />
        <Tile label="Words typed" value={totalWords.toLocaleString()} />
      </div>

      <section className="card">
        <header className="card-head">
          <h2>{mode === 'errors' ? 'Error rate per key' : 'Average latency per key (ms)'}</h2>
          <div className="segmented" role="tablist">
            {(['errors', 'latency'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {m === 'errors' ? 'Errors' : 'Latency'}
              </button>
            ))}
          </div>
        </header>
        <SplitKeyboard unlocked={unlocked} heat={heat} />
        {[...EXTRA_CHARS.keys()].some((c) => unlocked.has(c) || heat[c]) && (
          <div className="chord-heat" aria-label="AltGr characters">
            <span className="muted">AltGr</span>
            {[...EXTRA_CHARS.keys()].map((c) => {
              const h = heat[c];
              return (
                <div
                  key={c}
                  className={`key heat ${h ? (h.value > 0.55 ? 'heat-strong' : 'heat-weak') : 'heat-empty'}${unlocked.has(c) ? '' : ' locked'}`}
                  style={h ? { ['--heat' as string]: `${Math.round(h.value * 100)}%` } : undefined}
                  title={h ? `${c}: ${h.detail}` : `${c}: no data yet`}
                >
                  <span className="key-char">{c}</span>
                  <span className="key-sub">{h?.label ?? '–'}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="heat-legend">
          <span>{mode === 'errors' ? '0%' : `${LATENCY_SCALE[0]} ms`}</span>
          <i className="heat-ramp" aria-hidden />
          <span>{mode === 'errors' ? `≥${ERROR_SCALE_MAX * 100}%` : `≥${LATENCY_SCALE[1]} ms`}</span>
          <span className="muted">· “–” = no data yet</span>
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>WPM per line</h2>
          <span className="muted">last {Math.min(lessons.length, 100)} lines</span>
        </header>
        <WpmChart lessons={lessons.slice(-100)} />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Keys, weakest first</h2>
          <span className="muted">target {Math.round(targetLatencyMs(targetWpm))} ms ≈ {targetWpm} WPM</span>
        </header>
        {rows.length === 0 ? (
          <p className="muted">Type a few lines to see per-key data.</p>
        ) : (
          <table className="key-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Confidence</th>
                <th>Latency</th>
                <th>Error rate</th>
                <th>Reps</th>
                <th>Most confused with</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ char, stat, conf }) => {
                const top = Object.entries(stat.confusions).sort((a, b) => b[1] - a[1]).slice(0, 2);
                return (
                  <tr key={char}>
                    <td><kbd>{char}</kbd></td>
                    <td>{stat.attempts < MIN_SAMPLES ? <span className="muted">learning</span> : <Bar value={conf} />}</td>
                    <td className="num">{stat.ewmaLatency === null ? '–' : `${Math.round(stat.ewmaLatency)} ms`}</td>
                    <td className="num">{(keyErrorRate(stat) * 100).toFixed(1)}%</td>
                    <td className="num">{stat.attempts}</td>
                    <td>{top.length ? top.map(([c, n]) => <span key={c} className="confusion"><kbd>{c === ' ' ? '␣' : c}</kbd>×{n}</span>) : <span className="muted">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="conf-bar" title={`${(value * 100).toFixed(0)}%`}>
      <i style={{ width: `${value * 100}%` }} />
      <span>{(value * 100).toFixed(0)}%</span>
    </span>
  );
}

/** Single-series line chart with a hover crosshair + tooltip. */
function WpmChart({ lessons }: { lessons: LessonSummary[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (lessons.length < 2) return <p className="muted">Complete a couple of lines to see your trend.</p>;

  const W = 720;
  const H = 200;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const maxY = Math.max(20, Math.ceil(Math.max(...lessons.map((l) => l.wpm)) / 10) * 10);
  const x = (i: number) => pad.l + (i / (lessons.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const d = lessons.map((l, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(l.wpm).toFixed(1)}`).join('');
  const ticks = [0, maxY / 2, maxY];
  const h = hover === null ? undefined : lessons[hover];

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (lessons.length - 1));
    setHover(Math.max(0, Math.min(lessons.length - 1, i)));
  };

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="WPM per completed line">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <path className="series" d={d} />
        {h && hover !== null && (
          <>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} />
            <circle className="marker" cx={x(hover)} cy={y(h.wpm)} r={4} />
          </>
        )}
      </svg>
      {h && hover !== null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{h.wpm.toFixed(0)} WPM</strong>
          <span>{(h.accuracy * 100).toFixed(1)}% accuracy · level {h.level}</span>
          <span className="muted">{new Date(h.at).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
