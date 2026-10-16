require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const { register, handle, isEnabled } = require('./features/commands');

process.on('unhandledRejection', reason => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
  if (err.name === 'Error' && err.message.includes('token')) process.exit(1);
});

const UNI_PATTERNS = ['うに', 'ウニ', 'ｳﾆ', '雲丹', '海胆', '\\buni\\b'];
const RESPONSES = ['🍣 うにを検知しました！', '🦀 うに発見！！', '🐡 ここにうにがいます！', '🍣 うにうにうに～！', '🌊 海の幸「うに」を感知！'];
const REACTION_EMOJI = '🍣';
function detectUni(content) {
  const pattern = new RegExp(`(${UNI_PATTERNS.join('|')})`, 'gi');
  const matches = content.match(pattern);
  if (!matches) return { found: false, highlighted: content, count: 0 };
  return { found: true, highlighted: content.replace(pattern, '**【$1】**'), count: matches.length };
}
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
});
client.once(Events.ClientReady, () => {
  console.log(`✅ ログイン成功: ${client.user.tag}`);
  console.log(`📡 ${client.guilds.cache.size} サーバーに接続中`);
  register(client).catch(err => console.error('コマンド登録失敗:', err));
});
client.on(Events.InteractionCreate, handle);
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot || !isEnabled(message.guildId)) return;
  const result = detectUni(message.content);
  if (!result.found) return;
  try {
    await message.react(REACTION_EMOJI);
    const embed = new EmbedBuilder().setColor(0xFFA500)
      .setTitle(RESPONSES[Math.floor(Math.random() * RESPONSES.length)])
      .setDescription(result.highlighted)
      .setFooter({ text: `🍣 ${result.count}個のうにを検出` }).setTimestamp();
    await message.reply({ embeds: [embed] });
  } catch (error) { console.error('メッセージ処理エラー:', error); }
});
const token = process.env.DISCORD_TOKEN;
if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ DISCORD_TOKEN が設定されていません。.env ファイルを確認してください。');
  process.exit(1);
}
const http = require('node:http');
const PORT = process.env.PORT || 8000;
http.createServer((req, res) => {
  console.log(`📩 Received ${req.method} request for ${req.url} from ${req.socket.remoteAddress}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
}).listen(PORT, () => console.log(`🌐 Health check server listening on port ${PORT}`));
console.log('🚀 Bot process starting...');
client.login(token).catch(err => { console.error('❌ Login failed:', err); process.exit(1); });
function shutdown(signal) {
  console.log(`👋 ${signal} received. Shutting down...`);
  client.destroy();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));