/**
 * Team balancing utilities.
 *
 * balanceTeams() takes a list of present players (each with a `score` value)
 * and distributes them across N teams using a snake draft so total team
 * scores are as even as possible.
 *
 * Score = skill_rating * 10 + min(kd_ratio, 5) * 4 + win_pct/10
 * (clamps prevent one mega-stat from dominating)
 */

export function computePlayerScore(p) {
  const skill = Number(p.skill_rating ?? 5);
  const kd = Math.min(Number(p.kd_ratio ?? 1), 5);
  const winPct = Number(p.win_pct ?? 0);
  return skill * 10 + kd * 4 + winPct / 10;
}

export function balanceTeams(players, teamCount = 2) {
  if (!players?.length) return [];
  const n = Math.max(2, Math.min(6, teamCount));

  // Sort by score, strongest first
  const ranked = [...players]
    .map((p) => ({ ...p, _score: computePlayerScore(p) }))
    .sort((a, b) => b._score - a._score);

  const teams = Array.from({ length: n }, () => []);

  // Snake draft: 0,1,2,...,n-1, n-1,...,1,0, 0,1,...
  let direction = 1;
  let idx = 0;
  for (const player of ranked) {
    teams[idx].push(player);
    idx += direction;
    if (idx === n) {
      idx = n - 1;
      direction = -1;
    } else if (idx < 0) {
      idx = 0;
      direction = 1;
    }
  }

  // Light shuffle within each team for visual variety (doesn't affect balance)
  return teams.map((team) => shuffleInPlace([...team]));
}

export function teamTotal(team) {
  return team.reduce((sum, p) => sum + (p._score ?? computePlayerScore(p)), 0);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickRandomBattle(games) {
  const pool = games.filter((g) => g.in_pool);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

const TEAM_NAMES = [
  ['Crimson', 'Ivory'],
  ['Wolves', 'Ravens'],
  ['North', 'South'],
  ['Drakes', 'Stags'],
  ['Vanguard', 'Rearguard'],
  ['Iron', 'Bronze'],
  ['Storm', 'Flame']
];

export function pickTeamLabels(count = 2) {
  if (count === 2) {
    const pair = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
    return [...pair];
  }
  const palette = ['Crimson', 'Ivory', 'Emerald', 'Cobalt', 'Obsidian', 'Amber'];
  return palette.slice(0, count);
}
