import { useEffect, useState } from 'react';
import { LATENCY_CAP_MS } from '../engine/keyStats';
import { accuracy, formatDuration, wpm } from '../engine/metrics';
import { useSessionStore } from '../state/sessionStore';

/**
 * Live WPM / accuracy / elapsed for the current sitting. Elapsed is *active*
 * time: pauses longer than the latency cap don't count, so stepping away
 * doesn't tank your WPM. Ticks on its own timer so the text never re-renders.
 */
export function MetricsBar() {
  const totals = useSessionStore((s) => s.session.totals);
  const lastPressT = useSessionStore((s) => s.session.lastPressT);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Include the gap since the last press (capped) so the clock visibly runs.
  const running = lastPressT !== null && now - lastPressT < LATENCY_CAP_MS;
  const elapsed = totals.activeMs + (running ? Math.max(0, now - lastPressT) : 0);
  const acc = accuracy(totals.correct, totals.errors);

  return (
    <div className="metrics-bar">
      <Metric label="WPM" value={wpm(totals.timedChars, totals.activeMs).toFixed(0)} />
      <Metric label="Accuracy" value={`${(acc * 100).toFixed(1)}%`} warn={totals.correct > 20 && acc < 0.95} />
      <Metric label="Active time" value={formatDuration(elapsed)} />
      <Metric label="Errors" value={String(totals.errors)} />
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`metric${warn ? ' warn' : ''}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}
