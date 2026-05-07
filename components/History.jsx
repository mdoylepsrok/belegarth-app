import { useEffect, useState } from 'react';
import { Trophy, Calendar, Swords, Plus, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function History() {
  const [battles, setBattles] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: b } = await supabase
      .from('battles')
      .select('*, battle_games(name, team_count), sessions(session_date)')
      .order('played_at', { ascending: false })
      .limit(50);
    setBattles(b || []);
    setLoading(false);
  }

  if (loading) return <p className="text-ink-700/60">Loading history...</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-display">Battle History</h2>
      {battles.length === 0 ? (
        <div className="card p-8 text-center text-ink-700/60">
          No battles recorded yet. Play one in <strong>Tonight</strong>.
        </div>
      ) : (
        <div className="space-y-2">
          {battles.map((b) => (
            <BattleRow
              key={b.id}
              battle={b}
              expanded={expanded === b.id}
              onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
              onChange={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BattleRow({ battle, expanded, onToggle, onChange }) {
  const [teams, setTeams] = useState(null);

  useEffect(() => { if (expanded) loadTeams(); }, [expanded]);

  async function loadTeams() {
    const { data } = await supabase
      .from('battle_teams')
      .select('*, players(name, belegarth_name)')
      .eq('battle_id', battle.id);
    setTeams(data || []);
  }

  async function declareWinner(teamNumber) {
    await supabase.from('battles')
      .update({ winning_team: battle.winning_team === teamNumber ? null : teamNumber })
      .eq('id', battle.id);
    onChange();
  }

  async function adjustStat(rowId, field, delta, current) {
    const next = Math.max(0, (current || 0) + delta);
    await supabase.from('battle_teams').update({ [field]: next }).eq('id', rowId);
    await loadTeams();
  }

  async function deleteBattle() {
    if (!confirm('Delete this battle and its team assignments?')) return;
    await supabase.from('battles').delete().eq('id', battle.id);
    onChange();
  }

  const date = battle.sessions?.session_date
    ? new Date(battle.sessions.session_date + 'T00:00:00').toLocaleDateString()
    : new Date(battle.played_at).toLocaleDateString();

  // Group teams
  const grouped = teams ? teams.reduce((m, t) => {
    (m[t.team_number] ||= []).push(t);
    return m;
  }, {}) : {};

  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-cream-50/40 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-grass-100/60 flex items-center justify-center">
            <Swords className="w-5 h-5 text-grass-700" />
          </div>
          <div>
            <div className="font-medium">{battle.battle_games?.name || 'Battle'}</div>
            <div className="text-xs text-ink-700/50">{date}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {battle.winning_team && (
            <span className="pill bg-grass-600/20 text-grass-700 border border-grass-600/30">
              <Trophy className="w-3 h-3 mr-1" /> Team {battle.winning_team}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-grass-100 p-4 bg-cream-50/30">
          {!teams ? (
            <p className="text-sm text-ink-700/50">Loading...</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([num, members]) => {
                const teamNumber = Number(num);
                const isWinner = battle.winning_team === teamNumber;
                return (
                  <div key={num}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-display text-grass-700">
                        Team {num}
                        {isWinner && <Trophy className="inline w-4 h-4 ml-2 text-yellow-500" />}
                      </h4>
                      <button
                        onClick={() => declareWinner(teamNumber)}
                        className={`text-xs ${isWinner ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        <Trophy className="w-3 h-3" />
                        {isWinner ? 'Winner' : 'Mark Winner'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-sm bg-cream-50/40 rounded px-3 py-1.5">
                          <span>{m.players?.belegarth_name || m.players?.name}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <StatPicker label="K" value={m.kills}
                              onMinus={() => adjustStat(m.id, 'kills', -1, m.kills)}
                              onPlus={() => adjustStat(m.id, 'kills', 1, m.kills)} />
                            <StatPicker label="D" value={m.deaths}
                              onMinus={() => adjustStat(m.id, 'deaths', -1, m.deaths)}
                              onPlus={() => adjustStat(m.id, 'deaths', 1, m.deaths)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-end">
                <button onClick={deleteBattle} className="btn-ghost text-xs text-grass-700">
                  Delete battle
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatPicker({ label, value, onMinus, onPlus }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-ink-700/50 w-3">{label}</span>
      <button onClick={onMinus} className="w-6 h-6 rounded bg-grass-100 hover:bg-grass-200 flex items-center justify-center">
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-6 text-center font-medium">{value || 0}</span>
      <button onClick={onPlus} className="w-6 h-6 rounded bg-grass-100 hover:bg-grass-200 flex items-center justify-center">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}
