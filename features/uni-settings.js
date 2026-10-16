'use strict';
const fs = require('node:fs');
const path = require('node:path');
const settingsPath = process.env.UNI_SETTINGS_PATH || path.join(process.cwd(), 'data', 'uni-settings.json');
let disabled = {};
try {
  if (fs.existsSync(settingsPath)) disabled = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (error) {
  console.error('うに検知の設定読み込み失敗。安全のため検知OFFで起動します:', error);
  disabled = null;
}
function isEnabled(guildId) { return disabled !== null && !disabled[guildId]; }
function setEnabled(guildId, enabled) {
  if (disabled === null) throw new Error('設定ファイルが壊れているため変更を停止しました');
  const next = { ...disabled };
  if (enabled) delete next[guildId];
  else next[guildId] = true;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const tmp = `${settingsPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, settingsPath);
    disabled = next;
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
module.exports = { isEnabled, setEnabled };