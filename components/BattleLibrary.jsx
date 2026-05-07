import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Check, X, BookPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function BattleLibrary() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('battle_games').select('*').order('name');
    setGames(data || []);
    setLoading(false);
  }

  async function saveGame(game) {
    if (!game.name?.trim()) {
      alert('Name is required.');
      return;
    }
    const payload = {
      name: game.name.trim(),
      description: game.description?.trim() || null,
      rules: game.rules?.trim() || null,
      min_players: Number(game.min_players) || 4,
      team_count: Number(game.team_count) || 2,
      in_pool: game.in_pool !== false
    };
    if (game.id) {
      const { error } = await supabase.from('battle_games').update(payload).eq('id', game.id);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from('battle_games').insert(payload);
      if (error) { alert(error.message); return; }
    }
    setEditingId(null);
    setAdding(false);
    await load();
  }

  async function togglePool(g) {
    await supabase.from('battle_games').update({ in_pool: !g.in_pool }).eq('id', g.id);
    await load();
  }

  async function deleteGame(id) {
    if (!confirm('Remove this battle type?')) return;
    await supabase.from('battle_games').delete().eq('id', id);
    await load();
  }

  if (loading) return <p className="text-ink-700/60">Loading library...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display">Battle Library</h2>
          <p className="text-sm text-ink-700/60">
            {games.length} battle types · {games.filter((g) => g.in_pool).length} in random pool
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary">
            <BookPlus className="w-4 h-4" /> Add Battle Type
          </button>
        )}
      </div>

      {adding && <GameForm onSave={saveGame} onCancel={() => setAdding(false)} />}

      <div className="grid md:grid-cols-2 gap-3">
        {games.map((g) => (
          editingId === g.id ? (
            <div key={g.id} className="md:col-span-2">
              <GameForm initial={g} onSave={saveGame} onCancel={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={g.id} className={`card p-4 ${!g.in_pool ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-display text-lg text-grass-700">{g.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => setEditingId(g.id)} className="p-1.5 hover:bg-grass-100 rounded" title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteGame(g.id)} className="p-1.5 hover:bg-grass-100 rounded text-grass-700" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 text-xs mb-2 flex-wrap">
                <span className="pill bg-grass-100 text-ink-700/80">{g.team_count} teams</span>
                <span className="pill bg-grass-100 text-ink-700/80">Min {g.min_players}</span>
                <button
                  onClick={() => togglePool(g)}
                  className={`pill ${g.in_pool ? 'bg-grass-600 text-ink-900' : 'bg-cream-50 text-ink-700/40'}`}
                  title="Click to toggle inclusion in random pool"
                >
                  {g.in_pool ? 'In pool' : 'Excluded'}
                </button>
              </div>
              {g.description && <p className="text-sm text-ink-700/80 mb-1">{g.description}</p>}
              {g.rules && <p className="text-xs text-ink-700/60 italic whitespace-pre-line">{g.rules}</p>}
            </div>
          )
        ))}
        {games.length === 0 && (
          <div className="md:col-span-2 card p-8 text-center text-ink-700/50">
            No battle types yet. The schema seeds 10 common ones — make sure you ran <code>schema.sql</code>.
          </div>
        )}
      </div>
    </div>
  );
}

function GameForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '', description: '', rules: '', min_players: 4, team_count: 2, in_pool: true,
    ...initial
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="card p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Name *</label>
          <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Teams</label>
            <input type="number" min="2" max="6" className="input w-full"
              value={form.team_count} onChange={(e) => set('team_count', e.target.value)} />
          </div>
          <div>
            <label className="label">Min Players</label>
            <input type="number" min="2" className="input w-full"
              value={form.min_players} onChange={(e) => set('min_players', e.target.value)} />
          </div>
        </div>
      </div>
      <div>
        <label className="label">Short Description</label>
        <input className="input w-full" value={form.description || ''}
          onChange={(e) => set('description', e.target.value)} />
      </div>
      <div>
        <label className="label">Rules / Setup</label>
        <textarea className="input w-full font-sans" rows="3" value={form.rules || ''}
          onChange={(e) => set('rules', e.target.value)} />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.in_pool !== false}
            onChange={(e) => set('in_pool', e.target.checked)}
            className="accent-grass-600" />
          Include in random battle pool
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost"><X className="w-4 h-4" /> Cancel</button>
          <button onClick={() => onSave(form)} className="btn-primary"><Check className="w-4 h-4" /> Save</button>
        </div>
      </div>
    </div>
  );
}
