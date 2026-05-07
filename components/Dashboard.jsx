import { useEffect, useState, useMemo } from 'react';
import {
  Dices, Shuffle, UserCheck, UserX, Save, Trophy, RefreshCw, Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { balanceTeams, pickRandomBattle, pickTeamLabels, teamTotal } from '../lib/teamBalancer';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);   // includes stats
  const [signedIn, setSignedIn] = useState(new Set());
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [teams, setTeams] = useState([]);       // [[player,...], ...]
  const [teamLabels, setTeamLabels] = useState([]);
  const [currentBattleId, setCurrentBattleId] = useState(null);
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
  }

  async function saveBattle() {
    if (!session || !selectedGame || !teams.length) return;
    setSaving(true);
    try {
      // Create battle
      const { data: battle, error: bErr } = await supabase
        .from('battles')
        .insert({ session_id: session.id, game_id: selectedGame.id })
        .select().single();
      if (bErr) throw bErr;

      // Insert team assignments
      const rows = [];
      teams.forEach((team, idx) => {
        team.forEach((p) => {
          rows.push({ battle_id: battle.id, player_id: p.id, team_number: idx + 1 });
        });
      });
      const { error: tErr } = await supabase.from('battle_teams').insert(rows);
      if (tErr) throw tErr;
      setCurrentBattleId(battle.id);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function declareWinner(teamNumber) {
    if (!currentBattleId) return;
    await supabase.from('battles').update({ winning_team: teamNumber }).eq('id', currentBattleId);
    alert(`Team ${teamNumber} declared winner.`);
    await loadPlayers();
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {/* Sign-in section */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-display">Tonight's Sign-In</h2>
            <p className="text-sm text-ink-700/60">
              {session?.session_date && new Date(session.session_date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric'
              })}{' · '}{signedIn.size} of {players.length} present
            </p>
          </div>
          <div className="flex gap-2">
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
                  className={`text-left px-3 py-2 rounded border transition ${
                    here
                      ? 'bg-grass-100 border-grass-600/50'
                      : 'bg-cream-50 border-grass-100 hover:border-grass-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {here ? (
                      <UserCheck className="w-4 h-4 text-grass-700 flex-shrink-0" />
                    ) : (
                      <UserX className="w-4 h-4 text-ink-700/40 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {p.belegarth_name || p.name}
                      </div>
                      {p.belegarth_name && (
                        <div className="text-xs text-ink-700/50 truncate">{p.name}</div>
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
            <button onClick={pickBattle} className="btn-primary">
              <Dices className="w-4 h-4" /> Random Battle
            </button>
            <button
              onClick={assignTeams}
              disabled={!selectedGame || presentPlayers.length < (selectedGame?.min_players || 2)}
              className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Shuffle className="w-4 h-4" /> Assign Teams
            </button>
          </div>
        </div>

        {selectedGame ? (
          <div className="space-y-3">
            <div className="bg-cream-50/60 border border-grass-100 rounded-md p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-display text-lg text-grass-700">{selectedGame.name}</h3>
                <div className="flex gap-2 text-xs">
                  <span className="pill bg-grass-100 text-ink-700/80">
                    {selectedGame.team_count} teams
                  </span>
                  <span className="pill bg-grass-100 text-ink-700/80">
                    Min {selectedGame.min_players}
                  </span>
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
                <p className="text-xs text-grass-700 mt-2">
                  Need {selectedGame.min_players - presentPlayers.length} more player(s) to run this.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-ink-700/60 text-sm">
            Click <strong>Random Battle</strong> to draw one from your pre-chosen pool.
          </p>
        )}
      </section>

      {/* Teams */}
      {teams.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-display">Team Assignments</h2>
            <div className="flex gap-2">
              <button onClick={assignTeams} className="btn-ghost text-sm">
                <RefreshCw className="w-4 h-4" /> Reshuffle
              </button>
              {!currentBattleId && (
                <button onClick={saveBattle} disabled={saving} className="btn-primary text-sm">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Battle'}
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
              return (
                <div key={idx} className="bg-cream-50/60 border border-grass-100 rounded-md p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-grass-700 text-lg">{label}</h3>
                    <span className="text-xs text-ink-700/50">
                      {team.length} · {total.toFixed(0)} pts
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {team.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{p.belegarth_name || p.name}</span>
                        <span className="text-xs text-ink-700/40 ml-2">
                          {Number(p.skill_rating).toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {currentBattleId && (
                    <button
                      onClick={() => declareWinner(idx + 1)}
                      className="mt-3 w-full btn-secondary text-xs justify-center"
                    >
                      <Trophy className="w-3 h-3" /> Declare {label} winner
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {currentBattleId && (
            <p className="text-xs text-ink-700/50 mt-4">
              Battle saved. Declare a winner to credit the win, or move on to the next round.
            </p>
          )}
        </section>
      )}
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
