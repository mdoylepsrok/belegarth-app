import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Dices, Shuffle, Save, Trophy, RefreshCw, Plus, Minus,
  CheckCircle2, Swords, PlayCircle, Trash2, UserPlus, X, Check,
  Timer, Play, Pause, RotateCcw, Heart, UserX, User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { balanceTeams, buildFfaLineup, pickRandomBattle, pickTeamLabels, teamTotal } from '../lib/teamBalancer';

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [signedIn, setSignedIn] = useState(new Set());
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamLabels, setTeamLabels] = useState([]);
  const [currentBattleId, setCurrentBattleId] = useState(null);
  const [battleStats, setBattleStats] = useState({});
  const [teamLives, setTeamLives] = useState({});
  const [teamLifeRowIds, setTeamLifeRowIds] = useState({});
  const [showWalkup, setShowWalkup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  const sessionRef = useRef(null);
  const battleRef = useRef(null);

  const isFFA = selectedGame?.format === 'ffa';

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    await Promise.all([checkExistingSession(), loadPlayers(), loadGames()]);
    setLoading(false);
  }

  // Realtime: sign-ins
  useEffect(() => {
    if (sessionRef.current) {
      supabase.removeChannel(sessionRef.current);
      sessionRef.current = null;
    }
    if (!session) return;

    const ch = supabase
      .channel(`session-${session.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sign_ins', filter: `session_id=eq.${session.id}` },
        () => refreshSignIns()
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players' },
        () => loadPlayers()
      )
      .subscribe();
    sessionRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [session?.id]);

  // Realtime: battle stats + lives
  useEffect(() => {
    if (battleRef.current) {
      supabase.removeChannel(battleRef.current);
      battleRef.current = null;
    }
    if (!currentBattleId) return;

    const ch = supabase
      .channel(`battle-${currentBattleId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'battle_teams', filter: `battle_id=eq.${currentBattleId}` },
        (payload) => {
          setBattleStats((prev) => {
            const playerId = payload.new.player_id;
            if (!prev[playerId]) return prev;
            return {
              ...prev,
              [playerId]: { ...prev[playerId], kills: payload.new.kills, deaths: payload.new.deaths }
            };
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'battle_team_lives', filter: `battle_id=eq.${currentBattleId}` },
        (payload) => {
          setTeamLives((prev) => ({ ...prev, [payload.new.team_number]: payload.new.lives_remaining }));
        }
      )
      .subscribe();
    battleRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [currentBattleId]);

  async function refreshSignIns() {
    if (!session) return;
    const { data: ins } = await supabase
      .from('sign_ins').select('player_id').eq('session_id', session.id);
    setSignedIn(new Set((ins || []).map((r) => r.player_id)));
  }

  async function checkExistingSession() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('sessions').select('*').eq('session_date', today).maybeSingle();
    setSession(data || null);
    if (data) {
      const { data: ins } = await supabase
        .from('sign_ins').select('player_id').eq('session_id', data.id);
      setSignedIn(new Set((ins || []).map((r) => r.player_id)));
    }
  }

  async function startSession() {
    setStarting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('sessions').insert({ session_date: today }).select().single();
      if (error) throw error;
      setSession(data);
      setSignedIn(new Set());
    } catch (err) {
      alert('Could not start session: ' + err.message);
    } finally {
      setStarting(false);
    }
  }

  function endSession() {
    if (!confirm("End today's session? Sign-ins and battles stay in history.")) return;
    setSession(null);
    setSignedIn(new Set());
    resetBattle();
  }

  async function deleteSession() {
    if (!session) return;
    if (!confirm("Delete today's session entirely? Removes all sign-ins and battles for today.")) return;
    await supabase.from('sessions').delete().eq('id', session.id);
    setSession(null);
    setSignedIn(new Set());
    resetBattle();
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
    if (!confirm('Clear all sign-ins for today?')) return;
    await supabase.from('sign_ins').delete().eq('session_id', session.id);
    setSignedIn(new Set());
  }

  async function addWalkup({ name, belegarth_name, skill_rating }) {
    if (!session || !name?.trim()) return;
    const { data: newPlayer, error } = await supabase
      .from('players')
      .insert({
        name: name.trim(),
        belegarth_name: belegarth_name?.trim() || null,
        skill_rating: Number(skill_rating) || 5,
        active: true
      })
      .select().single();
    if (error) { alert(error.message); return; }
    await supabase.from('sign_ins').insert({ session_id: session.id, player_id: newPlayer.id });
    setShowWalkup(false);
    await loadPlayers();
    await refreshSignIns();
  }

  const presentPlayers = useMemo(
    () => players.filter((p) => signedIn.has(p.id)),
    [players, signedIn]
  );

  function pickBattle() {
    const game = pickRandomBattle(games, presentPlayers.length);
    if (!game) {
      alert(presentPlayers.length === 0
        ? 'Sign in some fighters first.'
        : `No battles in the random pool work for ${presentPlayers.length} fighter(s). Add more battle types or sign in more fighters.`);
      return;
    }
    setSelectedGame(game);
    resetBattle();
  }

  function resetBattle() {
    setTeams([]);
    setCurrentBattleId(null);
    setBattleStats({});
    setTeamLives({});
    setTeamLifeRowIds({});
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

    let lineup, labels;
    if (selectedGame.format === 'ffa') {
      lineup = buildFfaLineup(presentPlayers);
      labels = lineup.map((t) => t[0].belegarth_name || t[0].name);
    } else {
      const tc = selectedGame.team_count || 2;
      lineup = balanceTeams(presentPlayers, tc);
      labels = pickTeamLabels(tc);
    }
    setTeams(lineup);
    setTeamLabels(labels);
    setCurrentBattleId(null);
    setBattleStats({});
    setTeamLives({});
  }

  async function startBattle() {
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

      const stats = {};
      insertedRows.forEach((r) => {
        stats[r.player_id] = { rowId: r.id, kills: 0, deaths: 0 };
      });
      setBattleStats(stats);

      if (selectedGame.lives_per_team > 0) {
        const lifeRows = teams.map((_, idx) => ({
          battle_id: battle.id,
          team_number: idx + 1,
          lives_remaining: selectedGame.lives_per_team
        }));
        const { data: insertedLives, error: lErr } = await supabase
          .from('battle_team_lives').insert(lifeRows).select();
        if (lErr) throw lErr;
        const lives = {};
        const ids = {};
        insertedLives.forEach((r) => {
          lives[r.team_number] = r.lives_remaining;
          ids[r.team_number] = r.id;
        });
        setTeamLives(lives);
        setTeamLifeRowIds(ids);
      }

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
    setBattleStats((prev) => ({ ...prev, [playerId]: { ...entry, [field]: next } }));
    await supabase.from('battle_teams').update({ [field]: next }).eq('id', entry.rowId);
  }

  async function adjustTeamLives(teamNumber, delta) {
    const rowId = teamLifeRowIds[teamNumber];
    if (!rowId) return;
    const current = teamLives[teamNumber] || 0;
    const next = Math.max(0, current + delta);
    setTeamLives((prev) => ({ ...prev, [teamNumber]: next }));
    await supabase.from('battle_team_lives').update({ lives_remaining: next }).eq('id', rowId);
  }

  async function declareWinner(teamNumber) {
    if (!currentBattleId) return;
    await supabase.from('battles').update({ winning_team: teamNumber }).eq('id', currentBattleId);
    await loadPlayers();
  }

  async function nextBattle() {
    if (currentBattleId) await loadPlayers();
    setSelectedGame(null);
    resetBattle();
  }

  if (loading) return <Loading />;

  if (!session) {
    return (
      <div className="card p-8 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-grass-100 mx-auto mb-4 flex items-center justify-center">
          <PlayCircle className="w-8 h-8 text-grass-600" />
        </div>
        <h2 className="text-2xl font-display mb-2">No session today</h2>
        <p className="text-sm text-ink-700/60 mb-6">
          Start a session when fighters arrive at the park.
        </p>
        <button onClick={startSession} disabled={starting} className="btn-primary justify-center w-full">
          <PlayCircle className="w-5 h-5" /> {starting ? 'Starting...' : "Start Today's Session"}
        </button>
        <p className="text-xs text-ink-700/40 mt-4">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sign-in section */}
      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-display">Sign-In</h2>
            <p className="text-sm text-ink-700/60">
              <span className="font-semibold text-grass-700">{signedIn.size}</span> of {players.length} present
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setShowWalkup(true)} className="btn-accent text-sm">
              <UserPlus className="w-4 h-4" /> Walk-up
            </button>
            <button onClick={signInAll} className="btn-secondary text-sm">All in</button>
            <button onClick={signOutAll} className="btn-ghost text-sm">Clear</button>
            <button onClick={endSession} className="btn-ghost text-sm">End</button>
            <button onClick={deleteSession} className="btn-ghost text-sm text-sun-600" title="Delete this session">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showWalkup && (
          <WalkupForm onAdd={addWalkup} onCancel={() => setShowWalkup(false)} />
        )}

        {players.length === 0 ? (
          <p className="text-ink-700/60 text-sm">
            No active players yet. Add some in the Roster tab or use Walk-up.
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
      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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
              <Shuffle className="w-4 h-4" /> {isFFA ? 'Set Lineup' : 'Assign Teams'}
            </button>
          </div>
        </div>

        {selectedGame ? (
          <div className="bg-cream-100 border border-grass-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <h3 className="font-display text-lg text-grass-700">{selectedGame.name}</h3>
              <div className="flex gap-1.5 text-xs flex-wrap">
                {isFFA ? (
                  <span className="pill bg-sun-500/20 text-sun-600"><User className="w-3 h-3 mr-0.5" /> Free-for-all</span>
                ) : (
                  <span className="pill bg-grass-100 text-grass-700">{selectedGame.team_count} teams</span>
                )}
                <span className="pill bg-grass-100 text-grass-700">Min {selectedGame.min_players}</span>
                {selectedGame.timer_mode !== 'none' && (
                  <span className="pill bg-sky-100 text-sky-600"><Timer className="w-3 h-3 mr-0.5" /> {selectedGame.timer_mode === 'countdown' ? formatTime(selectedGame.timer_seconds) : 'stopwatch'}</span>
                )}
                {selectedGame.lives_per_team > 0 && (
                  <span className="pill bg-cream-200 text-sun-600">
                    <Heart className="w-3 h-3 mr-0.5" />
                    {selectedGame.lives_per_team} {isFFA ? 'lives/fighter' : 'lives'}
                  </span>
                )}
              </div>
            </div>
            {selectedGame.description && (
              <p className="text-sm text-ink-700/80 mb-2">{selectedGame.description}</p>
            )}
            {selectedGame.rules && (
              <p className="text-sm text-ink-700/60 italic whitespace-pre-line">{selectedGame.rules}</p>
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

      {/* Active battle controls (timer + lives) */}
      {currentBattleId && selectedGame && (
        <BattleControls
          game={selectedGame}
          teams={teams}
          teamLabels={teamLabels}
          teamLives={teamLives}
          onAdjustLives={adjustTeamLives}
          isFFA={isFFA}
        />
      )}

      {/* Lineup */}
      {teams.length > 0 && (
        <section className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-display">{isFFA ? 'Fighters' : 'Team Assignments'}</h2>
            <div className="flex gap-2">
              {!currentBattleId ? (
                <>
                  <button onClick={assignTeams} className="btn-ghost text-sm">
                    <RefreshCw className="w-4 h-4" /> {isFFA ? 'Reshuffle' : 'Reshuffle'}
                  </button>
                  <button onClick={startBattle} disabled={saving} className="btn-primary text-sm">
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

          {isFFA ? (
            <FFAGrid
              teams={teams}
              teamLabels={teamLabels}
              battleStats={battleStats}
              currentBattleId={currentBattleId}
              onAdjustStat={adjustStat}
              onDeclareWinner={declareWinner}
            />
          ) : (
            <TeamGrid
              teams={teams}
              teamLabels={teamLabels}
              battleStats={battleStats}
              currentBattleId={currentBattleId}
              onAdjustStat={adjustStat}
              onDeclareWinner={declareWinner}
            />
          )}
        </section>
      )}
    </div>
  );
}

// === SUB-COMPONENTS ===

function TeamGrid({ teams, teamLabels, battleStats, currentBattleId, onAdjustStat, onDeclareWinner }) {
  return (
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
                          onMinus={() => onAdjustStat(p.id, 'kills', -1)}
                          onPlus={() => onAdjustStat(p.id, 'kills', 1)}
                        />
                        <Counter
                          label="D" value={stats.deaths}
                          onMinus={() => onAdjustStat(p.id, 'deaths', -1)}
                          onPlus={() => onAdjustStat(p.id, 'deaths', 1)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {currentBattleId && (
              <button
                onClick={() => onDeclareWinner(teamNumber)}
                className="mt-3 w-full btn-secondary text-xs justify-center"
              >
                <Trophy className="w-3 h-3" /> {label} Won
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FFAGrid({ teams, teamLabels, battleStats, currentBattleId, onAdjustStat, onDeclareWinner }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {teams.map((team, idx) => {
        const player = team[0];
        const stats = battleStats[player.id];
        const teamNumber = idx + 1;
        const label = teamLabels[idx] || player.name;
        return (
          <div key={player.id} className="bg-cream-50 border border-grass-200 rounded-lg p-2.5">
            <div className="text-center mb-2">
              <div className="font-semibold text-sm truncate">{label}</div>
              {!stats && (
                <div className="text-xs text-ink-700/40">Skill {Number(player.skill_rating).toFixed(1)}</div>
              )}
            </div>
            {stats && (
              <div className="flex items-center justify-center gap-2 text-xs mb-2">
                <Counter
                  label="K" value={stats.kills}
                  onMinus={() => onAdjustStat(player.id, 'kills', -1)}
                  onPlus={() => onAdjustStat(player.id, 'kills', 1)}
                />
                <Counter
                  label="D" value={stats.deaths}
                  onMinus={() => onAdjustStat(player.id, 'deaths', -1)}
                  onPlus={() => onAdjustStat(player.id, 'deaths', 1)}
                />
              </div>
            )}
            {currentBattleId && (
              <button
                onClick={() => onDeclareWinner(teamNumber)}
                className="w-full btn-secondary text-xs justify-center px-1"
              >
                <Trophy className="w-3 h-3" /> Winner
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WalkupForm({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [skill, setSkill] = useState(5);

  function submit() {
    if (!name.trim()) {
      alert('Name required.');
      return;
    }
    onAdd({ name, belegarth_name: fieldName, skill_rating: skill });
  }

  return (
    <div className="bg-grass-50 border-2 border-grass-200 rounded-lg p-3 mb-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-grass-700 text-sm">Quick add walk-up</h3>
        <button onClick={onCancel} className="p-1 hover:bg-cream-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          autoFocus
          className="input w-full" placeholder="Real name *"
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <input
          className="input w-full" placeholder="Field name (optional)"
          value={fieldName} onChange={(e) => setFieldName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-700/60 w-24">Skill: {Number(skill).toFixed(1)}</span>
        <input
          type="range" min="1" max="10" step="0.5"
          value={skill} onChange={(e) => setSkill(e.target.value)}
          className="flex-1 accent-grass-600"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
        <button onClick={submit} className="btn-primary text-sm">
          <Check className="w-4 h-4" /> Add & Sign in
        </button>
      </div>
    </div>
  );
}

function BattleControls({ game, teams, teamLabels, teamLives, onAdjustLives, isFFA }) {
  const hasTimer = game.timer_mode !== 'none';
  const hasLives = game.lives_per_team > 0;
  if (!hasTimer && !hasLives) return null;

  return (
    <section className="card p-4 sm:p-5 bg-gradient-to-br from-grass-50 to-cream-50 border-grass-200">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {hasTimer && (
          <div className={hasLives ? 'lg:w-1/2' : 'flex-1'}>
            <BattleTimer mode={game.timer_mode} targetSeconds={game.timer_seconds} />
          </div>
        )}
        {hasLives && (
          <div className={hasTimer ? 'lg:w-1/2' : 'flex-1'}>
            <Lives
              teams={teams}
              teamLabels={teamLabels}
              teamLives={teamLives}
              onAdjust={onAdjustLives}
              isFFA={isFFA}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function BattleTimer({ mode, targetSeconds }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [alarmed, setAlarmed] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  useEffect(() => {
    if (mode === 'countdown' && !alarmed && elapsed >= targetSeconds && targetSeconds > 0) {
      setAlarmed(true);
      setRunning(false);
      playAlarm();
    }
  }, [elapsed, mode, targetSeconds, alarmed]);

  function playAlarm() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.4, 0.8].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      });
    } catch {}
  }

  function reset() {
    setRunning(false);
    setElapsed(0);
    setAlarmed(false);
  }

  const display = mode === 'countdown'
    ? Math.max(0, targetSeconds - elapsed)
    : elapsed;
  const m = Math.floor(display / 60);
  const s = display % 60;
  const isFinished = mode === 'countdown' && elapsed >= targetSeconds && targetSeconds > 0;

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Timer className="w-4 h-4 text-grass-700" />
        <span className="text-sm font-semibold text-ink-700/70">
          {mode === 'countdown' ? 'Time Remaining' : 'Time Elapsed'}
        </span>
      </div>
      <div className={`font-display text-6xl sm:text-7xl tabular-nums leading-none mb-3 ${
        isFinished ? 'text-sun-600 animate-pulse' : 'text-ink-900'
      }`}>
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </div>
      <div className="flex items-center justify-center gap-2">
        {!running ? (
          <button onClick={() => setRunning(true)} disabled={isFinished} className="btn-primary disabled:opacity-40">
            <Play className="w-4 h-4" /> {elapsed === 0 ? 'Start' : 'Resume'}
          </button>
        ) : (
          <button onClick={() => setRunning(false)} className="btn-secondary">
            <Pause className="w-4 h-4" /> Pause
          </button>
        )}
        <button onClick={reset} className="btn-ghost">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
}

function Lives({ teams, teamLabels, teamLives, onAdjust, isFFA }) {
  // Use a denser grid for FFA (many one-person "teams")
  const gridClass = isFFA
    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
    : (teams.length === 2 ? 'grid-cols-2' : teams.length === 3 ? 'grid-cols-3' : 'grid-cols-2');

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-3">
        <Heart className="w-4 h-4 text-sun-600" />
        <span className="text-sm font-semibold text-ink-700/70">
          {isFFA ? 'Fighter Lives' : 'Team Lives'}
        </span>
      </div>
      <div className={`grid gap-2 ${gridClass}`}>
        {teams.map((_, idx) => {
          const teamNumber = idx + 1;
          const label = teamLabels[idx] || `Team ${teamNumber}`;
          const lives = teamLives[teamNumber] ?? 0;
          const dead = lives === 0;
          const compact = isFFA;
          return (
            <div key={idx} className={`rounded-lg ${compact ? 'p-2' : 'p-3'} border-2 ${
              dead ? 'bg-ink-700/10 border-ink-700/20' : 'bg-white border-grass-200'
            }`}>
              <div className={`text-center ${compact ? 'text-xs' : 'text-sm'} font-semibold mb-1 truncate ${
                dead ? 'text-ink-700/40 line-through' : 'text-grass-700'
              }`}>
                {label}
              </div>
              <div className={`text-center font-display ${compact ? 'text-2xl' : 'text-4xl'} tabular-nums leading-none mb-2 ${
                dead ? 'text-ink-700/30' : 'text-ink-900'
              }`}>
                {lives}
              </div>
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => onAdjust(teamNumber, -1)}
                  disabled={dead}
                  className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-lg bg-sun-500 hover:bg-sun-400 text-white flex items-center justify-center disabled:opacity-30 transition shadow-sm`}
                  title="Death"
                >
                  <Minus className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                </button>
                <button
                  onClick={() => onAdjust(teamNumber, 1)}
                  className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-lg bg-grass-100 hover:bg-grass-200 text-grass-700 flex items-center justify-center transition`}
                  title="Undo death / add life"
                >
                  <Plus className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Counter({ label, value, onMinus, onPlus }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-ink-700/50 w-3">{label}</span>
      <button onClick={onMinus} className="w-7 h-7 rounded bg-grass-100 hover:bg-grass-200 flex items-center justify-center transition">
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-6 text-center font-semibold tabular-nums">{value || 0}</span>
      <button onClick={onPlus} className="w-7 h-7 rounded bg-grass-100 hover:bg-grass-200 flex items-center justify-center transition">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-ink-700/50">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
    </div>
  );
}
