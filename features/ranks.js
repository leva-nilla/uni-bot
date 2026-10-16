'use strict';

// These are heuristic custom-game points, not Riot MMR. A trailing + / +α
// indicates "and above" in a Discord role name; it does not add extra points.
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
const FOLD_SEPARATOR = /[\s_\-‐‑–—・:：()（）\[\]【】]/g;
const TOKEN_SEPARATOR = /[\s_,，、;；/／|｜・:：()（）\[\]【】{}<>〈〉「」『』+＋]+/u;
function normalize(text) {
  return String(text).normalize('NFKC').toLowerCase().replace(FOLD_SEPARATOR, '');
}
function matchInRole(name, alias) {
  const original = String(name).normalize('NFKC').toLowerCase();
  const compact = normalize(original);
  const needle = normalize(alias);
  if (!needle) return false;
  // Recognize aliases as standalone tokens even inside decorated role names:
  // "メイン / top / LoL", "ランク：Master +α", etc.
  const tokens = original.split(TOKEN_SEPARATOR).filter(Boolean);
  if (tokens.includes(needle)) return true;
  let at = compact.indexOf(needle);
  while (at !== -1) {
    const before = compact[at - 1] || '';
    const after = compact[at + needle.length] || '';
    const latin = /^[a-z]+$/.test(needle);
    // Don't match "top" in "topology" or "master" in "masterpiece".
    if (!latin || (!/[a-z]/.test(before) && !/[a-z]/.test(after))) return true;
    at = compact.indexOf(needle, at + 1);
  }
  return false;
}
const RANK_ALIASES = TIERS.flatMap((tier, index) => tier.aliases.map(alias => ({ tier, index, alias })));

function rankFromName(name) {
  // If one role deliberately contains multiple tiers (e.g. "Master / Grandmaster+α"),
  // use the highest one; don't confuse "Master" inside "Grandmaster".
  const matches = RANK_ALIASES.filter(entry => matchInRole(name, entry.alias));
  if (!matches.length) return null;
  const match = matches.reduce((best, entry) => !best || entry.index > best.index ? entry : best, null);
  let division = null;
  if (match.index < 7) {
    const value = normalize(name);
    const alias = normalize(match.alias);
    const tail = value.slice(value.indexOf(alias) + alias.length);
    const token = tail.match(/^(iv|iii|ii|i|[1-4])(?=$|[^a-z0-9])/i);
    if (token) division = { '4': 4, iv: 4, '3': 3, iii: 3, '2': 2, ii: 2, '1': 1, i: 1 }[token[1]];
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
  // Japanese suffixes like "topレーン" and English aliases such as "top" / "jg"
  // are both supported, including mixed-case and decorated role names.
  const compact = normalize(name);
  for (const lane of LANES) {
    for (const alias of lane.aliases) {
      const needle = normalize(alias);
      if (matchInRole(name, alias) ||
          compact === `main${needle}` || compact === `メイン${needle}` ||
          compact === `${needle}レーン` || compact === `${needle}ロール`) return lane.id;
    }
  }
  return null;
}
function readMemberRoles(member) {
  const roles = [...member.roles.cache.values()].map(role => role.name);
  const ranks = roles.map(rankFromName).filter(Boolean);
  const lanes = [...new Set(roles.map(laneFromName).filter(Boolean))];
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