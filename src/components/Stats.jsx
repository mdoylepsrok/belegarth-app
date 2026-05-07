import { useEffect, useState, useMemo } from 'react';
import { Trophy, Skull, Swords, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SORT_OPTIONS = [
  { id: 'kd_ratio', label: 'K/D Ratio' },
  { id: 'total_kills', label: 'Kills' },
  { id: 'wins', label: 'Wins' },
  { id: 'win_pct', label: 'Win %' },
  { id: 'battles_played', label: 'Battles' },
  { id: 'sessions_attended', label: 'Sessions' }
];

export default function Stats() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('kd_ratio');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('player_stats').select('*').eq('active', true);
    setStats(data || []);
    setLoading(false);
  }

  const sorted = useMemo(() => {
    return [...stats].sort((a, b) => Number(b[sortBy] ?? 0) - Number(a[sortBy] ?? 0));
  }, [stats, sortBy]);

  const totals = useMemo(() => ({
    sessions: stats.reduce((m, p) => Math.max(m, p.sessions_attended || 0), 0),
    battles: stats.reduce((s, p) => s + (p.battles_played || 0), 0),
    kills: stats.reduce((s, p) => s + (p.total_kills || 0), 0)
  }), [stats]);

  if (loading) return <p className="text-parchment-100/60">Loading stats...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-display">Player Stats</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-parchment-100/60">Sort by:</label>
          <select className="input text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={Calendar} label="Sessions" value={totals.sessions} />
        <SummaryCard icon={Swords} label="Battles" value={totals.battles} />
        <SummaryCard icon={Skull} label="Total Kills" value={totals.kills} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-forest-900/80 border-b border-forest-700 text-parchment-100/60 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium text-right">Battles</th>
                <th className="px-3 py-2 font-medium text-right">K</th>
                <th className="px-3 py-2 font-medium text-right">D</th>
                <th className="px-3 py-2 font-medium text-right">K/D</th>
                <th className="px-3 py-2 font-medium text-right">W</th>
                <th className="px-3 py-2 font-medium text-right">Win %</th>
                <th className="px-3 py-2 font-medium text-right">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-parchment-100/50">
                  No stats yet. Play some battles!
                </td></tr>
              ) : sorted.map((p, idx) => (
                <tr key={p.id} className="border-b border-forest-700/50 hover:bg-forest-900/40">
                  <td className="px-3 py-2 text-parchment-100/40">
                    {idx === 0 ? <Trophy className="w-4 h-4 text-yellow-500" /> :
                     idx === 1 ? <Trophy className="w-4 h-4 text-zinc-400" /> :
                     idx === 2 ? <Trophy className="w-4 h-4 text-orange-700" /> :
                     idx + 1}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {p.belegarth_name || p.name}
                    {p.belegarth_name && (
                      <div className="text-xs text-parchment-100/50">{p.name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{p.battles_played}</td>
                  <td className="px-3 py-2 text-right text-parchment-50">{p.total_kills}</td>
                  <td className="px-3 py-2 text-right text-parchment-100/60">{p.total_deaths}</td>
                  <td className="px-3 py-2 text-right font-medium">{Number(p.kd_ratio).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{p.wins}</td>
                  <td className="px-3 py-2 text-right">{Number(p.win_pct).toFixed(0)}%</td>
                  <td className="px-3 py-2 text-right text-parchment-100/60">{p.sessions_attended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-parchment-100/50">
        Tip: K/D and battle stats need per-battle kill/death entries. Currently the app records team
        assignments and winners. Add kill tallying in the History tab if your group tracks it.
      </p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-md bg-forest-700/60 flex items-center justify-center">
        <Icon className="w-5 h-5 text-blood-400" />
      </div>
      <div>
        <div className="text-2xl font-display">{value}</div>
        <div className="text-xs text-parchment-100/60">{label}</div>
      </div>
    </div>
  );
}
