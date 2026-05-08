import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Trash2, Edit3, Check, X, Trophy, Crown, Archive,
  ArchiveRestore, ChevronDown, ChevronRight, Users, Minus, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const FACTION_COLORS = [
  '#c0392b', '#5fa83a', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#0ea5e9', '#84cc16', '#f97316', '#64748b'
];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [factions, setFactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: f }, { data: m }, { data: p }] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_factions').select('*').order('sort_order'),
      supabase.from('campaign_faction_members').select('*'),
      supabase.from('players').select('*').eq('active', true).order('name')
    ]);
    setCampaigns(c || []);
    setFactions(f || []);
    setMembers(m || []);
    setAllPlayers(p || []);
    setLoading(false);
  }

  async function createCampaign(data) {
    const { error } = await supabase.from('campaigns').insert({
      name: data.name.trim(),
      description: data.description?.trim() || null
    });
    if (error) { alert(error.message); return; }
    setAdding(false);
    await load();
  }

  async function archiveCampaign(c) {
    const next = c.status === 'archived' ? 'active' : 'archived';
    await supabase.from('campaigns').update({ status: next }).eq('id', c.id);
    await load();
  }

  async function deleteCampaign(id) {
    if (!confirm('Delete this campaign? All factions and member assignments will be removed.')) return;
    await supabase.from('campaigns').delete().eq('id', id);
    await load();
  }

  const visible = useMemo(
    () => campaigns.filter((c) => showArchived ? c.status === 'archived' : c.status === 'active'),
    [campaigns, showArchived]
  );

  if (loading) return <p className="text-ink-700/60">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display">Campaigns</h2>
          <p className="text-sm text-ink-700/60">
            {campaigns.filter((c) => c.status === 'active').length} active
            {campaigns.filter((c) => c.status === 'archived').length > 0 &&
              ` · ${campaigns.filter((c) => c.status === 'archived').length} archived`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowArchived(!showArchived)} className="btn-ghost text-sm">
            {showArchived ? 'Show active' : 'Show archived'}
          </button>
          {!adding && (
            <button onClick={() => setAdding(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> New Campaign
            </button>
          )}
        </div>
      </div>

      {adding && <CampaignForm onSave={createCampaign} onCancel={() => setAdding(false)} />}

      {visible.length === 0 ? (
        <div className="card p-8 text-center text-ink-700/50">
          {showArchived ? 'No archived campaigns.' : 'No active campaigns. Start one to track ongoing faction battles.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              factions={factions.filter((f) => f.campaign_id === c.id)}
              members={members}
              allPlayers={allPlayers}
              expanded={expanded === c.id}
              onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
              onArchive={() => archiveCampaign(c)}
              onDelete={() => deleteCampaign(c.id)}
              onChange={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign, factions, members, allPlayers, expanded, onToggle, onArchive, onDelete, onChange }) {
  const [addingFaction, setAddingFaction] = useState(false);

  const totalWins = factions.reduce((s, f) => s + (f.wins || 0), 0);
  const sorted = [...factions].sort((a, b) => (b.wins || 0) - (a.wins || 0));
  const leader = sorted[0];

  async function adjustWins(faction, delta) {
    const next = Math.max(0, (faction.wins || 0) + delta);
    await supabase.from('campaign_factions').update({ wins: next }).eq('id', faction.id);
    onChange();
  }

  async function createFaction(data) {
    const { error } = await supabase.from('campaign_factions').insert({
      campaign_id: campaign.id,
      name: data.name.trim(),
      color: data.color,
      sort_order: factions.length
    });
    if (error) { alert(error.message); return; }
    setAddingFaction(false);
    onChange();
  }

  async function deleteFaction(id) {
    if (!confirm('Remove this faction?')) return;
    await supabase.from('campaign_factions').delete().eq('id', id);
    onChange();
  }

  async function addMember(factionId, playerId) {
    await supabase.from('campaign_faction_members').insert({ faction_id: factionId, player_id: playerId });
    onChange();
  }

  async function removeMember(factionId, playerId) {
    await supabase.from('campaign_faction_members')
      .delete().eq('faction_id', factionId).eq('player_id', playerId);
    onChange();
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-cream-50 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-grass-700 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-ink-700/40 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="font-semibold truncate">{campaign.name}</div>
            <div className="text-xs text-ink-700/60 flex items-center gap-2">
              <span>{factions.length} faction{factions.length === 1 ? '' : 's'}</span>
              <span>·</span>
              <span>{totalWins} total wins</span>
              {leader && leader.wins > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-grass-700 font-medium">
                    <Crown className="w-3 h-3" />
                    <span style={{ color: leader.color }}>●</span>
                    {leader.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {campaign.status === 'archived' && (
          <span className="pill bg-cream-200 text-ink-700/60 ml-2">Archived</span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-grass-100 p-4 bg-cream-50 space-y-3">
          {campaign.description && (
            <p className="text-sm text-ink-700/70 italic">{campaign.description}</p>
          )}

          {/* Faction list */}
          <div className="space-y-2">
            {sorted.map((f, idx) => (
              <FactionRow
                key={f.id}
                faction={f}
                rank={idx + 1}
                members={members.filter((m) => m.faction_id === f.id)}
                allPlayers={allPlayers}
                onAdjust={(delta) => adjustWins(f, delta)}
                onDelete={() => deleteFaction(f.id)}
                onAddMember={(playerId) => addMember(f.id, playerId)}
                onRemoveMember={(playerId) => removeMember(f.id, playerId)}
              />
            ))}
            {factions.length === 0 && (
              <p className="text-sm text-ink-700/50 italic text-center py-2">No factions yet.</p>
            )}
          </div>

          {addingFaction ? (
            <FactionForm
              existingColors={factions.map((f) => f.color)}
              onSave={createFaction}
              onCancel={() => setAddingFaction(false)}
            />
          ) : (
            <button onClick={() => setAddingFaction(true)} className="btn-secondary text-sm w-full justify-center">
              <Plus className="w-4 h-4" /> Add Faction
            </button>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-grass-100">
            <button onClick={onArchive} className="btn-ghost text-xs">
              {campaign.status === 'archived' ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
              {campaign.status === 'archived' ? 'Unarchive' : 'Archive'}
            </button>
            <button onClick={onDelete} className="btn-ghost text-xs text-sun-600">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FactionRow({ faction, rank, members, allPlayers, onAdjust, onDelete, onAddMember, onRemoveMember }) {
  const [showMembers, setShowMembers] = useState(false);
  const memberPlayers = members
    .map((m) => allPlayers.find((p) => p.id === m.player_id))
    .filter(Boolean);
  const availableToAdd = allPlayers.filter((p) => !members.some((m) => m.player_id === p.id));

  return (
    <div className="bg-white border border-grass-100 rounded-lg p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-sm"
             style={{ backgroundColor: faction.color }}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{faction.name}</div>
          <button onClick={() => setShowMembers(!showMembers)} className="text-xs text-ink-700/50 hover:text-ink-700 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {memberPlayers.length} member{memberPlayers.length === 1 ? '' : 's'}
            {showMembers ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onAdjust(-1)} className="w-8 h-8 rounded-lg bg-cream-100 hover:bg-cream-200 flex items-center justify-center transition" disabled={faction.wins === 0}>
            <Minus className="w-4 h-4" />
          </button>
          <div className="w-12 text-center font-display text-2xl tabular-nums leading-none">
            {faction.wins || 0}
          </div>
          <button onClick={() => onAdjust(1)} className="w-8 h-8 rounded-lg bg-grass-100 hover:bg-grass-200 text-grass-700 flex items-center justify-center transition">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <button onClick={onDelete} className="p-1.5 hover:bg-cream-100 rounded text-sun-600">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {showMembers && (
        <div className="mt-3 pt-3 border-t border-grass-100 space-y-2">
          {memberPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {memberPlayers.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 pill bg-grass-100 text-grass-700">
                  {p.belegarth_name || p.name}
                  <button onClick={() => onRemoveMember(p.id)} className="hover:bg-grass-200 rounded-full">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {availableToAdd.length > 0 && (
            <select
              className="input w-full text-sm"
              value=""
              onChange={(e) => { if (e.target.value) onAddMember(e.target.value); }}
            >
              <option value="">+ Add member...</option>
              {availableToAdd.map((p) => (
                <option key={p.id} value={p.id}>{p.belegarth_name || p.name}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="card p-4 space-y-3">
      <div>
        <label className="label">Campaign Name *</label>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Summer 2026 Campaign" />
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Lore, goals, anything." />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost"><X className="w-4 h-4" /> Cancel</button>
        <button onClick={() => name.trim() && onSave({ name, description })} className="btn-primary"><Check className="w-4 h-4" /> Create</button>
      </div>
    </div>
  );
}

function FactionForm({ existingColors, onSave, onCancel }) {
  const [name, setName] = useState('');
  const availableColor = FACTION_COLORS.find((c) => !existingColors.includes(c)) || FACTION_COLORS[0];
  const [color, setColor] = useState(availableColor);

  return (
    <div className="bg-white border-2 border-grass-200 rounded-lg p-3 space-y-3">
      <div>
        <label className="label">Faction Name</label>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="House Crimson, The Wolves, ..." />
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex flex-wrap gap-2">
          {FACTION_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-grass-600 scale-110' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
        <button onClick={() => name.trim() && onSave({ name, color })} className="btn-primary text-sm">Create</button>
      </div>
    </div>
  );
}
