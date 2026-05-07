-- =====================================================
-- BELEGARTH PRACTICE MANAGER — DATABASE SCHEMA
-- Run this in your Supabase SQL editor
-- =====================================================

-- Enable UUID extension (Supabase has it by default but just in case)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PLAYERS — your roster
-- =====================================================
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  belegarth_name TEXT,                     -- field/character name
  weapon_style TEXT,                       -- e.g. 'Sword & Board', 'Florentine', 'Polearm', 'Archer'
  skill_rating NUMERIC(4,2) DEFAULT 5.0,   -- 1-10, used for team balancing seed
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_active ON players(active);

-- =====================================================
-- BATTLE GAMES — your pre-chosen list of battle types
-- =====================================================
CREATE TABLE IF NOT EXISTS battle_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  rules TEXT,
  min_players INTEGER DEFAULT 4,
  team_count INTEGER DEFAULT 2 CHECK (team_count >= 2 AND team_count <= 6),
  in_pool BOOLEAN DEFAULT true,            -- include in random selection?
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SESSIONS — weekly practices
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_date)
);

-- =====================================================
-- SIGN-INS — who showed up
-- =====================================================
CREATE TABLE IF NOT EXISTS sign_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  signed_in_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_signins_session ON sign_ins(session_id);

-- =====================================================
-- BATTLES — instances of a battle game played in a session
-- =====================================================
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES battle_games(id),
  played_at TIMESTAMPTZ DEFAULT NOW(),
  winning_team INTEGER,                    -- 1, 2, etc. — null until reported
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_battles_session ON battles(session_id);

-- =====================================================
-- BATTLE TEAMS — per-player assignment + stats per battle
-- =====================================================
CREATE TABLE IF NOT EXISTS battle_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  UNIQUE(battle_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_battle_teams_battle ON battle_teams(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_teams_player ON battle_teams(player_id);

-- =====================================================
-- AGGREGATED STATS VIEW
-- =====================================================
CREATE OR REPLACE VIEW player_stats AS
SELECT
  p.id,
  p.name,
  p.belegarth_name,
  p.weapon_style,
  p.skill_rating,
  p.active,
  COALESCE(att.sessions_attended, 0) AS sessions_attended,
  COALESCE(bs.battles_played, 0) AS battles_played,
  COALESCE(bs.total_kills, 0) AS total_kills,
  COALESCE(bs.total_deaths, 0) AS total_deaths,
  CASE
    WHEN COALESCE(bs.total_deaths, 0) = 0 THEN COALESCE(bs.total_kills, 0)::numeric
    ELSE ROUND(bs.total_kills::numeric / bs.total_deaths::numeric, 2)
  END AS kd_ratio,
  COALESCE(bs.wins, 0) AS wins,
  CASE
    WHEN COALESCE(bs.battles_played, 0) = 0 THEN 0
    ELSE ROUND(bs.wins::numeric / bs.battles_played::numeric * 100, 1)
  END AS win_pct
FROM players p
LEFT JOIN (
  SELECT player_id, COUNT(DISTINCT session_id) AS sessions_attended
  FROM sign_ins GROUP BY player_id
) att ON p.id = att.player_id
LEFT JOIN (
  SELECT
    bt.player_id,
    COUNT(DISTINCT bt.battle_id) AS battles_played,
    SUM(bt.kills) AS total_kills,
    SUM(bt.deaths) AS total_deaths,
    COUNT(DISTINCT CASE WHEN b.winning_team = bt.team_number THEN b.id END) AS wins
  FROM battle_teams bt
  JOIN battles b ON b.id = bt.battle_id
  GROUP BY bt.player_id
) bs ON p.id = bs.player_id;

-- =====================================================
-- ROW LEVEL SECURITY
-- For a club tracker, we use open policies on anon key.
-- To lock down later: replace 'true' with auth.role() = 'authenticated'
-- and require login in the app.
-- =====================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_teams ENABLE ROW LEVEL SECURITY;

-- Open policies (change later for production hardening)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['players','battle_games','sessions','sign_ins','battles','battle_teams']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "open_all_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "open_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- =====================================================
-- SEED DATA — common Belegarth battle game types
-- =====================================================
INSERT INTO battle_games (name, description, rules, min_players, team_count) VALUES
  ('Open Field', 'Standard team vs team line battle on open ground.', 'Two teams line up on opposite ends. On signal, fight until one team is eliminated. Standard armor and weapon rules apply.', 6, 2),
  ('Bridge Battle', 'Teams clash on a narrow chokepoint.', 'Mark a narrow lane. Teams must engage within the lane. Stepping out = dead. Last team standing wins.', 6, 2),
  ('Last Man Standing', 'Free-for-all elimination.', 'Everyone for themselves. No teams. Last fighter standing wins.', 4, 2),
  ('Capture the Flag', 'Grab the enemy flag and return it home.', 'Each team has a flag at base. Capture the enemy flag and return to your base to win. Tagged players respawn at base.', 8, 2),
  ('King of the Hill', 'Hold the central area.', 'Mark a central zone. Team with the most fighters in the zone after time expires wins. Or: hold uncontested for 30 seconds.', 6, 2),
  ('Last Hero', 'Champion vs the field.', 'One champion (best stats) faces all other players. Champion has 5 lives. Field gets 1 each.', 6, 2),
  ('Civil War', 'Reds vs Whites — even split.', 'Teams split as evenly as possible. Standard line battle rules.', 4, 2),
  ('Three-Way', 'Three-team battle royale.', 'Three balanced teams enter the field at equal distances apart. Last team standing wins.', 9, 3),
  ('Body Guard', 'Protect your VIP.', 'Each team has one designated VIP. Kill the enemy VIP to win. VIP has only 1 life; bodyguards have unlimited.', 6, 2),
  ('Pinwheel', 'Rotating reinforcements.', 'Two small teams fight; eliminated players cycle to a holding area and rejoin after 30s. Run for set time, most kills wins.', 6, 2)
ON CONFLICT (name) DO NOTHING;
