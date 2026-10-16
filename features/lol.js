'use strict';
const crypto = require('node:crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const { readMemberRoles } = require('./ranks');
const { balanceTeams, randomTeams, nearbySwap, teamTotal } = require('./balance');

const sessions = new Map();
function panel() {
  const embed = new EmbedBuilder().setTitle('LoL カスタムチーム分け')
    .setDescription('VCに10人集まったら、参加者の誰かが「ランク均等」を押すだけ。\n現在入っているVCから参加者を自動取得します。')
    .setColor(0x4a88bf);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lol:balance').setLabel('ランク均等でチーム分け').setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}
function result(session, title) {
  const print = (members) => members.map(p => `${p.lane || '???'} │ ${p.name} │ ${p.rank}`).join('\n');
  const diff = Math.abs(teamTotal(session.blue) - teamTotal(session.red));
  const warnings = session.players.flatMap(p => p.warnings).slice(0, 8);
  const embed = new EmbedBuilder().setTitle(title).setColor(0x3585c5)
    .addFields(
      { name: `BLUE（合計 ${teamTotal(session.blue).toFixed(2)}）`, value: print(session.blue) },
      { name: `RED（合計 ${teamTotal(session.red).toFixed(2)}）`, value: print(session.red) },
      { name: '戦力スコア差', value: `${diff.toFixed(2)} / 1ティア差までを初期編成の許容目安にします` },
    )
    .setFooter({ text: `対象VC: ${session.channelName} ｜ 再抽選は元の10人を固定` });
  if (warnings.length) embed.addFields({ name: 'ロール設定の注意', value: warnings.join('\n').slice(0, 1024) });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lol:random:${session.id}`).setLabel('完全ランダム').setStyle(ButtonStyle.Secondary),
  );
  const select = new StringSelectMenuBuilder().setCustomId(`lol:swap:${session.id}`)
    .setPlaceholder('近いランク同士を何組交換する？')
    .addOptions([1, 2, 3, 4].map(n => ({ label: `${n}組（${n * 2}人）交換`, value: String(n) })));
  return { embeds: [embed], components: [row, new ActionRowBuilder().addComponents(select)], allowedMentions: { parse: [] } };
}
async function voicePlayers(interaction) {
  const guild = interaction.guild;
  const caller = await guild.members.fetch(interaction.user.id);
  const channelId = caller.voice.channelId;
  if (!channelId) throw new Error('チーム分けを押す人は、参加者のVCに入ってください。');
  const voiceStates = [...guild.voiceStates.cache.values()].filter(state => state.channelId === channelId);
  // Do not require the privileged GuildMembers intent: fetch only the members actually in VC.
  const members = await Promise.all(voiceStates.map(state => guild.members.fetch(state.id)));
  // Test-only exception: only explicitly listed Bot IDs on one designated test server.
  // No environment variables => normal behaviour is unchanged.
  const testGuildId = process.env.LOL_TEST_GUILD_ID || '';
  const allowTestBots = testGuildId !== '' && guild.id === testGuildId;
  const testBotIds = allowTestBots ? new Set((process.env.LOL_TEST_BOT_IDS || '')
    .split(',').map(id => id.trim()).filter(id => /^\d{17,20}$/.test(id))) : new Set();
  const humans = members.filter(member => !member.user.bot || testBotIds.has(member.id));
  if (humans.length !== 10) throw new Error(`現在のVCには ${humans.length} 人います。10人集めてから実行してください。`);
  return { players: humans.map(readMemberRoles), channelId, channelName: caller.voice.channel?.name || 'VC' };
}
function newSession({ players, channelId, channelName }) {
  const balanced = balanceTeams(players);
  const session = { id: crypto.randomUUID().slice(0, 12), guildId: null, channelId, channelName, players, blue: balanced.blue, red: balanced.red };
  // Restart invalidates in-memory sessions; cap to avoid unbounded growth.
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
  sessions.set(session.id, session);
  return session;
}
async function start(interaction) {
  await interaction.deferReply();
  try {
    const collected = await voicePlayers(interaction);
    const session = newSession(collected);
    session.guildId = interaction.guildId;
    await interaction.editReply(result(session, 'LoL チーム編成（ランク均等）'));
  } catch (error) {
    await interaction.editReply({ content: error.message, embeds: [], components: [] });
  }
}
async function reroll(interaction, kind, id) {
  const session = sessions.get(id);
  if (!session || session.guildId !== interaction.guildId) {
    return interaction.reply({ content: '編成情報がありません。Bot再起動後は「ランク均等」から作り直してください。', ephemeral: true });
  }
  if (!session.players.some(p => p.id === interaction.user.id)) {
    return interaction.reply({ content: '再抽選は、このカスタムの参加者が操作できます。', ephemeral: true });
  }
  let changed;
  if (kind === 'random') changed = randomTeams(session.players);
  else {
    const count = Number(interaction.values?.[0]);
    changed = nearbySwap(session.blue, session.red, count);
    if (!changed) return interaction.reply({ content: `条件に合う ${count} 組の交換ができません。組数を減らしてください。`, ephemeral: true });
  }
  session.blue = changed.blue;
  session.red = changed.red;
  await interaction.update(result(session, kind === 'random' ? 'LoL チーム再抽選（完全ランダム）' : `LoL チーム再抽選（近接ランク ${changed.swaps.length} 組交換）`));
}
module.exports = { panel, start, reroll };