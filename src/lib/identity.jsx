import {
  createContext, useContext, useState, useEffect, useCallback, useMemo
} from 'react';
import { Search, X, UserCircle } from 'lucide-react';
import { supabase } from './supabase';

const KEY = 'thepark_identity_v1';
const Ctx = createContext(null);

export function useIdentity() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useIdentity must be inside IdentityProvider');
  return v;
}

export function IdentityProvider({ children }) {
  const [playerId, setPlayerId] = useState(null);
  const [player, setPlayer] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // Restore identity from localStorage on mount, verify player still exists
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) { setReady(true); return; }
        const id = JSON.parse(raw);
        if (!id) { setReady(true); return; }
        const { data, error } = await supabase
          .from('players').select('*').eq('id', id).maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          localStorage.removeItem(KEY);
        } else {
          setPlayerId(id);
          setPlayer(data);
        }
      } catch {}
      if (!cancelled) setReady(true);
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  const setIdentity = useCallback((p) => {
    try { localStorage.setItem(KEY, JSON.stringify(p.id)); } catch {}
    setPlayerId(p.id);
    setPlayer(p);
    setPickerOpen(false);
  }, []);

  const clearIdentity = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch {}
    setPlayerId(null);
    setPlayer(null);
  }, []);

  const promptIdentity = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  return (
    <Ctx.Provider value={{
      playerId, player, ready,
      setIdentity, clearIdentity,
      promptIdentity, closePicker, pickerOpen
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function IdentityPickerModal() {
  const { pickerOpen, closePicker, setIdentity } = useIdentity();
  const [players, setPlayers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    setLoading(true);
    supabase.from('players').select('*').eq('active', true).order('name')
      .then(({ data }) => {
        setPlayers(data || []);
        setLoading(false);
      });
  }, [pickerOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return players;
    const q = query.toLowerCase();
    return players.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.belegarth_name?.toLowerCase().includes(q)
    );
  }, [players, query]);

  if (!pickerOpen) return null;

  return (
    <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-xl">
        <div className="p-5 border-b border-grass-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-xl flex items-center gap-2">
              <UserCircle className="w-6 h-6 text-grass-700" />
              Who are you?
            </h2>
            <button onClick={closePicker} className="p-1 hover:bg-cream-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-ink-700/60">
            Pick yourself from the roster to RSVP to events. This stays on this device.
          </p>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              autoFocus
              type="text"
              placeholder="Find your name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input w-full pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-center text-ink-700/50 py-8">Loading roster...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-ink-700/50 py-8">
              {query ? `No matches for "${query}"` : 'No active players in the roster yet.'}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setIdentity(p)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-grass-50 border border-transparent hover:border-grass-200 transition"
                >
                  <div className="font-semibold">{p.belegarth_name || p.name}</div>
                  {p.belegarth_name && (
                    <div className="text-xs text-ink-700/50">{p.name}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-grass-100 text-xs text-ink-700/50 text-center">
          Don't see yourself? An admin can add you in the Roster tab.
        </div>
      </div>
    </div>
  );
}
