import { useState } from 'react';
import { AboutView } from './components/AboutView';
import { Dashboard } from './components/Dashboard';
import { PracticeView } from './components/PracticeView';
import { SettingsView } from './components/SettingsView';

type View = 'practice' | 'stats' | 'settings' | 'about';

export function App() {
  const [view, setView] = useState<View>('practice');
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">kegex<span className="muted"> · colemak-dh</span></span>
        <nav className="tabs">
          {(['practice', 'stats', 'settings', 'about'] as const).map((v) => (
            <button key={v} type="button" className={view === v ? 'on' : ''} onClick={() => setView(v)} onMouseDown={(e) => e.preventDefault()}>
              {v}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {/* Practice stays mounted so the session and listener survive tab switches. */}
        <div hidden={view !== 'practice'}>
          <PracticeView active={view === 'practice'} />
        </div>
        {view === 'stats' && <Dashboard />}
        {view === 'settings' && <SettingsView />}
        {view === 'about' && <AboutView />}
      </main>
    </div>
  );
}
