'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const lol = require('./lol');
const { setEnabled, isEnabled } = require('./uni-settings');
const definitions = [
  new SlashCommandBuilder().setName('lol').setDescription('LoLカスタムのチーム分け')
    .addSubcommand(cmd => cmd.setName('setup').setDescription('カスタムチーム分けパネルを設置'))
    .addSubcommand(cmd => cmd.setName('team').setDescription('参加中VCの10人をランク均等で編成'))
    .setDMPermission(false),
  new SlashCommandBuilder().setName('unioff').setDescription('このサーバーのうに検知を停止')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false),
  new SlashCommandBuilder().setName('union').setDescription('このサーバーのうに検知を再開')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).setDMPermission(false),
];
async function register(client) {
  for (const cmd of definitions) {
    await client.application.commands.create(cmd.toJSON());
  }
  console.log('✅ スラッシュコマンド登録完了');
}
async function handle(interaction) {
  try {
    if (!interaction.inGuild()) return;
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'lol') {
        if (interaction.options.getSubcommand() === 'setup') return interaction.reply(lol.panel());
        if (interaction.options.getSubcommand() === 'team') return lol.start(interaction);
      }
      if (interaction.commandName === 'unioff' || interaction.commandName === 'union') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: 'サーバー管理権限が必要です。', flags: MessageFlags.Ephemeral });
        }
        const enabled = interaction.commandName === 'union';
        setEnabled(interaction.guildId, enabled);
        return interaction.reply({ content: `このサーバーのうに検知を${enabled ? '有効' : '無効'}にしました。`, flags: MessageFlags.Ephemeral });
      }
    }
    if (interaction.isButton() && interaction.customId === 'lol:balance') return lol.start(interaction);
    if (interaction.isButton() && interaction.customId.startsWith('lol:random:')) return lol.reroll(interaction, 'random', interaction.customId.slice('lol:random:'.length));
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('lol:swap:')) return lol.reroll(interaction, 'swap', interaction.customId.slice('lol:swap:'.length));
  } catch (error) {
    console.error('Interaction error:', error);
    const message = { content: '処理に失敗しました。Botのログを確認してください。', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(message).catch(console.error);
    else await interaction.reply(message).catch(console.error);
  }
}
module.exports = { register, handle, isEnabled };