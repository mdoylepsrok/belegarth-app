import { useState, useEffect, createContext, useContext } from 'react';
import { Lock, LogIn, AlertCircle, LogOut } from 'lucide-react';

const STORAGE_KEY = 'thepark_auth_v1';
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  const expectedCode = import.meta.env.VITE_ADMIN_PASSCODE || '';
  const protectionEnabled = Boolean(expectedCode);

  // On mount, check stored auth
  useEffect(() => {
    if (!protectionEnabled) {
      setAuthed(true);
      setReady(true);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { code, ts } = JSON.parse(stored);
        const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
        if (code === expectedCode && ageDays < 30) {
          setAuthed(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {}
    setReady(true);
  }, [expectedCode, protectionEnabled]);

  function login(code) {
    if (!expectedCode) return true;
    if (code === expectedCode) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, ts: Date.now() }));
      } catch {}
      setAuthed(true);
      return true;
    }
    return false;
  }

  function logout() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setAuthed(false);
  }

  return (
    <AuthContext.Provider value={{ authed, ready, login, logout, protectionEnabled }}>
      {children}
    </AuthContext.Provider>
  );
}

export function LoginScreen() {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);

  function submit(e) {
    e.preventDefault();
    const ok = login(code.trim());
    if (!ok) {
      setErr(true);
      setCode('');
      setTimeout(() => setErr(false), 2000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-grass-500 to-grass-700 flex items-center justify-center shadow-sm">
            <Lock className="w-7 h-7 text-cream-50" />
          </div>
        </div>
        <h1 className="text-2xl font-display text-center mb-1">The Park</h1>
        <p className="text-sm text-ink-700/60 text-center mb-6">
          Enter passcode to continue
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Passcode"
            className={`input w-full text-center ${err ? 'border-sun-600 ring-2 ring-sun-400/40' : ''}`}
          />
          {err && (
            <div className="flex items-center gap-2 text-sm text-sun-600">
              <AlertCircle className="w-4 h-4" />
              Incorrect passcode
            </div>
          )}
          <button type="submit" className="btn-primary w-full justify-center">
            <LogIn className="w-4 h-4" /> Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

export function LogoutButton() {
  const { logout, protectionEnabled } = useAuth();
  if (!protectionEnabled) return null;
  return (
    <button
      onClick={logout}
      className="text-xs text-ink-700/50 hover:text-ink-900 flex items-center gap-1"
      title="Sign out"
    >
      <LogOut className="w-3.5 h-3.5" />
      Sign out
    </button>
  );
}
