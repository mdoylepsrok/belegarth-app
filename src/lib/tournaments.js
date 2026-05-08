/**
 * Tournament logic helpers — bracket seeding, match generation, standings.
 */

export function getMatchTarget(format, customTarget = 2) {
  switch (format) {
    case 'bo3': return 2;
    case 'bo5': return 3;
    case 'ft10': return 10;
    case 'custom': return Math.max(1, customTarget);
    default: return 2;
  }
}

export function formatLabel(format, target) {
  switch (format) {
    case 'bo3': return 'Best of 3';
    case 'bo5': return 'Best of 5';
    case 'ft10': return 'First to 10';
    case 'custom': return `First to ${target}`;
    default: return format;
  }
}

/**
 * Standard bracket seeding pairings.
 * Returns array of [seedA, seedB] pairs for round 1, in position order.
 */
export function bracketSeedPairings(size) {
  if (size === 4) {
    return [[1, 4], [2, 3]];
  }
  if (size === 8) {
    return [[1, 8], [4, 5], [2, 7], [3, 6]];
  }
  throw new Error(`Unsupported bracket size: ${size}`);
}

/**
 * Generate bracket match rows for a list of seeded participants.
 * Pre-creates all rounds with empty player slots for later rounds.
 *
 * @param {Array} seededParticipants - participants sorted by seed (1, 2, 3, ...)
 * @param {number} bracketSize - 4 or 8
 * @returns {Array} match objects ready to insert (without tournament_id)
 */
export function generateBracketMatches(seededParticipants, bracketSize) {
  const matches = [];
  const pairings = bracketSeedPairings(bracketSize);

  // Map of seed → player id
  const bySeed = {};
  seededParticipants.forEach((p, idx) => { bySeed[idx + 1] = p.player_id || p.id; });

  const totalRounds = Math.log2(bracketSize);

  // Round 1: all pairings filled
  pairings.forEach((pair, position) => {
    matches.push({
      round: 1,
      position,
      player_a_id: bySeed[pair[0]] || null,
      player_b_id: bySeed[pair[1]] || null,
      status: bySeed[pair[0]] && bySeed[pair[1]] ? 'pending' : 'pending'
    });
  });

  // Rounds 2..N: empty slots, fill in as winners advance
  for (let r = 2; r <= totalRounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r);
    for (let p = 0; p < matchesInRound; p++) {
      matches.push({
        round: r,
        position: p,
        player_a_id: null,
        player_b_id: null,
        status: 'pending',
        is_final: r === totalRounds
      });
    }
  }

  return matches;
}

/**
 * Generate every pairing for a round robin.
 * Position is sequential. Round is always 1 for RR (just ordering).
 */
export function generateRoundRobinMatches(participants) {
  const matches = [];
  let position = 0;
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      matches.push({
        round: 1,
        position: position++,
        player_a_id: participants[i].player_id || participants[i].id,
        player_b_id: participants[j].player_id || participants[j].id,
        status: 'pending'
      });
    }
  }
  return matches;
}

/**
 * Compute round-robin standings.
 * Returns array of { player_id, match_wins, match_losses, game_wins, game_losses }
 * sorted by match_wins desc, then game differential desc.
 */
export function computeRRStandings(participants, matches) {
  const stats = {};
  participants.forEach((p) => {
    const id = p.player_id || p.id;
    stats[id] = {
      player_id: id,
      match_wins: 0,
      match_losses: 0,
      game_wins: 0,
      game_losses: 0
    };
  });

  matches.filter((m) => !m.is_final).forEach((m) => {
    if (!stats[m.player_a_id] || !stats[m.player_b_id]) return;
    stats[m.player_a_id].game_wins += m.player_a_wins || 0;
    stats[m.player_a_id].game_losses += m.player_b_wins || 0;
    stats[m.player_b_id].game_wins += m.player_b_wins || 0;
    stats[m.player_b_id].game_losses += m.player_a_wins || 0;

    if (m.status === 'completed' && m.winner_id) {
      const loser = m.winner_id === m.player_a_id ? m.player_b_id : m.player_a_id;
      stats[m.winner_id].match_wins += 1;
      if (stats[loser]) stats[loser].match_losses += 1;
    }
  });

  return Object.values(stats).sort((a, b) => {
    if (b.match_wins !== a.match_wins) return b.match_wins - a.match_wins;
    const aDiff = a.game_wins - a.game_losses;
    const bDiff = b.game_wins - b.game_losses;
    return bDiff - aDiff;
  });
}

/**
 * Find which round/position/slot the winner of `match` advances to.
 * Returns null if it's the final.
 */
export function nextMatchSlot(match) {
  if (match.is_final) return null;
  return {
    round: match.round + 1,
    position: Math.floor(match.position / 2),
    slot: match.position % 2 === 0 ? 'a' : 'b'
  };
}
