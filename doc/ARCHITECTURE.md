# システムアーキテクチャドキュメント

## 目次

- [概要](#概要)
- [システム構成](#システム構成)
- [通信フロー](#通信フロー)
- [技術スタック](#技術スタック)
- [ファイル構成](#ファイル構成)
- [状態管理](#状態管理)
- [WebSocketプロトコル](#websocketプロトコル)
- [依存関係の管理](#依存関係の管理)
- [セキュリティ](#セキュリティ)

## 概要

このアプリケーションは、野球のライブ配信用のスコアボードシステムです。操作パネルと表示ボードが WebSocket 経由でリアルタイムに同期し、OBS などの配信ソフトウェアでクロマキー合成して使用できます。

**主要コンポーネント:**
- **操作パネル** (operation.html): 試合状況を更新するUI
- **表示ボード** (board.html): OBSに表示するスコアボード画面
- **WebSocketサーバー** (server.js): HTTP静的ファイルサーバー兼WebSocketリレー

## システム構成

```
操作パネル (operation.html)
    ↓ WebSocket (送信)
WebSocketサーバー (server.js)
    ↓ WebSocket (ブロードキャスト)
表示ボード (board.html) ← リアルタイム反映
```

### サーバーの役割

**server.js** は以下の機能を持つ単一のNode.jsプロセスです:

1. **HTTP静的ファイルサーバー** ([server.js:17-41](../server.js#L17-L41)):
   - `public/` ディレクトリの静的ファイルを配信
   - パストラバーサル攻撃対策を実装
   - `/init_data.json` は `config/init_data.json` から配信

2. **WebSocketリレーサーバー**:
   - 操作パネルからのメッセージを全クライアントにブロードキャスト
   - Master/Slave ロール管理
   - 試合状態の永続化

3. **ロギング** ([server.js:6-14](../server.js#L6-L14)):
   - `NODE_ENV=production` では console.log を無効化
   - 本番環境での不要なログ出力を抑制

## 通信フロー

### 1. 初回接続時

```
1. クライアント → サーバー: HTTP GET / WebSocket接続
2. サーバー → クライアント: 現在の試合状態を送信 (data/current_game.json)
3. クライアント: 受信した状態でUIを初期化
```

### 2. 試合状態更新時

```
1. 操作パネル: ユーザーがスコアやBSOを変更
2. Vue.js watch: boardData 変化を検知
3. 操作パネル → サーバー: game_state_update メッセージ送信
4. サーバー: data/current_game.json に保存
5. サーバー → 全クライアント: game_state をブロードキャスト
6. 表示ボード: 受信した状態で画面を更新
```

### 3. Master/Slave制御

詳細は [Master/Slave Architecture](MASTER_SLAVE_ARCHITECTURE.md) を参照してください。

## 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| HTML5 / CSS3 | - | UI構造とスタイリング |
| Bootstrap 5 | 5.3.3+ | UIコンポーネントとレイアウト |
| Vue.js 3 | 3.4.0+ | リアクティブなUI管理 |

**フロントエンドの構成:**
- **Vue.js 3** ([public/js/operation.js](../public/js/operation.js)): 操作パネルの状態管理
- **Scoreboard Component** ([public/js/Scoreboard.js](../public/js/Scoreboard.js)): SVGスコアボードのVueコンポーネント
- **Bootstrap 5**: レスポンシブなUI、グリッドシステム、カード、ボタン

### バックエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Node.js | 18+ | JavaScriptランタイム |
| ws | 8.13.0+ | WebSocketライブラリ |
| js-yaml | 4.1.0+ | YAML設定ファイルパーサー |

**バックエンドの構成:**
- **HTTP Server**: Node.js 組み込みの `http` モジュール
- **WebSocket Server**: `ws` ライブラリ
- **ファイルシステム**: 試合状態の永続化に使用

## ファイル構成

```
.
├── public/                 # 静的ファイル（Webサーバーが配信）
│   ├── index.html          # トップページ（メニュー）
│   ├── operation.html      # 操作パネルのUI
│   ├── board.html          # OBS等で表示するスコアボード画面
│   ├── settings.html       # 設定ウィンドウのUI（Electron専用、Phase 2で追加）
│   ├── css/
│   │   ├── main.css        # カスタムスタイル
│   │   └── bootstrap.min.css   # Bootstrap CSS (npm経由で自動生成)
│   ├── js/
│   │   ├── Scoreboard.js   # Vue.jsのスコアボードコンポーネント
│   │   ├── operation.js    # 操作パネルのVue.jsアプリケーション
│   │   ├── board.js        # 表示ボードのVue.jsアプリケーション
│   │   ├── settings.js     # 設定ウィンドウのVue.jsアプリ（Electron専用、Phase 2で追加）
│   │   ├── vue.global.js   # Vue.js (npm経由で自動生成)
│   │   └── bootstrap.bundle.min.js  # Bootstrap JS (npm経由で自動生成)
│   └── img/                # 画像ファイル
├── scripts/                # ビルド・ユーティリティスクリプト
│   ├── copy-deps.js        # npm依存関係をpublic/にコピーするスクリプト
│   └── generate-init-data.js  # init_data.json生成ツール
├── config/                 # 設定ファイル
│   ├── init_data.json      # 大会名・チーム名の初期設定ファイル
│   └── config.yaml.example # YAML設定ファイルのサンプル
├── data/                   # 実行時データ
│   └── current_game.json   # 試合状況の保存ファイル（自動生成）
├── doc/                    # ドキュメントと画像
│   ├── ARCHITECTURE.md     # このファイル（システムアーキテクチャ）
│   ├── USER_GUIDE.md       # ユーザーガイド（一般ユーザー向け）
│   ├── CONFIGURATION.md    # 設定ファイルガイド
│   ├── MULTI_PC_SETUP.md   # マルチPC環境構築ガイド
│   ├── TROUBLESHOOTING.md  # トラブルシューティング
│   ├── MASTER_SLAVE_ARCHITECTURE.md  # Master/Slave制御の詳細
│   ├── PRODUCTION_DEPLOYMENT.md      # Webアプリ版本番環境デプロイガイド（PM2）
│   ├── WEBSOCKET_RECONNECTION.md     # WebSocket再接続機能
│   ├── ELECTRON_DEPLOYMENT.md        # Electronアプリデプロイガイド
│   ├── ELECTRON_SETTINGS.md          # Electron設定ウィンドウガイド
│   ├── board.png           # 表示ボードのスクリーンショット
│   ├── index.png           # トップページのスクリーンショット
│   ├── operation.png       # 操作パネルのスクリーンショット
│   ├── operation_slave.png # スレーブ状態のスクリーンショット
│   └── panel.png           # パネルのスクリーンショット
├── logs/                   # ログファイル
│   ├── pm2-error.log       # PM2エラーログ（自動生成）
│   └── pm2-out.log         # PM2標準出力ログ（自動生成）
├── ecosystem.config.js     # PM2設定ファイル
├── main.js                 # Electronメインプロセス（Linux版動作確認済み）
├── preload.js              # Electron preloadスクリプト（セキュアなIPC通信）
├── server.js               # WebサーバーとWebSocketサーバー
├── package.json            # プロジェクト情報と依存ライブラリ
├── CLAUDE.md               # AI開発支援用プロジェクトガイド
└── README.md               # プロジェクトREADME（一般ユーザー向け）
```

**注**: `main.js`はElectronのメインプロセス、`public/js/operation.js`は操作パネルのVue.jsアプリです。

### 主要ファイルの役割

| ファイル | 役割 |
|---------|------|
| [server.js](../server.js) | HTTP/WebSocketサーバー、状態永続化 |
| [public/js/operation.js](../public/js/operation.js) | 操作パネルのロジック、WebSocket送信 |
| [public/js/board.js](../public/js/board.js) | 表示ボードのロジック、WebSocket受信 |
| [public/js/Scoreboard.js](../public/js/Scoreboard.js) | SVGスコアボードコンポーネント |
| [config/init_data.json](../config/init_data.json) | 大会設定（チーム名、イニング数） |
| [data/current_game.json](../data/current_game.json) | 現在の試合状態（自動生成・自動保存） |

## 状態管理

### Vue.js による状態管理

操作パネル ([public/js/operation.js](../public/js/operation.js)) で Vue.js 3 を使用:

```javascript
data() {
  return {
    game_title: '',
    team_top: '',
    team_bottom: '',
    game_inning: 0,
    top: true,
    score_top: 0,
    score_bottom: 0,
    ball_cnt: 0,
    strike_cnt: 0,
    out_cnt: 0,
    first_base: false,
    second_base: false,
    third_base: false,
    last_inning: 9,
    // ...
  }
}
```

### 主要な状態フィールド

| フィールド | 説明 | 範囲/型 |
|-----------|------|---------|
| `game_title` | 大会名 | string |
| `team_top` | 先攻チーム | string |
| `team_bottom` | 後攻チーム | string |
| `game_inning` | 現在のイニング | 0 (試合前), 1-9 (試合中), 10+ (延長・試合後) |
| `top` | 表の攻撃か | boolean (true: 表, false: 裏) |
| `score_top` | 先攻チームの得点 | integer |
| `score_bottom` | 後攻チームの得点 | integer |
| `ball_cnt` | ボールカウント | 0-3 |
| `strike_cnt` | ストライクカウント | 0-2 |
| `out_cnt` | アウトカウント | 0-2 |
| `first_base` | 一塁走者の有無 | boolean |
| `second_base` | 二塁走者の有無 | boolean |
| `third_base` | 三塁走者の有無 | boolean |
| `last_inning` | 最終イニング | integer (通常 9) |

### 状態永続化

**サーバー側の永続化** ([server.js:16-56](../server.js#L16-L56)):
- 試合状態は `data/current_game.json` に自動保存
- サーバー起動時に状態を自動ロード
- 新規クライアント接続時に現在の状態を即座に送信

**クライアント側の状態復元:**
- **操作パネル** ([main.js:143-168](../public/js/operation.js#L143-L168)): サーバーから受信した状態でVueインスタンスを更新
- **表示ボード** ([board.js:73-79](../public/js/board.js#L73-L79)): `boardData` を更新して画面に反映

**状態管理フロー:**
1. ユーザーが操作パネルで試合状態を変更
2. Vue.js の `watch` が `boardData` の変化を検知し `updateBoard()` を実行 ([main.js:94-101, 215-219](../public/js/operation.js#L94-L101))
3. WebSocket経由でサーバーに送信
4. サーバーが `data/current_game.json` に保存し、全クライアントにブロードキャスト ([server.js:81-98](../server.js#L81-L98))
5. 表示ボードが更新を受信し、画面に反映

### 設定ファイルと状態ファイルの違い

| ファイル | 用途 | 内容 | 更新方法 |
|---------|------|------|---------|
| `config/init_data.json` | 大会設定 | 大会名、参加チーム一覧、イニング数 | 手動編集 or `npm run init` |
| `data/current_game.json` | 試合状況 | スコア、BSO、ランナー、現在のイニング | 自動保存（実行時） |

**init_data.json の例:**
```json
{
  "game_title": "夏季大会",
  "team_top": "チームA",
  "team_bottom": "チームB",
  "game_array": ["試合前", 1, 2, 3, 4, 5, 6, 7, 8, 9, "試合終了"],
  "team_items": ["　", "チームA", "チームB", "チームC"],
  "last_inning": 9
}
```

## WebSocketプロトコル

### WebSocket URL の動的生成

WebSocket URL はページのロケーションから動的に生成されます ([main.js:24-28](../public/js/operation.js#L24-L28)):

```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
```

これにより、localhost、LAN内のIPアドレス、ドメイン名など、どのホストからアクセスしても自動的に正しいWebSocket URLが使用されます。

### メッセージタイプ

| タイプ | 方向 | 説明 |
|-------|------|------|
| `handshake` | Client → Server | クライアントタイプを通知（operation/board） |
| `role_assignment` | Server → Client | クライアントのロール割り当て（master/slave/viewer） |
| `role_changed` | Server → Client | ロール変更通知（昇格/降格） |
| `game_state_update` | Client → Server | 試合状態の更新（マスターのみ） |
| `game_state` | Server → Client | 試合状態のブロードキャスト |
| `release_master` | Client → Server | マスター権限の手動解放 |

詳細なプロトコル仕様は [Master/Slave Architecture](MASTER_SLAVE_ARCHITECTURE.md#メッセージプロトコル) を参照してください。

## 依存関係の管理

### npm パッケージ管理

Bootstrap と Vue.js は npm 経由で管理されています。

**依存ファイルの自動コピー:**
`npm install` を実行すると、`postinstall` フックにより [scripts/copy-deps.js](../scripts/copy-deps.js) が自動実行されます:

```bash
npm install
# → postinstall フックで以下が実行される:
# node scripts/copy-deps.js
```

**コピーされるファイル:**
- `node_modules/bootstrap/dist/css/bootstrap.min.css` → `public/css/bootstrap.min.css`
- `node_modules/bootstrap/dist/js/bootstrap.bundle.min.js` → `public/js/bootstrap.bundle.min.js`
- `node_modules/vue/dist/vue.global.js` → `public/js/vue.global.js`

### 手動での依存ファイル更新

```bash
npm run build:deps
```

### 依存パッケージの更新

```bash
# package.json のバージョンを更新してから
npm install

# または、特定のパッケージを直接更新
npm update bootstrap vue
```

### なぜ npm 管理か？

- **バージョン管理**: `package.json` でバージョンを明示的に管理
- **セキュリティ**: `npm audit` でセキュリティ脆弱性をチェック可能
- **依存関係の追跡**: `package-lock.json` で正確な依存関係を記録
- **ビルドプロセスの統合**: `postinstall` フックで自動コピー

## セキュリティ

### パストラバーサル保護

サーバーは [server.js:32-41](../server.js#L32-L41) でパストラバーサル攻撃を防いでいます:

```javascript
// パストラバーサル攻撃を防ぐためのパス正規化
const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
const fullPath = path.join(__dirname, 'public', safePath);

// public/ ディレクトリ外へのアクセスを防止
if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
  res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('403 Forbidden');
  return;
}
```

### 配信範囲の制限

- **静的ファイル**: `public/` ディレクトリのみアクセス可能
- **特別扱い**: `/init_data.json` は `config/init_data.json` から配信
- **その他のファイル**: アクセス不可（403 Forbidden）

### 認証の欠如

**現状:**
- 認証機能は実装されていません
- 任意のユーザーが操作パネルにアクセス可能

**推奨運用環境:**
- 信頼できるローカルネットワーク内での使用
- ファイアウォールでポート8080へのアクセスを制限
- 必要に応じてリバースプロキシ（nginx等）で認証を追加

**将来の拡張案:**
- パスワード保護
- IPアドレス制限
- OAuth認証

詳細は [Master/Slave Architecture - セキュリティ考慮事項](MASTER_SLAVE_ARCHITECTURE.md#セキュリティ考慮事項) を参照してください。

## 参考リンク

- **開発者ガイド**: [CLAUDE.md](../CLAUDE.md)
- **Master/Slave制御**: [MASTER_SLAVE_ARCHITECTURE.md](MASTER_SLAVE_ARCHITECTURE.md)
- **本番環境デプロイ**: [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
- **WebSocket再接続**: [WEBSOCKET_RECONNECTION.md](WEBSOCKET_RECONNECTION.md)

## ライセンス

使用しているオープンソースソフトウェアはすべて MIT License です:
- [Vue.js](https://github.com/vuejs/core) (v3.4.0+)
- [Bootstrap](https://github.com/twbs/bootstrap) (v5.3.3+)
- [ws](https://github.com/websockets/ws) (v8.13.0+)
- [js-yaml](https://github.com/nodeca/js-yaml) (v4.1.0+)
