# uni-bot

従来の「うに」検知に加え、LoLカスタムの5対5チーム分けを行うDiscord Botです。

## 使い方

- `/lol setup`: チーム分けパネルを投稿する（初回だけ）。パネルの「ランク均等」を押した人がいるVCの10人を取得します。
- `/lol team`: パネルを使わず、現在のVCからランク均等の5対5編成を作成します。
- 結果パネルの「完全ランダム」: 同じ10人を5対5でランダム再抽選。
- 結果パネルのセレクトメニュー: 別チームのランクが近い相手（スコア差1以下）を1〜4組交換。チーム総スコア差の悪化を抑えます。人数条件が成立しない場合はエラーを表示します。
- `/unioff`: **サーバー管理権限（Manage Server）が必要**。このサーバーのうに検知を無効化。
- `/union`: このサーバーのうに検知を再開。

コマンドはBotの起動時に登録されます。Discordアプリ内に反映されるまで多少時間がかかる場合があります。Bot招待時には `bot` と `applications.commands` のスコープを付けてください。

## ランク・レーンの認識

Discordの既存ロール名から自動認識。ランクは **Iron / アイアン / あいあん** から **Challenger / チャレンジャー / ちゃれんじゃー** まで、英語・カタカナ・ひらがなの代表表記に対応しています。`Gold IV`, `ゴールド1` などのディビジョンも対応。

スコアは Iron=0、Bronze=1、Silver=2、Gold=3、Platinum=4、Emerald=5、Diamond=6、Master=7、Grandmaster=8、Challenger=9。IV, III, II, I はそれぞれ +0, +0.25, +0.5, +0.75。これは競技レーティングではなく簡易バランス指標です。

レーンは TOP/JG/MID/ADC/SUP と日本語の一般的な別名を認識。編成ではメインレーンの重複を**補助的に**減らします。実際のレーン配置変更や対面レーン別実力比較は行いません。

ランクがない人は Gold=3 に仮置きして警告を表示。ランクロールが複数ある場合は最高ランクを暫定採用して警告を表示。正確な運用には、1人1ランク・1メインレーンにしてください。

## 起動と権限

`npm ci && npm start`。環境変数 `DISCORD_TOKEN` が必要。Koyeb向けヘルスチェック用に `PORT`（既定8000）にHTTPサーバーを起動します。

Discord Developer Portalで **Message Content Intent** を有効にしてください（既存うに検知用）。**Guild Voice States Intent** はコードで有効にしています。VC参加者と各個人のロール取得にはメンバーの取得が必要です。

## 保存とKoyebへの反映

- うに検知OFF/ONは `UNI_SETTINGS_PATH`（既定 `data/uni-settings.json`）のJSONに保存します。サーバー単位です。
- **重要：Koyebの通常のコンテナ内ファイルは再デプロイ時に消えます。** 設定を再起動・再デプロイ後も保存する場合は永続ストレージを利用し、そのパスを `UNI_SETTINGS_PATH` に指定してください。永続ストレージがなければ既定はうに検知ONに戻ります。
- 編成結果・再抽選の状態はメモリ保存です。再起動後は `/lol team` またはパネルの初期編成をやり直してください。
- `koyeb.yaml` は既存のまま。KoyebでGitHub連携の対象ブランチが `main`、Autodeployが有効なら、PRを `main` にマージすると再デプロイされます。PRを開いただけでは本番反映されません。

## 開発と検証

`npm test` でランク認識、チーム分配、再抽選のロジックをテストします。

## LoL カスタムの人数・Bot権限（2026-10）

`/lol setup` で操作パネルを設置、または `/lol team` で現在のVCにいる **1〜10人** を編成します。
- 1人: BLUE 1 / RED 0（表示検証用）。2〜10人: できるだけ半分ずつ。奇数なら人数差は1。
- ランク均等・完全ランダム再抽選を利用可能。近いランク同士の交換は **1〜min(4, 両チームの少ない方の人数)組**。1人の場合は交換メニューを表示しません。
- 奇数人数時のランク差は、合計スコアではなく **平均ランクスコア**で評価します。実際のLoLカスタム対戦のマッチングとして意味があるのは原則10人のときです。
- 11人以上のVCではエラーを表示します。参加者の選択機能は未実装です。
- 結果を再抽選するときは、初回に取得したメンバーを維持します。

### Discordの権限

uni-bot 本体には、サーバーへのインストールに `bot` / `applications.commands` スコープを指定します。Botロールは最低限 **View Channel / Send Messages / Embed Links / Read Message History / Add Reactions** を許可してください。
- LoL編成機能はVCの**状態を読み取るだけ**で、VCへBot自身を入れる必要はありません。**Connect / Speak / Move Members は不要**。
- Discord Developer Portal → Bot の **Message Content Intent** は、既存の「うに」メッセージ検知に必要です。`GuildVoiceStates` は標準のGateway Intentで、コード側ですでに有効化済みです。
- `/unioff` と `/union` を押す**ユーザー**には「サーバー管理（Manage Server）」が必要です。Bot自身に `Manage Guild` 権限を付与する必要はありません。

独立テストツール (`uni-bot-vc-test-harness`) のBot #1〜9には、**View Channel / Connect** を付けます。Bot #1でロール付与を自動化する場合だけ、追加で **Manage Roles** を付けてBot #1のロールを対象ロールより上に移動します。自己ミュート参加のため Speak / Administrator は不要です。

専用テストサーバーでテストBotをカウントする場合は、uni-bot側に `LOL_TEST_GUILD_ID` と `LOL_TEST_BOT_IDS` を設定してください。未設定時・通常サーバーではBot参加者を除外します。

### Koyeb

GitHub連携したサービスで `main` ブランチの **Autodeploy** が有効なら、マージ後のコミットから自動デプロイされます。公開リポジトリURLを直接指定したサービスは、自動デプロイが無効な場合があります。Koyebのサービス画面で **Settings → Source → Autodeploy** と **Deployments（稼働バージョン）** を確認してください。
