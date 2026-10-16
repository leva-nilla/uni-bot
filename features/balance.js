'use strict';

function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function teamTotal(members) { return members.reduce((sum, person) => sum + person.score, 0); }
function teamAverage(members) { return members.length ? teamTotal(members) / members.length : null; }
function balanceDifference(blue, red) {
  if (!blue.length || !red.length) return 0;
  // With unequal teams, comparing raw totals would punish the larger team for having an extra player.
  return blue.length === red.length
    ? Math.abs(teamTotal(blue) - teamTotal(red))
    : Math.abs(teamAverage(blue) - teamAverage(red));
}
function laneDuplicates(members) {
  const seen = new Set();
  let count = 0;
  for (const p of members) {
    if (!p.lane) continue;
    if (seen.has(p.lane)) count++;
    seen.add(p.lane);
  }
  return count;
}
function assertPlayers(players) {
  if (!Array.isArray(players) || players.length < 1 || players.length > 10 ||
      new Set(players.map(p => p.id)).size !== players.length ||
      players.some(p => !p.id || !Number.isFinite(p.score))) {
    throw new Error('参加者は1〜10人の異なるメンバーが必要です');
  }
}
function balanceTeams(players, random = Math.random) {
  assertPlayers(players);
  if (players.length === 1) return { blue: [...players], red: [], diff: 0 };
  const n = players.length;
  const ranked = [...players].sort((a, b) => b.score - a.score);
  // For 5+ players, prefer splitting the two standout players where possible.
  const exceptionalLeaders = n >= 5 && ranked[1].score - ranked[Math.min(4, n - 1)].score >= 1.5;
  const options = [];
  // n <= 10, so at most 252 valid equal-size subsets (no expensive solver necessary).
  for (let mask = 1; mask < (1 << n) - 1; mask++) {
    let size = 0;
    for (let bit = mask; bit; bit &= bit - 1) size++;
    if (Math.abs(size - (n - size)) > 1) continue;
    const blue = players.filter((_, i) => Boolean(mask & (1 << i)));
    const red = players.filter((_, i) => !Boolean(mask & (1 << i)));
    const diff = balanceDifference(blue, red);
    const leadersTogether = exceptionalLeaders && (blue.includes(ranked[0]) === blue.includes(ranked[1]));
    const duplicates = laneDuplicates(blue) + laneDuplicates(red);
    const cost = Math.max(0, diff - 1) * 10 + (leadersTogether ? 0.8 : 0) + duplicates * 0.12 + diff * 0.015;
    options.push({ blue, red, cost, diff });
  }
  const best = Math.min(...options.map(p => p.cost));
  const eligible = options.filter(p => p.cost <= best + 0.16);
  return eligible[Math.floor(random() * eligible.length)];
}
function randomTeams(players, random = Math.random) {
  assertPlayers(players);
  const mixed = shuffle(players, random);
  const blue = mixed.slice(0, Math.ceil(mixed.length / 2));
  const red = mixed.slice(Math.ceil(mixed.length / 2));
  return { blue, red, diff: balanceDifference(blue, red) };
}
function maxSwapPairs(blue, red) { return Math.min(4, blue.length, red.length); }
function nearbySwap(blue, red, pairCount, random = Math.random) {
  if (!Number.isInteger(pairCount) || pairCount < 1 || pairCount > maxSwapPairs(blue, red) ||
      blue.length + red.length > 10 || blue.length + red.length < 2 ||
      Math.abs(blue.length - red.length) > 1) {
    throw new Error(`交換組数は1〜${maxSwapPairs(blue, red)}組の範囲で指定してください`);
  }
  const currentDiff = balanceDifference(blue, red);
  const candidates = [];
  const usedRed = new Set();
  const chosen = [];
  function search(startA) {
    if (chosen.length === pairCount) {
      const nextBlue = [...blue], nextRed = [...red];
      for (const [i, j] of chosen) [nextBlue[i], nextRed[j]] = [red[j], blue[i]];
      const diff = balanceDifference(nextBlue, nextRed);
      if (diff <= Math.max(1, currentDiff) + 1e-9) candidates.push({ swaps: [...chosen], diff });
      return;
    }
    for (let i = startA; i <= blue.length - (pairCount - chosen.length); i++) {
      for (let j = 0; j < red.length; j++) {
        if (usedRed.has(j) || Math.abs(blue[i].score - red[j].score) > 1 + 1e-9) continue;
        usedRed.add(j); chosen.push([i, j]);
        search(i + 1);
        chosen.pop(); usedRed.delete(j);
      }
    }
  }
  search(0);
  if (!candidates.length) return null;
  const picked = candidates[Math.floor(random() * candidates.length)];
  const nextBlue = [...blue], nextRed = [...red];
  const swapped = [];
  for (const [i, j] of picked.swaps) {
    swapped.push([blue[i].name, red[j].name]);
    [nextBlue[i], nextRed[j]] = [red[j], blue[i]];
  }
  return { blue: nextBlue, red: nextRed, swaps: swapped, diff: picked.diff };
}
module.exports = { balanceTeams, randomTeams, nearbySwap, teamTotal, teamAverage, balanceDifference, maxSwapPairs };
