import { useEffect, useState, useMemo } from 'react';
import {
  Calendar, TrendingUp, Users, ChevronDown, ChevronRight,
  CheckCircle2, Circle, Trash2, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Attendance() {
  const [view, setView] = useState('players'); // 'players' or 'sessions'
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [signIns, setSignIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: si }] = await Promise.all([
      supabase.from('players').select('*').eq('active', true).order('name'),
      supabase.from('sessions').select('*').order('session_date', { ascending: false }),
      supabase.from('sign_ins').select('*')
    ]);
    setPlayers(p || []);
    setSessions(s || []);
    setSignIns(si || []);
    setLoading(false);
  }

  // Build lookup: { playerId: Set(sessionId) }
  const attendanceMap = useMemo(() => {
    const m = new Map();
    for (const s of signIns) {
      if (!m.has(s.player_id)) m.set(s.player_id, new Set());
      m.get(s.player_id).add(s.session_id);
    }
    return m;
  }, [signIns]);

  // Sessions per player
  const playerStats = useMemo(() => {
    return players.map((p) => {
      const attended = attendanceMap.get(p.id) || new Set();
      const total = sessions.length || 1;
      const lastAttended = sessions.find((s) => attended.has(s.id));
      // Streak: count consecutive recent sessions attended
      let streak = 0;
      for (const s of sessions) {
        if (attended.has(s.id)) streak++;
        else break;
      }
      return {
        ...p,
        attended_count: attended.size,
        total_sessions: sessions.length,
        attendance_pct: sessions.length ? Math.round((attended.size / sessions.length) * 100) : 0,
        last_attended: lastAttended?.session_date || null,
        streak
      };
    }).sort((a, b) => b.attendance_pct - a.attendance_pct);
  }, [players, sessions, attendanceMap]);

  // Players per session
  function attendeesFor(sessionId) {
    const ids = signIns.filter((s) => s.session_id === sessionId).map((s) => s.player_id);
    return players.filter((p) => ids.includes(p.id));
  }

  async function deleteSession(sessionId) {
    if (!confirm('Delete this session and all its sign-ins, battles, and stats? This cannot be undone.')) return;
    await supabase.from('sessions').delete().eq('id', sessionId);
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-700/50">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading attendance...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display">Attendance</h2>
          <p className="text-sm text-ink-700/60">
            {sessions.length} sessions tracked · {players.length} active players
          </p>
        </div>
        <div className="flex gap-1 bg-cream-100 border border-grass-100 rounded-lg p-1">
          <button
            onClick={() => setView('players')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${
              view === 'players' ? 'bg-white text-grass-700 shadow-sm' : 'text-ink-700/60 hover:text-ink-900'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" /> By Player
          </button>
          <button
            onClick={() => setView('sessions')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition ${
              view === 'sessions' ? 'bg-white text-grass-700 shadow-sm' : 'text-ink-700/60 hover:text-ink-900'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-1" /> By Session
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          icon={Calendar}
          label="Sessions"
          value={sessions.length}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Avg Attendance"
          value={
            sessions.length
              ? Math.round(
                  playerStats.reduce((s, p) => s + p.attendance_pct, 0) / (playerStats.length || 1)
                ) + '%'
              : '—'
          }
        />
        <SummaryCard
          icon={Users}
          label="Most Recent"
          value={sessions[0]?.session_date
            ? new Date(sessions[0].session_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : '—'}
        />
      </div>

      {view === 'players' ? (
        <PlayerView playerStats={playerStats} sessions={sessions} attendanceMap={attendanceMap} />
      ) : (
        <SessionView
          sessions={sessions}
          attendeesFor={attendeesFor}
          expanded={expandedSession}
          onToggle={(id) => setExpandedSession(expandedSession === id ? null : id)}
          onDelete={deleteSession}
        />
      )}
    </div>
  );
}

function PlayerView({ playerStats, sessions, attendanceMap }) {
  // Last 12 sessions for the mini-strip
  const recentSessions = sessions.slice(0, 12);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b border-grass-100 text-ink-700/70 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Player</th>
              <th className="px-3 py-2 font-semibold text-right">Attended</th>
              <th className="px-3 py-2 font-semibold text-right">%</th>
              <th className="px-3 py-2 font-semibold text-right">Streak</th>
              <th className="px-3 py-2 font-semibold">Last 12</th>
              <th className="px-3 py-2 font-semibold">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-700/50">
                No players yet.
              </td></tr>
            ) : playerStats.map((p) => {
              const attended = attendanceMap.get(p.id) || new Set();
              return (
                <tr key={p.id} className="border-b border-grass-100/60 hover:bg-cream-50">
                  <td className="px-3 py-2 font-medium">
                    {p.belegarth_name || p.name}
                    {p.belegarth_name && (
                      <div className="text-xs text-ink-700/50">{p.name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.attended_count}/{p.total_sessions}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`pill ${
                      p.attendance_pct >= 75 ? 'bg-grass-100 text-grass-700' :
                      p.attendance_pct >= 40 ? 'bg-cream-200 text-sun-600' :
                      'bg-cream-100 text-ink-700/60'
                    }`}>
                      {p.attendance_pct}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-700/70">
                    {p.streak > 0 ? `🔥 ${p.streak}` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-0.5">
                      {recentSessions.length === 0 ? (
                        <span className="text-xs text-ink-700/40">—</span>
                      ) : recentSessions.map((s) => {
                        const here = attended.has(s.id);
                        return (
                          <div
                            key={s.id}
                            title={`${s.session_date}: ${here ? 'present' : 'absent'}`}
                            className={`w-3 h-3 rounded-sm ${here ? 'bg-grass-500' : 'bg-cream-200'}`}
                          />
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-700/60">
                    {p.last_attended
                      ? new Date(p.last_attended + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : 'Never'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionView({ sessions, attendeesFor, expanded, onToggle, onDelete }) {
  if (sessions.length === 0) {
    return <div className="card p-8 text-center text-ink-700/60">No sessions yet.</div>;
  }
  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const isOpen = expanded === s.id;
        const attendees = isOpen ? attendeesFor(s.id) : [];
        const count = attendeesFor(s.id).length;
        return (
          <div key={s.id} className="card overflow-hidden">
            <button
              onClick={() => onToggle(s.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-cream-50 text-left"
            >
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="w-4 h-4 text-grass-700" /> : <ChevronRight className="w-4 h-4 text-ink-700/40" />}
                <div>
                  <div className="font-semibold">
                    {new Date(s.session_date + 'T00:00:00').toLocaleDateString(undefined, {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </div>
                  {s.location && <div className="text-xs text-ink-700/50">{s.location}</div>}
                </div>
              </div>
              <span className="pill bg-grass-100 text-grass-700">
                {count} {count === 1 ? 'fighter' : 'fighters'}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-grass-100 p-4 bg-cream-50">
                {attendees.length === 0 ? (
                  <p className="text-sm text-ink-700/50 italic">No one signed in for this session.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {attendees.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm bg-white rounded px-2 py-1.5 border border-grass-100">
                        <CheckCircle2 className="w-4 h-4 text-grass-600 flex-shrink-0" />
                        <span className="truncate">{p.belegarth_name || p.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <button onClick={() => onDelete(s.id)} className="btn-ghost text-xs text-sun-600">
                    <Trash2 className="w-3 h-3" /> Delete session
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-grass-100 flex items-center justify-center">
        <Icon className="w-5 h-5 text-grass-700" />
      </div>
      <div>
        <div className="text-2xl font-display text-ink-900">{value}</div>
        <div className="text-xs text-ink-700/60">{label}</div>
      </div>
    </div>
  );
}
