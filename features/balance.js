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
function assertTen(players) {
  if (!Array.isArray(players) || players.length !== 10 || new Set(players.map(p => p.id)).size !== 10) {
    throw new Error('10人の異なる参加者が必要です');
  }
}
function balanceTeams(players, random = Math.random) {
  assertTen(players);
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const exceptionalLeaders = ranked[1].score - ranked[4].score >= 1.5;
  const options = [];
  // Include player 0 only in Blue to avoid inspecting mirrored teams twice (126 combinations).
  for (let a = 1; a < 10; a++) for (let b = a + 1; b < 10; b++)
    for (let c = b + 1; c < 10; c++) for (let d = c + 1; d < 10; d++) {
      const ids = new Set([0, a, b, c, d]);
      const blue = players.filter((_, i) => ids.has(i));
      const red = players.filter((_, i) => !ids.has(i));
      const diff = Math.abs(teamTotal(blue) - teamTotal(red));
      const leadersTogether = exceptionalLeaders && blue.includes(ranked[0]) === blue.includes(ranked[1]);
      const duplicates = laneDuplicates(blue) + laneDuplicates(red);
      // Up to one tier of *team total* difference is acceptable; otherwise penalize heavily.
      const cost = Math.max(0, diff - 1) * 10 + (leadersTogether ? 0.8 : 0) + duplicates * 0.12 + diff * 0.015;
      options.push({ blue, red, cost, diff });
    }
  const best = Math.min(...options.map(p => p.cost));
  const eligible = options.filter(p => p.cost <= best + 0.16);
  return eligible[Math.floor(random() * eligible.length)];
}
function randomTeams(players, random = Math.random) {
  assertTen(players);
  const mixed = shuffle(players, random);
  return { blue: mixed.slice(0, 5), red: mixed.slice(5), diff: Math.abs(teamTotal(mixed.slice(0, 5)) - teamTotal(mixed.slice(5))) };
}
function nearbySwap(blue, red, pairCount, random = Math.random) {
  if (blue.length !== 5 || red.length !== 5 || !Number.isInteger(pairCount) || pairCount < 1 || pairCount > 4) {
    throw new Error('交換組数は1〜4組にしてください');
  }
  const currentDiff = Math.abs(teamTotal(blue) - teamTotal(red));
  const candidates = [];
  const usedRed = new Set();
  const chosen = [];
  function search(startA) {
    if (chosen.length === pairCount) {
      const blueDelta = chosen.reduce((sum, [i, j]) => sum + red[j].score - blue[i].score, 0);
      const diff = Math.abs((teamTotal(blue) + blueDelta) - (teamTotal(red) - blueDelta));
      if (diff <= Math.max(1, currentDiff) + 1e-9) candidates.push({ swaps: [...chosen], diff });
      return;
    }
    for (let i = startA; i <= 5 - (pairCount - chosen.length); i++) {
      for (let j = 0; j < 5; j++) {
        if (usedRed.has(j) || Math.abs(blue[i].score - red[j].score) > 1 + 1e-9) continue;
        usedRed.add(j); chosen.push([i, j]);
        search(i + 1);
        chosen.pop(); usedRed.delete(j);
      }
    }
  }
  search(0);
  if (!candidates.length) return null;
  // Same-tier pairs preferred, but all swaps that maintain reasonable team balance are valid.
  const picked = candidates[Math.floor(random() * candidates.length)];
  const nextBlue = [...blue], nextRed = [...red];
  const swapped = [];
  for (const [i, j] of picked.swaps) {
    swapped.push([blue[i].name, red[j].name]);
    [nextBlue[i], nextRed[j]] = [red[j], blue[i]];
  }
  return { blue: nextBlue, red: nextRed, swaps: swapped, diff: picked.diff };
}
module.exports = { balanceTeams, randomTeams, nearbySwap, teamTotal };