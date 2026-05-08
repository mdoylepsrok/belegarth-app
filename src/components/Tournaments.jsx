import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Plus, Trash2, Trophy, Crown, Swords, Users, ChevronDown, ChevronRight,
  X, Check, Play, Award, RefreshCw, Minus, AlertCircle, Hash, Dices
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getMatchTarget, formatLabel, generateBracketMatches,
  generateRoundRobinMatches, computeRRStandings, nextMatchSlot
} from '../lib/tournaments';

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
    setTournaments(data || []);
    setLoading(false);
  }

  async function deleteTournament(id) {
    if (!confirm('Delete this tournament and all its matches?')) return;
    await supabase.from('tournaments').delete().eq('id', id);
    if (activeId === id) setActiveId(null);
    await load();
  }

  if (loading) return <p className="text-ink-700/60">Loading...</p>;

  if (activeId) {
    return (
      <TournamentLive
        tournamentId={activeId}
        onBack={() => { setActiveId(null); load(); }}
      />
    );
  }

  const active = tournaments.filter((t) => t.status !== 'completed');
  const completed = tournaments.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display">Tournaments</h2>
          <p className="text-sm text-ink-700/60">
            {active.length} active · {completed.length} completed
          </p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Tournament
          </button>
        )}
      </div>

      {creating && (
        <CreateTournamentForm
          onCreated={(id) => { setCreating(false); setActiveId(id); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-700/70 uppercase tracking-wide">Active</h3>
          {active.map((t) => (
            <TournamentRow key={t.id} tournament={t} onOpen={() => setActiveId(t.id)} onDelete={() => deleteTournament(t.id)} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-700/70 uppercase tracking-wide">Completed</h3>
          {completed.map((t) => (
            <TournamentRow key={t.id} tournament={t} onOpen={() => setActiveId(t.id)} onDelete={() => deleteTournament(t.id)} />
          ))}
        </div>
      )}

      {tournaments.length === 0 && !creating && (
        <div className="card p-8 text-center text-ink-700/50">
          No tournaments yet. Start one to run a warlord pit, bracket, or round robin.
        </div>
      )}
    </div>
  );
}

function TournamentRow({ tournament, onOpen, onDelete }) {
  const typeLabel = {
    warlord: 'Warlord', bracket: 'Bracket', round_robin: 'Round Robin'
  }[tournament.type];
  const statusLabel = {
    pit: 'Pit phase', bracket: 'Bracket phase', round_robin: 'Round robin', final: 'Final', completed: 'Complete'
  }[tournament.status];

  return (
    <div className="card overflow-hidden flex items-center">
      <button onClick={onOpen} className="flex-1 p-4 flex items-center justify-between hover:bg-cream-50 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-grass-100 flex items-center justify-center flex-shrink-0">
            {tournament.status === 'completed' ? (
              <Trophy className="w-5 h-5 text-sun-500" />
            ) : (
              <Swords className="w-5 h-5 text-grass-700" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{tournament.name}</div>
            <div className="text-xs text-ink-700/60 flex flex-wrap gap-x-2">
              <span>{typeLabel}</span>
              <span>·</span>
              <span>{formatLabel(tournament.match_format, tournament.match_target)}</span>
              <span>·</span>
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-700/40" />
      </button>
      <button onClick={onDelete} className="p-3 text-sun-600 hover:bg-cream-100">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// === CREATE FORM ===

function CreateTournamentForm({ onCreated, onCancel }) {
  const [step, setStep] = useState('config');
  const [name, setName] = useState('');
  const [type, setType] = useState('warlord');
  const [format, setFormat] = useState('bo3');
  const [customTarget, setCustomTarget] = useState(2);
  const [bracketSize, setBracketSize] = useState(4);
  const [signedInToday, setSignedInToday] = useState([]);
  const [allActive, setAllActive] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pickFrom, setPickFrom] = useState('signed_in');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadCandidates(); }, []);

  async function loadCandidates() {
    const today = new Date().toISOString().slice(0, 10);
    const { data: session } = await supabase.from('sessions').select('id').eq('session_date', today).maybeSingle();
    if (session) {
      const { data: signIns } = await supabase
        .from('sign_ins').select('player_id, players(*)').eq('session_id', session.id);
      const players = (signIns || []).map((s) => s.players).filter((p) => p?.active);
      setSignedInToday(players);
      setSelectedIds(new Set(players.map((p) => p.id)));
    }
    const { data: all } = await supabase.from('players').select('*').eq('active', true).order('name');
    setAllActive(all || []);
  }

  const candidates = pickFrom === 'signed_in' ? signedInToday : allActive;

  function toggleSelected(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function create() {
    const target = getMatchTarget(format, customTarget);
    const players = candidates.filter((p) => selectedIds.has(p.id));

    // Validate count requirements
    const minRequired = type === 'warlord' ? 4 : (type === 'bracket' ? bracketSize : 3);
    if (players.length < minRequired) {
      alert(`Need at least ${minRequired} fighters for this tournament.`);
      return;
    }
    if (type === 'bracket' && players.length !== bracketSize) {
      alert(`Bracket needs exactly ${bracketSize} fighters. You have ${players.length}.`);
      return;
    }

    setCreating(true);
    try {
      const initialStatus = type === 'warlord' ? 'pit' : (type === 'bracket' ? 'bracket' : 'round_robin');

      const { data: t, error } = await supabase.from('tournaments').insert({
        name: name.trim() || `${type} ${new Date().toLocaleDateString()}`,
        type,
        match_format: format,
        match_target: target,
        bracket_size: bracketSize,
        status: initialStatus
      }).select().single();
      if (error) throw error;

      // Insert participants
      const participantRows = players.map((p) => ({ tournament_id: t.id, player_id: p.id }));
      await supabase.from('tournament_participants').insert(participantRows);

      // For bracket/round_robin, generate matches now. Warlord generates after pit phase.
      if (type === 'bracket') {
        // Seed by skill_rating
        const seeded = [...players].sort((a, b) =>
          Number(b.skill_rating || 5) - Number(a.skill_rating || 5)
        );
        await Promise.all(seeded.map((p, idx) =>
          supabase.from('tournament_participants')
            .update({ seed: idx + 1 })
            .eq('tournament_id', t.id).eq('player_id', p.id)
        ));
        const seededRows = seeded.map((p) => ({ player_id: p.id }));
        const matches = generateBracketMatches(seededRows, bracketSize);
        await supabase.from('tournament_matches').insert(
          matches.map((m) => ({ ...m, tournament_id: t.id }))
        );
      } else if (type === 'round_robin') {
        const partRows = players.map((p) => ({ player_id: p.id }));
        const matches = generateRoundRobinMatches(partRows);
        await supabase.from('tournament_matches').insert(
          matches.map((m) => ({ ...m, tournament_id: t.id }))
        );
      }

      onCreated(t.id);
    } catch (err) {
      alert('Create failed: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-display text-lg">New Tournament</h3>

      <div>
        <label className="label">Name (optional)</label>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday Warlord" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input w-full" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="warlord">Warlord (pit → bracket)</option>
            <option value="bracket">Single-elim bracket</option>
            <option value="round_robin">Round robin</option>
          </select>
        </div>
        <div>
          <label className="label">Match Format</label>
          <select className="input w-full" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="bo3">Best of 3</option>
            <option value="bo5">Best of 5</option>
            <option value="ft10">First to 10</option>
            <option value="custom">First to N</option>
          </select>
        </div>
      </div>

      {format === 'custom' && (
        <div>
          <label className="label">Custom Target (first to ?)</label>
          <input type="number" min="1" max="50" className="input w-full"
            value={customTarget} onChange={(e) => setCustomTarget(Number(e.target.value))} />
        </div>
      )}

      {(type === 'warlord' || type === 'bracket') && (
        <div>
          <label className="label">{type === 'warlord' ? 'Bracket size (after pit)' : 'Bracket size'}</label>
          <div className="flex gap-2">
            {[4, 8].map((s) => (
              <button
                key={s}
                onClick={() => setBracketSize(s)}
                className={`flex-1 px-4 py-2 rounded-lg border-2 font-semibold transition ${
                  bracketSize === s
                    ? 'bg-grass-500 border-grass-600 text-white'
                    : 'bg-white border-grass-200 text-ink-700 hover:border-grass-300'
                }`}
              >
                Top {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-grass-100 pt-3">
        <label className="label">Participants</label>
        <div className="flex gap-2 mb-2 text-sm">
          <button
            onClick={() => setPickFrom('signed_in')}
            className={`flex-1 px-3 py-1.5 rounded font-semibold transition ${pickFrom === 'signed_in' ? 'bg-grass-100 text-grass-700' : 'text-ink-700/60'}`}
          >
            Signed in today ({signedInToday.length})
          </button>
          <button
            onClick={() => setPickFrom('all')}
            className={`flex-1 px-3 py-1.5 rounded font-semibold transition ${pickFrom === 'all' ? 'bg-grass-100 text-grass-700' : 'text-ink-700/60'}`}
          >
            All active ({allActive.length})
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto p-1">
          {candidates.map((p) => {
            const sel = selectedIds.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleSelected(p.id)}
                className={`text-left px-2 py-1.5 rounded border text-sm transition ${
                  sel ? 'bg-grass-500 border-grass-600 text-white' : 'bg-white border-grass-200 text-ink-700 opacity-70'
                }`}
              >
                <div className="truncate font-medium">{p.belegarth_name || p.name}</div>
                <div className="text-xs opacity-70">Skill {Number(p.skill_rating).toFixed(1)}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-700/50 mt-2">
          {selectedIds.size} fighter{selectedIds.size === 1 ? '' : 's'} selected
          {type === 'bracket' && ` (need exactly ${bracketSize})`}
          {type === 'warlord' && ' (any number; top fighters from pit will fill bracket)'}
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t border-grass-100 pt-3">
        <button onClick={onCancel} className="btn-ghost"><X className="w-4 h-4" /> Cancel</button>
        <button onClick={create} disabled={creating} className="btn-primary">
          <Check className="w-4 h-4" /> {creating ? 'Creating...' : 'Create Tournament'}
        </button>
      </div>
    </div>
  );
}

// === LIVE TOURNAMENT VIEW ===

function TournamentLive({ tournamentId, onBack }) {
  const [tournament, setTournament] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState([]);
  const [allPlayers, setAllPlayers] = useState({});
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  useEffect(() => { load(); }, [tournamentId]);

  // Real-time subscription
  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase.channel(`tournament-${tournamentId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${tournamentId}` },
        () => loadMatches()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${tournamentId}` },
        () => loadParticipants()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        (payload) => setTournament(payload.new)
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId]);

  async function load() {
    setLoading(true);
    const [{ data: t }, players] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('players').select('*')
    ]);
    setTournament(t);
    const playerMap = {};
    (players.data || []).forEach((p) => { playerMap[p.id] = p; });
    setAllPlayers(playerMap);
    await Promise.all([loadParticipants(), loadMatches()]);
    setLoading(false);
  }

  async function loadParticipants() {
    const { data } = await supabase.from('tournament_participants').select('*').eq('tournament_id', tournamentId);
    setParticipants(data || []);
  }

  async function loadMatches() {
    const { data } = await supabase.from('tournament_matches').select('*')
      .eq('tournament_id', tournamentId).order('round').order('position');
    setMatches(data || []);
  }

  function playerName(id) {
    if (!id) return null;
    const p = allPlayers[id];
    return p ? (p.belegarth_name || p.name) : '—';
  }

  if (loading || !tournament) return <p className="text-ink-700/60">Loading tournament...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="btn-ghost text-sm">
          ← Back to tournaments
        </button>
        <div className="text-right">
          <h2 className="font-display text-xl">{tournament.name}</h2>
          <p className="text-xs text-ink-700/60">
            {{warlord: 'Warlord', bracket: 'Bracket', round_robin: 'Round Robin'}[tournament.type]}
            {' · '}
            {formatLabel(tournament.match_format, tournament.match_target)}
          </p>
        </div>
      </div>

      {tournament.status === 'completed' && (
        <CompletedView tournament={tournament} playerName={playerName} />
      )}

      {tournament.status === 'pit' && (
        <PitPhase
          tournament={tournament}
          participants={participants}
          playerName={playerName}
          onRefresh={loadParticipants}
          onAdvance={async () => {
            await loadParticipants();
            await loadMatches();
            setTournament({ ...tournament, status: 'bracket' });
          }}
        />
      )}

      {(tournament.status === 'bracket' || (tournament.status === 'final' && tournament.type !== 'round_robin')) && (
        <BracketView
          tournament={tournament}
          matches={matches}
          allPlayers={allPlayers}
          playerName={playerName}
        />
      )}

      {(tournament.status === 'round_robin' || (tournament.status === 'final' && tournament.type === 'round_robin')) && (
        <RoundRobinView
          tournament={tournament}
          matches={matches}
          participants={participants}
          allPlayers={allPlayers}
          playerName={playerName}
        />
      )}
    </div>
  );
}

// === WARLORD PIT PHASE ===

function PitPhase({ tournament, participants, playerName, onRefresh, onAdvance }) {
  const [advancing, setAdvancing] = useState(false);

  async function bumpKill(participantId, delta) {
    const p = participants.find((x) => x.id === participantId);
    if (!p) return;
    const next = Math.max(0, (p.pit_kills || 0) + delta);
    await supabase.from('tournament_participants')
      .update({ pit_kills: next }).eq('id', participantId);
    onRefresh();
  }

  async function advanceToBracket() {
    if (participants.length < tournament.bracket_size) {
      alert(`Need at least ${tournament.bracket_size} participants to fill the bracket.`);
      return;
    }
    if (!confirm(`End pit phase and create bracket of top ${tournament.bracket_size} by kill count?`)) return;

    setAdvancing(true);
    try {
      // Sort by pit_kills desc, take top N as seeds
      const sorted = [...participants].sort((a, b) => (b.pit_kills || 0) - (a.pit_kills || 0));
      const top = sorted.slice(0, tournament.bracket_size);

      // Update seeds
      await Promise.all(top.map((p, idx) =>
        supabase.from('tournament_participants').update({ seed: idx + 1 }).eq('id', p.id)
      ));

      // Mark non-advancing as eliminated at round 0
      const eliminated = sorted.slice(tournament.bracket_size);
      await Promise.all(eliminated.map((p) =>
        supabase.from('tournament_participants').update({ eliminated_at_round: 0 }).eq('id', p.id)
      ));

      // Generate bracket matches
      const seededRows = top.map((p) => ({ player_id: p.player_id }));
      const matchRows = generateBracketMatches(seededRows, tournament.bracket_size);
      await supabase.from('tournament_matches').insert(
        matchRows.map((m) => ({ ...m, tournament_id: tournament.id }))
      );

      // Advance tournament status
      await supabase.from('tournaments').update({ status: 'bracket' }).eq('id', tournament.id);
      onAdvance();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setAdvancing(false);
    }
  }

  const sorted = [...participants].sort((a, b) => (b.pit_kills || 0) - (a.pit_kills || 0));
  const totalKills = participants.reduce((s, p) => s + (p.pit_kills || 0), 0);

  return (
    <div className="space-y-4">
      <div className="card p-4 bg-gradient-to-br from-grass-50 to-cream-50">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div>
            <h3 className="font-display text-lg">Pit Phase</h3>
            <p className="text-xs text-ink-700/60">
              Tap a fighter when they kill the warlord. Top {tournament.bracket_size} advance to bracket.
            </p>
          </div>
          <button onClick={advanceToBracket} disabled={advancing} className="btn-primary text-sm">
            <Award className="w-4 h-4" /> {advancing ? 'Generating...' : `End Pit → Top ${tournament.bracket_size}`}
          </button>
        </div>
        <p className="text-xs text-ink-700/50">{totalKills} kills recorded</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {sorted.map((p, idx) => (
          <div key={p.id} className={`card p-3 flex items-center gap-3 ${idx < tournament.bracket_size ? 'border-grass-300 bg-grass-50' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
              idx < tournament.bracket_size ? 'bg-grass-600 text-white' : 'bg-cream-100 text-ink-700/60'
            }`}>
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{playerName(p.player_id)}</div>
              <div className="text-xs text-ink-700/50">{p.pit_kills || 0} kill{p.pit_kills === 1 ? '' : 's'}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => bumpKill(p.id, -1)} disabled={!p.pit_kills}
                className="w-8 h-8 rounded bg-cream-100 hover:bg-cream-200 flex items-center justify-center disabled:opacity-30">
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={() => bumpKill(p.id, 1)}
                className="w-9 h-9 rounded bg-grass-500 hover:bg-grass-600 text-white flex items-center justify-center transition">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// === BRACKET VIEW ===

function BracketView({ tournament, matches, allPlayers, playerName }) {
  const rounds = useMemo(() => {
    const grouped = {};
    matches.forEach((m) => {
      if (!grouped[m.round]) grouped[m.round] = [];
      grouped[m.round].push(m);
    });
    return Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).map((r) => grouped[r]);
  }, [matches]);

  const totalRounds = rounds.length;

  function roundLabel(idx) {
    const fromEnd = totalRounds - idx;
    if (fromEnd === 1) return 'Final';
    if (fromEnd === 2) return 'Semifinals';
    if (fromEnd === 3) return 'Quarterfinals';
    return `Round ${idx + 1}`;
  }

  return (
    <div className="space-y-4">
      {rounds.map((roundMatches, idx) => (
        <div key={idx}>
          <h3 className="text-sm font-semibold text-ink-700/70 uppercase tracking-wide mb-2">
            {roundLabel(idx)}
          </h3>
          <div className="space-y-2">
            {roundMatches.map((m) => (
              <MatchRow key={m.id} match={m} tournament={tournament} playerName={playerName} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// === ROUND ROBIN VIEW ===

function RoundRobinView({ tournament, matches, participants, allPlayers, playerName }) {
  const [advancing, setAdvancing] = useState(false);

  const regularMatches = matches.filter((m) => !m.is_final);
  const finalMatch = matches.find((m) => m.is_final);

  const allRegularDone = regularMatches.length > 0 && regularMatches.every((m) => m.status === 'completed');
  const standings = useMemo(() => computeRRStandings(participants, regularMatches), [participants, regularMatches]);

  async function startFinal() {
    if (!allRegularDone || finalMatch) return;
    if (standings.length < 2) return;
    setAdvancing(true);
    try {
      const top1 = standings[0].player_id;
      const top2 = standings[1].player_id;
      const maxRound = Math.max(...regularMatches.map((m) => m.round));
      await supabase.from('tournament_matches').insert({
        tournament_id: tournament.id,
        round: maxRound + 1,
        position: 0,
        player_a_id: top1,
        player_b_id: top2,
        is_final: true,
        status: 'pending'
      });
      await supabase.from('tournaments').update({ status: 'final' }).eq('id', tournament.id);
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Standings */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-ink-700/70 uppercase tracking-wide mb-3">Standings</h3>
        <div className="space-y-1">
          {standings.map((s, idx) => (
            <div key={s.player_id} className={`flex items-center gap-3 px-3 py-2 rounded ${idx < 2 && allRegularDone ? 'bg-grass-50 border border-grass-200' : 'bg-cream-50'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                idx < 2 && allRegularDone ? 'bg-grass-600 text-white' : 'bg-white text-ink-700 border border-grass-200'
              }`}>
                {idx + 1}
              </div>
              <div className="flex-1 font-semibold truncate">{playerName(s.player_id)}</div>
              <div className="text-sm tabular-nums text-ink-700/70">
                {s.match_wins}W {s.match_losses}L
                <span className="text-xs text-ink-700/50 ml-2">
                  ({s.game_wins}-{s.game_losses})
                </span>
              </div>
            </div>
          ))}
        </div>
        {allRegularDone && !finalMatch && (
          <button onClick={startFinal} disabled={advancing} className="btn-primary w-full mt-3 justify-center">
            <Trophy className="w-4 h-4" /> {advancing ? 'Setting up...' : `Start Final: ${playerName(standings[0]?.player_id)} vs ${playerName(standings[1]?.player_id)}`}
          </button>
        )}
      </div>

      {/* Final match */}
      {finalMatch && (
        <div>
          <h3 className="text-sm font-semibold text-ink-700/70 uppercase tracking-wide mb-2">Final</h3>
          <MatchRow match={finalMatch} tournament={tournament} playerName={playerName} />
        </div>
      )}

      {/* All regular matches */}
      <div>
        <h3 className="text-sm font-semibold text-ink-700/70 uppercase tracking-wide mb-2">
          Matches ({regularMatches.filter((m) => m.status === 'completed').length}/{regularMatches.length} complete)
        </h3>
        <div className="space-y-2">
          {regularMatches.map((m) => (
            <MatchRow key={m.id} match={m} tournament={tournament} playerName={playerName} />
          ))}
        </div>
      </div>
    </div>
  );
}

// === MATCH ROW (with inline expansion for recording) ===

function MatchRow({ match, tournament, playerName }) {
  const [expanded, setExpanded] = useState(false);
  const target = tournament.match_target;
  const aName = playerName(match.player_a_id) || 'TBD';
  const bName = playerName(match.player_b_id) || 'TBD';
  const canRecord = match.player_a_id && match.player_b_id && match.status !== 'completed';
  const isCompleted = match.status === 'completed';

  async function bump(slot, delta) {
    if (!canRecord) return;
    const field = slot === 'a' ? 'player_a_wins' : 'player_b_wins';
    const current = match[field] || 0;
    const next = Math.max(0, current + delta);

    const update = { [field]: next };
    if (match.status === 'pending') update.status = 'in_progress';

    // Check for completion
    const otherField = slot === 'a' ? 'player_b_wins' : 'player_a_wins';
    if (next >= target) {
      update.status = 'completed';
      update.winner_id = slot === 'a' ? match.player_a_id : match.player_b_id;
    }

    await supabase.from('tournament_matches').update(update).eq('id', match.id);

    // If completed, advance winner
    if (next >= target) {
      const newMatch = { ...match, ...update };
      await advanceWinner(newMatch);
    }
  }

  async function advanceWinner(completedMatch) {
    if (completedMatch.is_final) {
      // Tournament complete
      const runner = completedMatch.winner_id === completedMatch.player_a_id
        ? completedMatch.player_b_id : completedMatch.player_a_id;
      await supabase.from('tournaments').update({
        status: 'completed',
        winner_id: completedMatch.winner_id,
        runner_up_id: runner,
        completed_at: new Date().toISOString()
      }).eq('id', completedMatch.tournament_id);
      return;
    }
    const next = nextMatchSlot(completedMatch);
    if (!next) return;
    const updateField = next.slot === 'a' ? 'player_a_id' : 'player_b_id';
    await supabase.from('tournament_matches')
      .update({ [updateField]: completedMatch.winner_id })
      .eq('tournament_id', completedMatch.tournament_id)
      .eq('round', next.round)
      .eq('position', next.position);
  }

  async function undoWin() {
    if (!confirm('Undo this match result? Players will need to record it again.')) return;
    await supabase.from('tournament_matches').update({
      status: 'in_progress',
      winner_id: null
    }).eq('id', match.id);
    // Note: this doesn't roll back advancement to next match - user has to manually fix
  }

  return (
    <div className={`card overflow-hidden ${isCompleted ? 'opacity-80' : ''}`}>
      <button
        onClick={() => canRecord && setExpanded(!expanded)}
        disabled={!canRecord && !isCompleted}
        className={`w-full p-3 flex items-center justify-between gap-3 ${canRecord ? 'hover:bg-cream-50 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className={`text-right truncate font-semibold ${match.winner_id === match.player_a_id ? 'text-grass-700' : ''}`}>
              {aName}
            </div>
            <div className="text-center px-2 font-display text-lg tabular-nums">
              <span className={match.winner_id === match.player_a_id ? 'text-grass-700' : 'text-ink-700/60'}>{match.player_a_wins || 0}</span>
              <span className="text-ink-700/40 mx-1">-</span>
              <span className={match.winner_id === match.player_b_id ? 'text-grass-700' : 'text-ink-700/60'}>{match.player_b_wins || 0}</span>
            </div>
            <div className={`truncate font-semibold ${match.winner_id === match.player_b_id ? 'text-grass-700' : ''}`}>
              {bName}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          {isCompleted ? (
            <Trophy className="w-4 h-4 text-sun-500" />
          ) : match.status === 'in_progress' ? (
            <span className="pill bg-sky-100 text-sky-600">live</span>
          ) : canRecord ? (
            expanded ? <ChevronDown className="w-4 h-4 text-ink-700/40" /> : <ChevronRight className="w-4 h-4 text-ink-700/40" />
          ) : null}
        </div>
      </button>

      {expanded && canRecord && (
        <div className="border-t border-grass-100 p-4 bg-grass-50/40">
          <p className="text-center text-xs text-ink-700/60 mb-3 font-semibold uppercase tracking-wide">
            First to {target}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ScoreColumn name={aName} score={match.player_a_wins || 0}
              onPlus={() => bump('a', 1)} onMinus={() => bump('a', -1)} />
            <ScoreColumn name={bName} score={match.player_b_wins || 0}
              onPlus={() => bump('b', 1)} onMinus={() => bump('b', -1)} />
          </div>
        </div>
      )}

      {expanded && isCompleted && (
        <div className="border-t border-grass-100 p-3 bg-cream-50 flex justify-end">
          <button onClick={undoWin} className="btn-ghost text-xs text-sun-600">
            Undo result
          </button>
        </div>
      )}
    </div>
  );
}

function ScoreColumn({ name, score, onPlus, onMinus }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-grass-200 text-center">
      <div className="text-sm font-semibold mb-2 truncate">{name}</div>
      <div className="font-display text-5xl tabular-nums leading-none mb-3">{score}</div>
      <div className="flex items-center justify-center gap-2">
        <button onClick={onMinus} disabled={score === 0}
          className="w-10 h-10 rounded-lg bg-cream-100 hover:bg-cream-200 flex items-center justify-center disabled:opacity-30 transition">
          <Minus className="w-5 h-5" />
        </button>
        <button onClick={onPlus}
          className="w-12 h-12 rounded-lg bg-grass-500 hover:bg-grass-600 text-white flex items-center justify-center shadow-sm transition">
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

// === COMPLETED VIEW ===

function CompletedView({ tournament, playerName }) {
  return (
    <div className="card p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-sun-500/20 mx-auto mb-3 flex items-center justify-center">
        <Trophy className="w-8 h-8 text-sun-600" />
      </div>
      <h3 className="font-display text-2xl mb-1">Tournament Complete</h3>
      <p className="text-grass-700 font-semibold text-lg mb-1">
        🏆 {playerName(tournament.winner_id)}
      </p>
      {tournament.runner_up_id && (
        <p className="text-sm text-ink-700/60">
          Runner-up: {playerName(tournament.runner_up_id)}
        </p>
      )}
      {tournament.completed_at && (
        <p className="text-xs text-ink-700/40 mt-3">
          {new Date(tournament.completed_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
