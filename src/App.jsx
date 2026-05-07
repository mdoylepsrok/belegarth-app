import { useState, useEffect } from 'react';
import { Trees, Users, Calendar, BarChart3, BookOpen, AlertCircle, Sun, ClipboardList } from 'lucide-react';
import { isConfigured } from './lib/supabase';
import { useAuth, LoginScreen, LogoutButton } from './lib/auth.jsx';
import Dashboard from './components/Dashboard.jsx';
import Players from './components/Players.jsx';
import BattleLibrary from './components/BattleLibrary.jsx';
import Stats from './components/Stats.jsx';
import History from './components/History.jsx';
import Attendance from './components/Attendance.jsx';

const TABS = [
  { id: 'dashboard', label: 'Today', icon: Calendar },
  { id: 'players', label: 'Roster', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: ClipboardList },
  { id: 'battles', label: 'Battle Library', icon: BookOpen },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'history', label: 'History', icon: Trees }
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [configured, setConfigured] = useState(true);
  const { authed, ready } = useAuth();

  useEffect(() => {
    setConfigured(isConfigured());
  }, []);

  if (!ready) return null; // brief flash while checking stored auth
  if (!authed) return <LoginScreen />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-grass-100 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-grass-500 to-grass-700 flex items-center justify-center shadow-sm">
            <Sun className="w-6 h-6 text-cream-50" />
          </div>
          <h1 className="text-2xl font-display text-ink-900 leading-none">The Park</h1>
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
            {tab === 'attendance' && <Attendance />}
            {tab === 'battles' && <BattleLibrary />}
            {tab === 'stats' && <Stats />}
            {tab === 'history' && <History />}
          </>
        )}
      </main>

      <footer className="border-t border-grass-100 py-4 bg-white/40">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-xs text-ink-700/50">
          <span>See you at the park ☀</span>
          <LogoutButton />
        </div>
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
          <p className="text-ink-700/80">Configure your Supabase connection to continue.</p>
        </div>
      </div>
    </div>
  );
}
