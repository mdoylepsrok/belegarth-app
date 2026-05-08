import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Edit3, Check, X, UserPlus, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

const WEAPON_STYLES = [
  '', 'Sword & Board', 'Single Sword', 'Florentine', 'Two-Hander',
  'Polearm', 'Spear', 'Archer', 'Javelin', 'Mixed'
];

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('players').select('*').order('name');
    setPlayers(data || []);
    setLoading(false);
  }

  async function savePlayer(player) {
    if (!player.name?.trim()) {
      alert('Name is required.');
      return;
    }
    const payload = {
      name: player.name.trim(),
      belegarth_name: player.belegarth_name?.trim() || null,
      weapon_style: player.weapon_style || null,
      skill_rating: Number(player.skill_rating) || 5,
      active: player.active !== false,
      notes: player.notes?.trim() || null
    };
    if (player.id) {
      await supabase.from('players').update(payload).eq('id', player.id);
    } else {
      await supabase.from('players').insert(payload);
    }
    setEditingId(null);
    setAdding(false);
    await load();
  }

  async function deletePlayer(id) {
    if (!confirm('Remove this player? Their battle history will be deleted too.')) return;
    await supabase.from('players').delete().eq('id', id);
    await load();
  }

  async function toggleActive(p) {
    await supabase.from('players').update({ active: !p.active }).eq('id', p.id);
    await load();
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return players;
    const q = query.toLowerCase();
    return players.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.belegarth_name?.toLowerCase().includes(q) ||
      p.weapon_style?.toLowerCase().includes(q)
    );
  }, [players, query]);

  if (loading) return <p className="text-ink-700/60">Loading roster...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display">Roster</h2>
          <p className="text-sm text-ink-700/60">{players.length} players · {players.filter(p=>p.active).length} active</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add Player
          </button>
        )}
      </div>

      {adding && (
        <PlayerForm onSave={savePlayer} onCancel={() => setAdding(false)} />
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, field name, or weapon style..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input w-full pl-9"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-cream-100 rounded text-ink-700/50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-grass-100 text-ink-700/70 text-left">
              <tr>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Field Name</th>
                <th className="px-4 py-2 font-semibold">Style</th>
                <th className="px-4 py-2 font-semibold">Skill</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-700/50">
                  {query ? `No matches for "${query}"` : 'No players yet. Click Add Player to get started.'}
                </td></tr>
              ) : filtered.map((p) => (
                editingId === p.id ? (
                  <tr key={p.id} className="border-b border-grass-100 bg-cream-50">
                    <td colSpan={6} className="p-4">
                      <PlayerForm initial={p} onSave={savePlayer} onCancel={() => setEditingId(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className={`border-b border-grass-100/50 hover:bg-cream-50 ${!p.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 font-semibold">{p.name}</td>
                    <td className="px-4 py-2 text-ink-700/80">{p.belegarth_name || '—'}</td>
                    <td className="px-4 py-2 text-ink-700/70">{p.weapon_style || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="pill bg-grass-100 text-grass-700">
                        {Number(p.skill_rating).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleActive(p)}
                        className={`pill ${p.active ? 'bg-grass-100 text-grass-700' : 'bg-cream-100 text-ink-700/40'}`}
                      >
                        {p.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setEditingId(p.id)} className="p-1.5 hover:bg-cream-100 rounded" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deletePlayer(p.id)} className="p-1.5 hover:bg-cream-100 rounded text-sun-600" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlayerForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '', belegarth_name: '', weapon_style: '', skill_rating: 5, active: true, notes: '',
    ...initial
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="label">Real Name *</label>
        <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Field/Belegarth Name</label>
        <input className="input w-full" value={form.belegarth_name || ''} onChange={(e) => set('belegarth_name', e.target.value)} />
      </div>
      <div>
        <label className="label">Weapon Style</label>
        <select className="input w-full" value={form.weapon_style || ''} onChange={(e) => set('weapon_style', e.target.value)}>
          {WEAPON_STYLES.map((s) => (
            <option key={s} value={s}>{s || '—'}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Skill Rating (1–10): {Number(form.skill_rating).toFixed(1)}</label>
        <input
          type="range" min="1" max="10" step="0.5"
          value={form.skill_rating}
          onChange={(e) => set('skill_rating', e.target.value)}
          className="w-full accent-grass-600"
        />
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <input className="input w-full" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Injuries, preferences, etc." />
      </div>
      <div className="md:col-span-2 flex items-center justify-between flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} className="accent-grass-600" />
          Active (shows up in tonight's sign-in)
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost"><X className="w-4 h-4" /> Cancel</button>
          <button onClick={() => onSave(form)} className="btn-primary"><Check className="w-4 h-4" /> Save</button>
        </div>
      </div>
    </div>
  );
}
