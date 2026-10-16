'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rankFromName, laneFromName } = require('../features/ranks');
const { balanceTeams, randomTeams, nearbySwap, teamTotal } = require('../features/balance');

test('rank names: Japanese/English, hiragana/katakana, and division', () => {
  assert.equal(rankFromName('ぶろんず').score, 1);
  assert.equal(rankFromName('シルバー').score, 2);
  assert.equal(rankFromName('Gold IV').score, 3);
  assert.equal(rankFromName('ゴールド1').score, 3.75);
  assert.equal(rankFromName('Diamond II').score, 6.5);
  assert.equal(rankFromName('グラマス').score, 8);
  assert.equal(rankFromName('grandmaster').score, 8);
  assert.equal(rankFromName('ちゃれんじゃー').score, 9);
  assert.equal(rankFromName('別ゲーム用'), null);
});
test('main-lane role detection', () => {
  assert.equal(laneFromName('JG'), 'JG');
  assert.equal(laneFromName('みっど'), 'MID');
  assert.equal(laneFromName('サポート'), 'SUP');
  assert.equal(laneFromName('TOP'), 'TOP');
});
const players = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: `P${i}`, score: [9, 8, 6, 5, 4, 4, 3, 2, 1, 0][i], lane: ['TOP','JG','MID','ADC','SUP'][i % 5] }));
test('balanced teams partition exactly ten members and split strong ranks', () => {
  for (let seed = 0; seed < 20; seed++) {
    const result = balanceTeams(players, () => seed / 20);
    assert.equal(result.blue.length, 5);
    assert.equal(result.red.length, 5);
    assert.equal(new Set([...result.blue, ...result.red].map(p => p.id)).size, 10);
    assert.equal(Math.abs(teamTotal(result.blue) - teamTotal(result.red)) <= 1, true);
  }
});
test('completely random output partitions ten', () => {
  const result = randomTeams(players, () => 0.33);
  assert.equal(new Set([...result.blue, ...result.red].map(p => p.id)).size, 10);
});
test('nearby swaps 1 to 4 distinct cross-team pairs without worsening total difference', () => {
  const blue = players.filter((_, i) => i % 2 === 0);
  const red = players.filter((_, i) => i % 2 === 1);
  const before = Math.abs(teamTotal(blue) - teamTotal(red));
  for (let count = 1; count <= 4; count++) {
    const result = nearbySwap(blue, red, count, () => 0.2);
    if (!result) continue;
    assert.equal(result.swaps.length, count);
    assert.equal(new Set([...result.blue, ...result.red].map(p => p.id)).size, 10);
    assert.equal(result.diff <= Math.max(before, 1), true);
  }
});
test('swap returns null if no near-ranked partners', () => {
  const blue = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, name: 'a', score: 9 }));
  const red = Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, name: 'b', score: 0 }));
  assert.equal(nearbySwap(blue, red, 4), null);
});