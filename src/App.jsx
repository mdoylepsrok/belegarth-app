import { useState, useEffect } from 'react';
import { Swords, Users, Calendar, BarChart3, BookOpen, AlertCircle } from 'lucide-react';
import { isConfigured } from './lib/supabase';
import Dashboard from './components/Dashboard.jsx';
import Players from './components/Players.jsx';
import BattleLibrary from './components/BattleLibrary.jsx';
import Stats from './components/Stats.jsx';
import History from './components/History.jsx';

const TABS = [
  { id: 'dashboard', label: 'Tonight', icon: Calendar },
  { id: 'players', label: 'Roster', icon: Users },
  { id: 'battles', label: 'Battle Library', icon: BookOpen },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'history', label: 'History', icon: Swords }
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    setConfigured(isConfigured());
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-forest-700 bg-forest-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-forest-800 border border-blood-500/40 flex items-center justify-center">
              <Swords className="w-5 h-5 text-blood-400" />
            </div>
            <div>
              <h1 className="text-lg font-display text-parchment-50 leading-tight">
                Belegarth Practice Manager
              </h1>
              <p className="text-xs text-parchment-100/60">Sign-ins · Stats · Battles</p>
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
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  active
                    ? 'border-blood-500 text-parchment-50'
                    : 'border-transparent text-parchment-100/60 hover:text-parchment-50 hover:border-forest-600'
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

      <footer className="border-t border-forest-700 py-4 text-center text-xs text-parchment-100/40">
        For the realm. ⚔
      </footer>
    </div>
  );
}

function ConfigBanner() {
  return (
    <div className="card p-6 max-w-2xl mx-auto">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-blood-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-3">
          <h2 className="text-xl font-display">Setup required</h2>
          <p className="text-parchment-100/80">
            This app needs to be connected to a Supabase project. Create a free project at{' '}
            <a href="https://supabase.com" className="text-blood-400 underline" target="_blank" rel="noreferrer">
              supabase.com
            </a>
            , then:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-parchment-100/80">
            <li>Run <code className="text-blood-400">supabase/schema.sql</code> in the SQL editor.</li>
            <li>Copy <code className="text-blood-400">.env.example</code> to <code className="text-blood-400">.env</code>.</li>
            <li>Fill in <code className="text-blood-400">VITE_SUPABASE_URL</code> and <code className="text-blood-400">VITE_SUPABASE_ANON_KEY</code> from Project Settings → API.</li>
            <li>Restart <code className="text-blood-400">npm run dev</code>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
