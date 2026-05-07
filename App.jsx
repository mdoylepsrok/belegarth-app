import { useState, useEffect } from 'react';
import { Trees, Users, Calendar, BarChart3, BookOpen, AlertCircle, Sun } from 'lucide-react';
import { isConfigured } from './lib/supabase';
import Dashboard from './components/Dashboard.jsx';
import Players from './components/Players.jsx';
import BattleLibrary from './components/BattleLibrary.jsx';
import Stats from './components/Stats.jsx';
import History from './components/History.jsx';

const TABS = [
  { id: 'dashboard', label: 'Today', icon: Calendar },
  { id: 'players', label: 'Roster', icon: Users },
  { id: 'battles', label: 'Battle Library', icon: BookOpen },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'history', label: 'History', icon: Trees }
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    setConfigured(isConfigured());
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-grass-100 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-grass-500 to-grass-700 flex items-center justify-center shadow-sm">
              <Sun className="w-6 h-6 text-cream-50" />
            </div>
            <div>
              <h1 className="text-2xl font-display text-ink-900 leading-none">
                The Park
              </h1>
              <p className="text-xs text-ink-700/60 mt-0.5">
                Sign-ins · Stats · Battles
              </p>
            </div>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                  active
                    ? 'border-grass-600 text-grass-700'
                    : 'border-transparent text-ink-700/60 hover:text-ink-900 hover:border-grass-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {!configured && <ConfigBanner />}
        {configured && (
          <>
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'players' && <Players />}
            {tab === 'battles' && <BattleLibrary />}
            {tab === 'stats' && <Stats />}
            {tab === 'history' && <History />}
          </>
        )}
      </main>

      <footer className="border-t border-grass-100 py-4 text-center text-xs text-ink-700/50 bg-white/40">
        See you at the park ☀
      </footer>
    </div>
  );
}

function ConfigBanner() {
  return (
    <div className="card p-6 max-w-2xl mx-auto">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-sun-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-3">
          <h2 className="text-xl font-display">Setup required</h2>
          <p className="text-ink-700/80">
            This app needs to be connected to a Supabase project. Create a free project at{' '}
            <a href="https://supabase.com" className="text-grass-700 underline" target="_blank" rel="noreferrer">
              supabase.com
            </a>
            , then:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-ink-700/80">
            <li>Run <code className="text-grass-700 bg-grass-50 px-1 rounded">supabase/schema.sql</code> in the SQL editor.</li>
            <li>Copy <code className="text-grass-700 bg-grass-50 px-1 rounded">.env.example</code> to <code className="text-grass-700 bg-grass-50 px-1 rounded">.env</code>.</li>
            <li>Fill in <code className="text-grass-700 bg-grass-50 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="text-grass-700 bg-grass-50 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> from Project Settings → API.</li>
            <li>Restart the dev server.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
