import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Check, X, UserPlus } from 'lucide-react';
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

  if (loading) return <p className="text-parchment-100/60">Loading roster...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display">Roster</h2>
          <p className="text-sm text-parchment-100/60">{players.length} players · {players.filter(p=>p.active).length} active</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add Player
          </button>
        )}
      </div>

      {adding && (
        <PlayerForm
          onSave={savePlayer}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-forest-900/80 border-b border-forest-700">
              <tr className="text-left text-parchment-100/60">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Field Name</th>
                <th className="px-4 py-2 font-medium">Style</th>
                <th className="px-4 py-2 font-medium">Skill</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-parchment-100/50">
                  No players yet. Click <strong>Add Player</strong> to get started.
                </td></tr>
              ) : players.map((p) => (
                editingId === p.id ? (
                  <tr key={p.id} className="border-b border-forest-700 bg-forest-900/40">
                    <td colSpan={6} className="p-4">
                      <PlayerForm
                        initial={p}
                        onSave={savePlayer}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className={`border-b border-forest-700/50 hover:bg-forest-900/40 ${!p.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-parchment-100/80">{p.belegarth_name || '—'}</td>
                    <td className="px-4 py-2 text-parchment-100/70">{p.weapon_style || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="pill bg-forest-700 text-parchment-100/80">
                        {Number(p.skill_rating).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => toggleActive(p)}
                        className={`pill ${p.active ? 'bg-forest-700 text-parchment-50' : 'bg-forest-900 text-parchment-100/40'}`}
                      >
                        {p.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setEditingId(p.id)} className="p-1.5 hover:bg-forest-700 rounded" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deletePlayer(p.id)} className="p-1.5 hover:bg-forest-700 rounded text-blood-400" title="Delete">
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="label">Real Name *</label>
        <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} />
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
          className="w-full accent-blood-500"
        />
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <input className="input w-full" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Injuries, preferences, etc." />
      </div>
      <div className="md:col-span-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} className="accent-blood-500" />
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
