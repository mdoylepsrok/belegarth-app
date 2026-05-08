import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Calendar, MapPin, Link as LinkIcon, Plus, Trash2, Edit3, Check, X,
  ChevronDown, ChevronRight, Sparkles, Trophy, Users, Star, Crown,
  ThumbsUp, HelpCircle, ThumbsDown, UserCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useIdentity } from '../lib/identity.jsx';
import Dashboard from './Dashboard.jsx';

const EVENT_TYPES = {
  practice: { label: 'Practice', icon: Calendar, color: 'text-grass-700 bg-grass-100' },
  tournament: { label: 'Tournament', icon: Trophy, color: 'text-sun-600 bg-sun-500/15' },
  national: { label: 'National', icon: Crown, color: 'text-purple-700 bg-purple-100' },
  social: { label: 'Social', icon: Users, color: 'text-sky-600 bg-sky-100' },
  other: { label: 'Other', icon: Star, color: 'text-ink-700 bg-cream-100' }
};

export default function Schedule() {
  const [events, setEvents] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  const [allPlayers, setAllPlayers] = useState({});
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  useEffect(() => { load(); }, []);

  // Realtime sync
  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase.channel('schedule')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => loadEvents()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_rsvps' },
        () => loadRsvps()
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    setLoading(true);
    const { data: players } = await supabase.from('players').select('id, name, belegarth_name');
    const map = {};
    (players || []).forEach((p) => { map[p.id] = p; });
    setAllPlayers(map);
    await Promise.all([loadEvents(), loadRsvps()]);
    setLoading(false);
  }

  async function loadEvents() {
    const { data } = await supabase.from('events').select('*').order('start_date');
    setEvents(data || []);
  }

  async function loadRsvps() {
    const { data } = await supabase.from('event_rsvps').select('*');
    setRsvps(data || []);
  }

  async function saveEvent(payload, id) {
    if (id) {
      const { error } = await supabase.from('events').update(payload).eq('id', id);
      if (error) { alert(error.message); return false; }
    } else {
      const { error } = await supabase.from('events').insert(payload);
      if (error) { alert(error.message); return false; }
    }
    setCreating(false);
    setEditingId(null);
    await loadEvents();
    return true;
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event? All RSVPs will be removed.')) return;
    await supabase.from('events').delete().eq('id', id);
    await load();
  }

  // Bucket events by date relative to today
  const today = new Date().toISOString().slice(0, 10);
  const todaysEvent = useMemo(
    () => events.find((e) => e.start_date <= today && (e.end_date || e.start_date) >= today),
    [events, today]
  );
  const upcoming = useMemo(
    () => events.filter((e) => e.start_date > today)
                .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [events, today]
  );
  const past = useMemo(
    () => events.filter((e) => (e.end_date || e.start_date) < today)
                .sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [events, today]
  );

  function rsvpsForEvent(eventId) {
    return rsvps.filter((r) => r.event_id === eventId);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-ink-700/50">Loading...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Today's event banner */}
      {todaysEvent && (
        <TodayEventBanner
          event={todaysEvent}
          rsvps={rsvpsForEvent(todaysEvent.id)}
          allPlayers={allPlayers}
        />
      )}

      {/* Today's session UI - existing Dashboard */}
      <Dashboard />

      {/* Identity nudge */}
      <IdentityNudge />

      {/* Upcoming events */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-xl font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-grass-700" />
            Upcoming
            {upcoming.length > 0 && (
              <span className="text-sm text-ink-700/50 font-sans font-normal">
                {upcoming.length} event{upcoming.length === 1 ? '' : 's'}
              </span>
            )}
          </h2>
          {!creating && !editingId && (
            <button onClick={() => setCreating(true)} className="btn-primary text-sm">
              <Plus className="w-4 h-4" /> Add Event
            </button>
          )}
        </div>

        {creating && (
          <EventForm onSave={(p) => saveEvent(p)} onCancel={() => setCreating(false)} />
        )}

        {upcoming.length === 0 && !creating ? (
          <div className="card p-6 text-center text-ink-700/50">
            No upcoming events. Add one to start the calendar going.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((e) => editingId === e.id ? (
              <EventForm
                key={e.id}
                initial={e}
                onSave={(p) => saveEvent(p, e.id)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <EventCard
                key={e.id}
                event={e}
                rsvps={rsvpsForEvent(e.id)}
                allPlayers={allPlayers}
                onEdit={() => setEditingId(e.id)}
                onDelete={() => deleteEvent(e.id)}
                isPast={false}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past events */}
      {past.length > 0 && (
        <section>
          <button
            onClick={() => setShowPast(!showPast)}
            className="w-full flex items-center justify-between text-left hover:bg-cream-50 rounded p-2 -mx-2"
          >
            <h2 className="text-xl font-display text-ink-700/70 flex items-center gap-2">
              {showPast ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              Past Events
              <span className="text-sm font-sans font-normal text-ink-700/50">
                {past.length}
              </span>
            </h2>
          </button>
          {showPast && (
            <div className="space-y-2 mt-3">
              {past.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  rsvps={rsvpsForEvent(e.id)}
                  allPlayers={allPlayers}
                  onEdit={() => setEditingId(e.id)}
                  onDelete={() => deleteEvent(e.id)}
                  isPast={true}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// === IDENTITY NUDGE ===

function IdentityNudge() {
  const { player, promptIdentity, clearIdentity } = useIdentity();

  if (player) {
    return (
      <div className="card p-3 flex items-center justify-between bg-grass-50/50 border-grass-200">
        <div className="flex items-center gap-2 text-sm">
          <UserCircle className="w-5 h-5 text-grass-700" />
          <span>You're signed in as <strong>{player.belegarth_name || player.name}</strong> on this device.</span>
        </div>
        <button onClick={clearIdentity} className="text-xs text-ink-700/50 hover:text-ink-900 underline">
          Not me
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={promptIdentity}
      className="w-full card p-4 flex items-center gap-3 text-left hover:bg-grass-50 transition border-grass-200"
    >
      <div className="w-10 h-10 rounded-lg bg-grass-100 flex items-center justify-center flex-shrink-0">
        <UserCircle className="w-5 h-5 text-grass-700" />
      </div>
      <div className="flex-1">
        <div className="font-semibold">Identify yourself to RSVP</div>
        <div className="text-xs text-ink-700/60">Pick your name from the roster — stays on this device.</div>
      </div>
      <ChevronRight className="w-4 h-4 text-ink-700/40" />
    </button>
  );
}

// === TODAY'S EVENT BANNER ===

function TodayEventBanner({ event, rsvps, allPlayers }) {
  const type = EVENT_TYPES[event.event_type] || EVENT_TYPES.other;
  const Icon = type.icon;
  const goingCount = rsvps.filter((r) => r.status === 'going').length;
  const maybeCount = rsvps.filter((r) => r.status === 'maybe').length;

  return (
    <div className="card p-4 sm:p-5 bg-gradient-to-br from-grass-50 to-cream-50 border-grass-200">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${type.color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs uppercase tracking-wide text-grass-700 font-bold">Today</span>
            <span className={`pill ${type.color}`}>{type.label}</span>
          </div>
          <h3 className="font-display text-2xl text-ink-900 leading-tight">{event.title}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-sm text-ink-700/70">
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" /> {event.location}
              </span>
            )}
            {event.url && (
              <a href={event.url} target="_blank" rel="noreferrer"
                 className="flex items-center gap-1 text-grass-700 hover:underline">
                <LinkIcon className="w-4 h-4" /> Details
              </a>
            )}
            {(goingCount > 0 || maybeCount > 0) && (
              <span className="text-ink-700/60">
                {goingCount} going{maybeCount > 0 && ` · ${maybeCount} maybe`}
              </span>
            )}
          </div>
          {event.description && (
            <p className="text-sm text-ink-700/70 mt-2">{event.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// === EVENT CARD ===

function EventCard({ event, rsvps, allPlayers, onEdit, onDelete, isPast }) {
  const [expanded, setExpanded] = useState(false);
  const { playerId, promptIdentity } = useIdentity();
  const type = EVENT_TYPES[event.event_type] || EVENT_TYPES.other;
  const Icon = type.icon;

  const myRsvp = rsvps.find((r) => r.player_id === playerId);
  const goingCount = rsvps.filter((r) => r.status === 'going').length;
  const maybeCount = rsvps.filter((r) => r.status === 'maybe').length;
  const notGoingCount = rsvps.filter((r) => r.status === 'not_going').length;

  async function setRsvp(status) {
    if (!playerId) {
      promptIdentity();
      return;
    }
    if (myRsvp?.status === status) {
      // Tap same button = clear RSVP
      await supabase.from('event_rsvps').delete().eq('id', myRsvp.id);
      return;
    }
    const payload = {
      event_id: event.id,
      player_id: playerId,
      status,
      updated_at: new Date().toISOString()
    };
    if (myRsvp) {
      await supabase.from('event_rsvps').update({ status, updated_at: payload.updated_at }).eq('id', myRsvp.id);
    } else {
      await supabase.from('event_rsvps').insert(payload);
    }
  }

  return (
    <div className={`card overflow-hidden ${isPast ? 'opacity-75' : ''}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${type.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h3 className="font-semibold text-ink-900 truncate">{event.title}</h3>
                <div className="text-sm text-ink-700/70 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>{formatDateRange(event.start_date, event.end_date)}</span>
                  {event.location && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={onEdit} className="p-1.5 hover:bg-cream-100 rounded text-ink-700/60" title="Edit">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={onDelete} className="p-1.5 hover:bg-cream-100 rounded text-sun-600" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {event.description && (
              <p className="text-sm text-ink-700/70 mt-2">{event.description}</p>
            )}

            {event.url && (
              <a href={event.url} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 text-xs text-grass-700 hover:underline mt-1">
                <LinkIcon className="w-3 h-3" /> Event page
              </a>
            )}

            {/* RSVP counts */}
            <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
              {goingCount > 0 && (
                <span className="pill bg-grass-100 text-grass-700">
                  <ThumbsUp className="w-3 h-3 mr-0.5" /> {goingCount} going
                </span>
              )}
              {maybeCount > 0 && (
                <span className="pill bg-cream-200 text-sun-600">
                  <HelpCircle className="w-3 h-3 mr-0.5" /> {maybeCount} maybe
                </span>
              )}
              {notGoingCount > 0 && (
                <span className="pill bg-cream-100 text-ink-700/50">
                  {notGoingCount} can't
                </span>
              )}
              {goingCount === 0 && maybeCount === 0 && notGoingCount === 0 && (
                <span className="text-xs text-ink-700/40 italic">No RSVPs yet</span>
              )}
            </div>

            {/* RSVP buttons (hidden for past events) */}
            {!isPast && (
              <div className="flex gap-2 mt-3">
                <RsvpButton
                  active={myRsvp?.status === 'going'}
                  onClick={() => setRsvp('going')}
                  icon={ThumbsUp}
                  label="Going"
                  activeClass="bg-grass-500 text-white border-grass-600"
                />
                <RsvpButton
                  active={myRsvp?.status === 'maybe'}
                  onClick={() => setRsvp('maybe')}
                  icon={HelpCircle}
                  label="Maybe"
                  activeClass="bg-sun-500 text-white border-sun-600"
                />
                <RsvpButton
                  active={myRsvp?.status === 'not_going'}
                  onClick={() => setRsvp('not_going')}
                  icon={ThumbsDown}
                  label="Can't"
                  activeClass="bg-ink-700 text-white border-ink-800"
                />
              </div>
            )}

            {/* Show RSVPs button */}
            {rsvps.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-ink-700/60 hover:text-ink-900 mt-3 flex items-center gap-1"
              >
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {expanded ? 'Hide' : 'Show'} RSVPs
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-grass-100 space-y-2 text-sm">
            <RsvpGroup label="Going" rsvps={rsvps.filter((r) => r.status === 'going')} allPlayers={allPlayers} colorClass="text-grass-700" />
            <RsvpGroup label="Maybe" rsvps={rsvps.filter((r) => r.status === 'maybe')} allPlayers={allPlayers} colorClass="text-sun-600" />
            <RsvpGroup label="Can't make it" rsvps={rsvps.filter((r) => r.status === 'not_going')} allPlayers={allPlayers} colorClass="text-ink-700/60" />
          </div>
        )}
      </div>
    </div>
  );
}

function RsvpButton({ active, onClick, icon: Icon, label, activeClass }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg border-2 font-semibold text-sm transition flex items-center justify-center gap-1.5 ${
        active
          ? activeClass
          : 'bg-white border-grass-200 text-ink-700 hover:border-grass-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function RsvpGroup({ label, rsvps, allPlayers, colorClass }) {
  if (rsvps.length === 0) return null;
  return (
    <div>
      <div className={`text-xs font-bold uppercase tracking-wide ${colorClass} mb-1`}>
        {label} ({rsvps.length})
      </div>
      <div className="flex flex-wrap gap-1">
        {rsvps.map((r) => {
          const p = allPlayers[r.player_id];
          return (
            <span key={r.id} className="pill bg-cream-100 text-ink-700">
              {p ? (p.belegarth_name || p.name) : 'Unknown'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// === EVENT FORM ===

function EventForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    event_type: 'practice',
    start_date: new Date().toISOString().slice(0, 10),
    location: '',
    url: '',
    description: '',
    ...initial,
    end_date: initial.end_date || ''
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    if (!form.title.trim()) { alert('Title required.'); return; }
    if (!form.start_date) { alert('Start date required.'); return; }
    onSave({
      title: form.title.trim(),
      event_type: form.event_type,
      start_date: form.start_date,
      end_date: form.end_date || null,
      location: form.location.trim() || null,
      url: form.url.trim() || null,
      description: form.description.trim() || null
    });
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <label className="label">Title *</label>
        <input className="input w-full" value={form.title}
          onChange={(e) => set('title', e.target.value)} autoFocus
          placeholder="Chaos Wars, Spring Tournament, etc." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input w-full" value={form.event_type}
            onChange={(e) => set('event_type', e.target.value)}>
            {Object.entries(EVENT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input w-full" value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Park name, city, venue..." />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Start Date *</label>
          <input type="date" className="input w-full" value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="label">End Date (optional, for multi-day)</label>
          <input type="date" className="input w-full" value={form.end_date}
            onChange={(e) => set('end_date', e.target.value)}
            min={form.start_date} />
        </div>
      </div>
      <div>
        <label className="label">URL (optional)</label>
        <input type="url" className="input w-full" value={form.url}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://..." />
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <textarea className="input w-full font-sans" rows="3" value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="What is it? Who should come? What to bring?" />
      </div>
      <div className="flex justify-end gap-2 border-t border-grass-100 pt-3">
        <button onClick={onCancel} className="btn-ghost"><X className="w-4 h-4" /> Cancel</button>
        <button onClick={submit} className="btn-primary"><Check className="w-4 h-4" /> Save</button>
      </div>
    </div>
  );
}

// === HELPERS ===

function formatDateRange(start, end) {
  if (!start) return '';
  const s = new Date(start + 'T00:00:00');
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (!end || end === start) {
    return s.toLocaleDateString(undefined, opts);
  }
  const e = new Date(end + 'T00:00:00');
  // Same month: "May 5–8"
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${e.getDate()}`;
  }
  return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
