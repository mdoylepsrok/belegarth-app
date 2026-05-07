import { useEffect, useState, useMemo } from 'react';
import {
  Dices, Shuffle, UserCheck, UserX, Save, Trophy, RefreshCw,
  Plus, Minus, History as HistoryIcon, CheckCircle2, Swords
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { balanceTeams, pickRandomBattle, pickTeamLabels, teamTotal } from '../lib/teamBalancer';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [previousSession, setPreviousSession] = useState(null);
  const [previousAttendees, setPreviousAttendees] = useState([]);
  const [players, setPlayers] = useState([]);
  const [signedIn, setSignedIn] = useState(new Set());
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamLabels, setTeamLabels] = useState([]);
  const [currentBattleId, setCurrentBattleId] = useState(null);
  const [battleStats, setBattleStats] = useState({});  // { battleTeamRowId: {kills, deaths} }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    await Promise.all([loadOrCreateSession(), loadPlayers(), loadGames()]);
    setLoading(false);
  }

  async function loadOrCreateSession() {
    const today = new Date().toISOString().slice(0, 10);

    // Today's session
    let { data } = await supabase.from('sessions').select('*').eq('session_date', today).maybeSingle();
    if (!data) {
      const { data: created } = await supabase
        .from('sessions').insert({ session_date: today }).select().single();
      data = created;
    }
    setSession(data);

    if (data) {
      const { data: ins } = await supabase
        .from('sign_ins').select('player_id').eq('session_id', data.id);
      setSignedIn(new Set((ins || []).map((r) => r.player_id)));
    }

    // Most recent prior session (for "copy from last session")
    const { data: prior } = await supabase
      .from('sessions').select('*')
      .lt('session_date', today)
      .order('session_date', { ascending: false })
      .limit(1).maybeSingle();
    if (prior) {
      setPreviousSession(prior);
      const { data: priorIns } = await supabase
        .from('sign_ins').select('player_id').eq('session_id', prior.id);
      setPreviousAttendees((priorIns || []).map((r) => r.player_id));
    }
  }

  async function loadPlayers() {
    const { data } = await supabase
      .from('player_stats').select('*').eq('active', true).order('name');
    setPlayers(data || []);
  }

  async function loadGames() {
    const { data } = await supabase.from('battle_games').select('*').order('name');
    setGames(data || []);
  }

  async function toggleSignIn(playerId) {
    if (!session) return;
    const next = new Set(signedIn);
    if (next.has(playerId)) {
      next.delete(playerId);
      await supabase.from('sign_ins')
        .delete().eq('session_id', session.id).eq('player_id', playerId);
    } else {
      next.add(playerId);
      await supabase.from('sign_ins').insert({ session_id: session.id, player_id: playerId });
    }
    setSignedIn(next);
  }

  async function copyFromLast() {
    if (!session || !previousAttendees.length) return;
    const newOnes = previousAttendees.filter((id) => !signedIn.has(id));
    if (!newOnes.length) {
      alert("Already matches last session's roster.");
      return;
    }
    const rows = newOnes.map((id) => ({ session_id: session.id, player_id: id }));
    await supabase.from('sign_ins').insert(rows);
    setSignedIn(new Set([...signedIn, ...newOnes]));
  }

  async function signInAll() {
    if (!session) return;
    const missing = players.filter((p) => !signedIn.has(p.id));
    if (!missing.length) return;
    const rows = missing.map((p) => ({ session_id: session.id, player_id: p.id }));
    await supabase.from('sign_ins').insert(rows);
    setSignedIn(new Set(players.map((p) => p.id)));
  }

  async function signOutAll() {
    if (!session) return;
    if (!confirm('Clear all sign-ins for today?')) return;
    await supabase.from('sign_ins').delete().eq('session_id', session.id);
    setSignedIn(new Set());
  }

  const presentPlayers = useMemo(
    () => players.filter((p) => signedIn.has(p.id)),
    [players, signedIn]
  );

  function pickBattle() {
    const game = pickRandomBattle(games);
    if (!game) {
      alert('No battle games in the random pool. Add some in the Battle Library.');
      return;
    }
    setSelectedGame(game);
    setTeams([]);
    setCurrentBattleId(null);
    setBattleStats({});
  }

  function assignTeams() {
    if (!selectedGame) {
      alert('Pick a battle first.');
      return;
    }
    if (presentPlayers.length < (selectedGame.min_players || 2)) {
      alert(`Need at least ${selectedGame.min_players} players for ${selectedGame.name}.`);
      return;
    }
    const tc = selectedGame.team_count || 2;
    const balanced = balanceTeams(presentPlayers, tc);
    setTeams(balanced);
    setTeamLabels(pickTeamLabels(tc));
    setCurrentBattleId(null);
    setBattleStats({});
  }

  async function saveBattle() {
    if (!session || !selectedGame || !teams.length) return;
    setSaving(true);
    try {
      const { data: battle, error: bErr } = await supabase
        .from('battles')
        .insert({ session_id: session.id, game_id: selectedGame.id })
        .select().single();
      if (bErr) throw bErr;

      const rows = [];
      teams.forEach((team, idx) => {
        team.forEach((p) => {
          rows.push({ battle_id: battle.id, player_id: p.id, team_number: idx + 1 });
        });
      });
      const { data: insertedRows, error: tErr } = await supabase
        .from('battle_teams').insert(rows).select();
      if (tErr) throw tErr;

      // Build mapping: player_id → battle_team row id, so the inline counters can update them
      const stats = {};
      insertedRows.forEach((r) => {
        stats[r.player_id] = { rowId: r.id, kills: 0, deaths: 0 };
      });
      setBattleStats(stats);
      setCurrentBattleId(battle.id);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function adjustStat(playerId, field, delta) {
    const entry = battleStats[playerId];
    if (!entry) return;
    const next = Math.max(0, (entry[field] || 0) + delta);
    const updated = { ...battleStats, [playerId]: { ...entry, [field]: next } };
    setBattleStats(updated);
    await supabase.from('battle_teams').update({ [field]: next }).eq('id', entry.rowId);
  }

  async function declareWinner(teamNumber) {
    if (!currentBattleId) return;
    await supabase.from('battles').update({ winning_team: teamNumber }).eq('id', currentBattleId);
    await loadPlayers();
    alert(`Team ${teamNumber} declared winner. Stats updated.`);
  }

  async function nextBattle() {
    if (currentBattleId) {
      await loadPlayers();  // refresh stats
    }
    setSelectedGame(null);
    setTeams([]);
    setCurrentBattleId(null);
    setBattleStats({});
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {/* Sign-in section */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-display">Sign-In</h2>
            <p className="text-sm text-ink-700/60">
              {session?.session_date && new Date(session.session_date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric'
              })}{' · '}
              <span className="font-semibold text-grass-700">{signedIn.size}</span> of {players.length} present
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {previousSession && previousAttendees.length > 0 && (
              <button onClick={copyFromLast} className="btn-secondary text-sm" title={`Copy ${previousAttendees.length} attendees from ${previousSession.session_date}`}>
                <HistoryIcon className="w-4 h-4" /> Copy last session
              </button>
            )}
            <button onClick={signInAll} className="btn-secondary text-sm">All in</button>
            <button onClick={signOutAll} className="btn-ghost text-sm">Clear</button>
          </div>
        </div>

        {players.length === 0 ? (
          <p className="text-ink-700/60 text-sm">
            No active players yet. Add some in the Roster tab.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {players.map((p) => {
              const here = signedIn.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleSignIn(p.id)}
                  className={`text-left px-3 py-2.5 rounded-lg border-2 transition ${
                    here
                      ? 'bg-grass-500 border-grass-600 text-white shadow-sm hover:bg-grass-600'
                      : 'bg-cream-50 border-grass-100 text-ink-700/70 hover:border-grass-200 hover:bg-white opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {here ? (
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <UserX className="w-5 h-5 flex-shrink-0 opacity-50" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {p.belegarth_name || p.name}
                      </div>
                      {p.belegarth_name && (
                        <div className={`text-xs truncate ${here ? 'text-cream-100' : 'text-ink-700/50'}`}>
                          {p.name}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Battle picker */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl font-display">Battle Selection</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={pickBattle} className="btn-accent">
              <Dices className="w-4 h-4" /> Random Battle
            </button>
            <button
              onClick={assignTeams}
              disabled={!selectedGame || presentPlayers.length < (selectedGame?.min_players || 2)}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Shuffle className="w-4 h-4" /> Assign Teams
            </button>
          </div>
        </div>

        {selectedGame ? (
          <div className="bg-cream-100 border border-grass-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-display text-lg text-grass-700">{selectedGame.name}</h3>
              <div className="flex gap-2 text-xs">
                <span className="pill bg-grass-100 text-grass-700">{selectedGame.team_count} teams</span>
                <span className="pill bg-grass-100 text-grass-700">Min {selectedGame.min_players}</span>
              </div>
            </div>
            {selectedGame.description && (
              <p className="text-sm text-ink-700/80 mb-2">{selectedGame.description}</p>
            )}
            {selectedGame.rules && (
              <p className="text-sm text-ink-700/60 italic whitespace-pre-line">
                {selectedGame.rules}
              </p>
            )}
            {presentPlayers.length < selectedGame.min_players && (
              <p className="text-xs text-sun-600 mt-2 font-semibold">
                Need {selectedGame.min_players - presentPlayers.length} more player(s) to run this.
              </p>
            )}
          </div>
        ) : (
          <p className="text-ink-700/60 text-sm">
            Hit <strong>Random Battle</strong> to draw one from your pool.
          </p>
        )}
      </section>

      {/* Teams */}
      {teams.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-display">Team Assignments</h2>
            <div className="flex gap-2">
              {!currentBattleId ? (
                <>
                  <button onClick={assignTeams} className="btn-ghost text-sm">
                    <RefreshCw className="w-4 h-4" /> Reshuffle
                  </button>
                  <button onClick={saveBattle} disabled={saving} className="btn-primary text-sm">
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Start Battle'}
                  </button>
                </>
              ) : (
                <button onClick={nextBattle} className="btn-accent text-sm">
                  <Swords className="w-4 h-4" /> Next Battle
                </button>
              )}
            </div>
          </div>

          <div className={`grid gap-4 ${
            teams.length === 2 ? 'md:grid-cols-2' :
            teams.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {teams.map((team, idx) => {
              const total = teamTotal(team);
              const label = teamLabels[idx] || `Team ${idx + 1}`;
              const teamNumber = idx + 1;
              return (
                <div key={idx} className="bg-cream-50 border border-grass-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-grass-700 text-lg">{label}</h3>
                    <span className="text-xs text-ink-700/50">
                      {team.length} · {total.toFixed(0)} pts
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {team.map((p) => {
                      const stats = battleStats[p.id];
                      return (
                        <li key={p.id} className="text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{p.belegarth_name || p.name}</span>
                            {!stats && (
                              <span className="text-xs text-ink-700/40">{Number(p.skill_rating).toFixed(1)}</span>
                            )}
                          </div>
                          {stats && (
                            <div className="flex items-center justify-end gap-3 mt-1 text-xs">
                              <Counter
                                label="K" value={stats.kills}
                                onMinus={() => adjustStat(p.id, 'kills', -1)}
                                onPlus={() => adjustStat(p.id, 'kills', 1)}
                              />
                              <Counter
                                label="D" value={stats.deaths}
                                onMinus={() => adjustStat(p.id, 'deaths', -1)}
                                onPlus={() => adjustStat(p.id, 'deaths', 1)}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {currentBattleId && (
                    <button
                      onClick={() => declareWinner(teamNumber)}
                      className="mt-3 w-full btn-secondary text-xs justify-center"
                    >
                      <Trophy className="w-3 h-3" /> {label} Won
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {currentBattleId && (
            <p className="text-xs text-ink-700/50 mt-4">
              Battle in progress. Tap +/− to track kills and deaths as they happen, then declare a
              winner. When done, hit <strong>Next Battle</strong> to start another round.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Counter({ label, value, onMinus, onPlus }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-ink-700/50 w-3">{label}</span>
      <button onClick={onMinus} className="w-6 h-6 rounded bg-grass-100 hover:bg-grass-200 flex items-center justify-center transition">
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-5 text-center font-semibold tabular-nums">{value || 0}</span>
      <button onClick={onPlus} className="w-6 h-6 rounded bg-grass-100 hover:bg-grass-200 flex items-center justify-center transition">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-ink-700/50">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
    </div>
  );
}
