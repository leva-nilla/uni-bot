'use strict';

// Tier intervals are a custom-game heuristic, not Riot MMR.
const TIERS = [
  { id: 'IRON', label: 'Iron', aliases: ['iron', 'アイアン', 'あいあん'] },
  { id: 'BRONZE', label: 'Bronze', aliases: ['bronze', 'ブロンズ', 'ぶろんず'] },
  { id: 'SILVER', label: 'Silver', aliases: ['silver', 'シルバー', 'しるばー'] },
  { id: 'GOLD', label: 'Gold', aliases: ['gold', 'ゴールド', 'ごーるど'] },
  { id: 'PLATINUM', label: 'Platinum', aliases: ['platinum', 'plat', 'プラチナ', 'ぷらちな'] },
  { id: 'EMERALD', label: 'Emerald', aliases: ['emerald', 'エメラルド', 'えめらるど'] },
  { id: 'DIAMOND', label: 'Diamond', aliases: ['diamond', 'dia', 'ダイヤモンド', 'だいやもんど', 'ダイヤ', 'だいや'] },
  { id: 'MASTER', label: 'Master', aliases: ['master', 'マスター', 'ますたー'] },
  { id: 'GRANDMASTER', label: 'Grandmaster', aliases: ['grandmaster', 'grand master', 'グランドマスター', 'ぐらんどますたー', 'グラマス', 'ぐらます'] },
  { id: 'CHALLENGER', label: 'Challenger', aliases: ['challenger', 'チャレンジャー', 'ちゃれんじゃー', 'チャレ', 'ちゃれ'] },
];
const LANES = [
  { id: 'TOP', aliases: ['top', 'toplane', 'トップ', 'とっぷ'] },
  { id: 'JG', aliases: ['jg', 'jungle', 'jungler', 'ジャングル', 'じゃんぐる', 'ジャングラー', 'じゃんぐらー'] },
  { id: 'MID', aliases: ['mid', 'middle', 'ミッド', 'みっど'] },
  { id: 'ADC', aliases: ['adc', 'bot', 'bottom', 'ボット', 'ぼっと', 'マークスマン', 'まーくすまん'] },
  { id: 'SUP', aliases: ['sup', 'support', 'サポート', 'さぽーと', 'サポ', 'さぽ'] },
];
function normalize(text) {
  return String(text).normalize('NFKC').toLowerCase().replace(/[\s_\-‐‑–—・:：()\[\]【】]/g, '');
}
const RANK_ALIASES = TIERS.flatMap((tier, index) => tier.aliases.map(alias => ({
  tier, index, alias: normalize(alias),
}))).sort((a, b) => b.alias.length - a.alias.length);
const LANE_ALIASES = LANES.flatMap(lane => lane.aliases.map(alias => ({
  id: lane.id, alias: normalize(alias),
}))).sort((a, b) => b.alias.length - a.alias.length);

function rankFromName(name) {
  const value = normalize(name);
  const match = RANK_ALIASES.find(entry => value.includes(entry.alias));
  if (!match) return null;
  let division = null;
  if (match.index < 7) {
    const tail = value.slice(value.indexOf(match.alias) + match.alias.length);
    const token = tail.match(/^(iv|iii|ii|i|[1-4])(?=$|[^a-z0-9])/i)
      || tail.match(/^(iv|iii|ii|i|[1-4])$/i);
    if (token) {
      division = { '4': 4, iv: 4, '3': 3, iii: 3, '2': 2, ii: 2, '1': 1, i: 1 }[token[1]];
    }
  }
  const offset = division === null ? 0 : (4 - division) * 0.25;
  return {
    id: match.tier.id,
    label: `${match.tier.label}${division === null ? '' : ` ${['', 'I', 'II', 'III', 'IV'][division]}`}`,
    score: match.index + offset,
    division,
  };
}
function laneFromName(name) {
  const value = normalize(name);
  return LANE_ALIASES.find(entry => value === entry.alias || value.endsWith(entry.alias) || value.startsWith(entry.alias))?.id || null;
}
function readMemberRoles(member) {
  const roles = [...member.roles.cache.values()].map(role => role.name);
  const ranks = roles.map(rankFromName).filter(Boolean);
  const lanes = [...new Set(roles.map(laneFromName).filter(Boolean))];
  // Multi-ranked members (e.g., Solo/Flex) require server-level cleanup; avoid silently treating both as one.
  const rank = ranks.sort((a, b) => b.score - a.score)[0] || null;
  const warnings = [];
  if (!rank) warnings.push(`${member.displayName}: ランク未設定（仮にGold=3点）`);
  if (ranks.length > 1) warnings.push(`${member.displayName}: ランクロールが複数（最高ランクを使用）`);
  if (!lanes.length) warnings.push(`${member.displayName}: メインレーン未設定`);
  if (lanes.length > 1) warnings.push(`${member.displayName}: メインレーンが複数（先頭を使用）`);
  return {
    id: member.id,
    name: member.displayName,
    rank: rank?.label || '未設定',
    score: rank?.score ?? 3,
    lane: lanes[0] || null,
    warnings,
  };
}
module.exports = { rankFromName, laneFromName, readMemberRoles, TIERS };