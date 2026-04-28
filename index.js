require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// ─── 設定 ───────────────────────────────────────────────
const UNI_PATTERNS = [
  'うに',        // ひらがな
  'ウニ',        // カタカナ
  'ｳﾆ',         // 半角カタカナ
  '雲丹',        // 漢字
  '海胆',        // 漢字
  '\\buni\\b',   // 英語（単語境界を使用。universeやunique等を除外）
];

// 反応メッセージ（ランダムで選ばれる）
const RESPONSES = [
  '🍣 うにを検知しました！',
  '🦀 うに発見！！',
  '🐡 ここにうにがいます！',
  '🍣 うにうにうに～！',
  '🌊 海の幸「うに」を感知！',
];

// リアクション絵文字
const REACTION_EMOJI = '🍣';

// ─── ユーティリティ ──────────────────────────────────────
/**
 * メッセージ内の「うに」「ウニ」を検出し、該当箇所をハイライトした文字列を返す
 * @param {string} text - 検査するテキスト
 * @returns {{ found: boolean, highlighted: string, count: number }}
 */
function detectUni(text) {
  // 大文字・小文字やカタカナ・ひらがな混在に対応するため
  // 全パターンを正規表現でまとめる
  const pattern = new RegExp(`(${UNI_PATTERNS.join('|')})`, 'gi');
  const matches = text.match(pattern);

  if (!matches) {
    return { found: false, highlighted: text, count: 0 };
  }

  // 該当箇所を【】で囲んでハイライト
  const highlighted = text.replace(pattern, '**【$1】**');

  return {
    found: true,
    highlighted,
    count: matches.length,
  };
}

/**
 * ランダムに応答メッセージを選ぶ
 */
function getRandomResponse() {
  return RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
}

// ─── Bot本体 ─────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ ログイン成功: ${client.user.tag}`);
  console.log(`📡 ${client.guilds.cache.size} サーバーに接続中`);
});

client.on('messageCreate', async (message) => {
  // Bot自身のメッセージは無視
  if (message.author.bot) return;

  const result = detectUni(message.content);

  if (!result.found) return;

  try {
    // リアクションを付ける
    await message.react(REACTION_EMOJI);

    // Embedで返信
    const embed = new EmbedBuilder()
      .setColor(0xFFA500) // うにっぽいオレンジ色
      .setTitle(getRandomResponse())
      .setDescription(result.highlighted)
      .setFooter({
        text: `🍣 ${result.count}個のうにを検出`,
      })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error('メッセージ処理エラー:', err);
  }
});

// ─── 起動 ─────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ DISCORD_TOKEN が設定されていません。.env ファイルを確認してください。');
  process.exit(1);
}

// Koyeb等のヘルスチェック用HTTPサーバー
const http = require('http');
const PORT = process.env.PORT || 8000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
}).listen(PORT, () => {
  console.log(`🌐 Health check server listening on port ${PORT}`);
});

client.login(token);
