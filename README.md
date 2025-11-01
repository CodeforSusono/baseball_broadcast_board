# 野球中継スコアボード (Baseball Broadcast Board)

YouTube 等のライブ配信で野球の試合を中継する際に、OBS のような配信ソフトウェアにスコアボード画面をクロマキー合成で表示するためのアプリケーションです。

![表示ボード](doc/board.png)

## 主な機能

- **リアルタイム更新**: 操作パネルから入力した内容が、WebSocket を通じて即座に表示ボードへ反映されます。
- **状態の永続化**: 試合状況がサーバー側に自動保存され、ブラウザのリフレッシュやサーバー再起動後も試合を継続できます。
- **シンプルな操作画面**: Web ブラウザから誰でも簡単に試合状況（スコア、イニング、SBO カウント、ランナー情報）を更新できます。
- **OBS 連携**: 表示ボードは背景が緑色になっており、OBS などの配信ソフトウェアで簡単にクロマキー合成できます。
- **マルチPC対応**: サーバーのIPアドレスを指定することで、別のPCから操作パネルと表示ボードにアクセス可能です。
- **設定自動生成**: コマンドラインツールで`init_data.json`を簡単に生成できます（インタラクティブモード、YAML、コマンドライン引数の3つの方法に対応）。

## システム構成

トップページ(`index.html`)から、操作パネル(`operation.html`)と表示ボード(`board.html`)へアクセスします。操作パネルと表示ボードは、WebSocket サーバー(`server.js`)を介してリアルタイムに通信します。

```mermaid
graph LR;
    subgraph "サーバー"
        D("WebSocketサーバー</br>server.js");
    end

    subgraph "クライアント (ブラウザ)"
        A("トップページ</br>index.html");
        B("操作パネル</br>operation.html");
        C("表示ボード</br>board.html");
    end

    D <-->|WebSocket| B;
    D -->|WebSocket| C;
    A --> B;
    A --> C;
```

## 主要ファイル構成

```
.
├── public/                 # 静的ファイル（Webサーバーが配信）
│   ├── index.html          # トップページ（メニュー）
│   ├── operation.html      # 操作パネルのUI
│   ├── board.html          # OBS等で表示するスコアボード画面
│   ├── css/
│   │   ├── main.css        # カスタムスタイル
│   │   └── bootstrap.min.css   # Bootstrap CSS (npm経由で自動生成)
│   ├── js/
│   │   ├── Scoreboard.js   # Vue.jsのスコアボードコンポーネント
│   │   ├── main.js         # 操作パネルのVue.jsアプリケーション
│   │   ├── board.js        # 表示ボードのVue.jsアプリケーション
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
├── logs/                   # ログファイル
│   ├── pm2-error.log       # PM2エラーログ（自動生成）
│   └── pm2-out.log         # PM2標準出力ログ（自動生成）
├── ecosystem.config.js     # PM2設定ファイル
├── server.js               # WebサーバーとWebSocketサーバー
├── package.json            # プロジェクト情報と依存ライブラリ
└── doc/                    # ドキュメントや画像
```

## 技術スタック

- **フロントエンド**:
  - HTML5 / CSS3
  - Bootstrap 5
  - Vue.js 3
- **バックエンド**:
  - Node.js
  - ws (WebSocket ライブラリ)
  - js-yaml (YAML パーサー)

## セットアップと実行方法

**前提条件**: [Node.js](https://nodejs.org/)と npm がインストールされていること。

1.  **依存関係のインストール**:
    プロジェクトのルートディレクトリで以下のコマンドを実行します。

    ```bash
    npm install
    ```

    このコマンドにより、以下が自動的に実行されます:
    - 必要なnpmパッケージ（Bootstrap、Vue.js、ws、js-yamlなど）のインストール
    - `postinstall`フックによる依存ファイルの自動コピー（Bootstrap CSS/JS、Vue.jsを`css/`と`js/`ディレクトリへ）

2.  **サーバーの起動**:
    サーバーは「開発モード」と「本番モード」の 2 つのモードで実行できます。

    - **開発モード（ログ出力あり）**
      ターミナルにデバッグ用のログが出力されます。

      ```bash
      node server.js
      ```

      コンソールに`Server is listening on port 8080`などのメッセージが表示されれば成功です。

    - **本番モード（ログ出力なし）**
      本番の配信などでログを非表示にする場合は、`NODE_ENV`環境変数を`production`に設定して起動します。
      ```bash
      NODE_ENV=production node server.js
      ```

3.  **アプリケーションの使用**:

    - **トップページ**: `http://localhost:8080/` または `http://localhost:8080/index.html` にアクセスします。
      ![トップページ](doc/index.png)
    - **操作パネル**: `http://localhost:8080/operation.html` にアクセスします。
      ![操作パネル](doc/operation.png)
    - **表示ボード**: `http://localhost:8080/board.html` にアクセスします。この URL を OBS 等のブラウザソースに設定してください。

4.  **サーバーの停止**:
    サーバーを起動したターミナルで `Ctrl + C` を押すと停止します。

## マルチPC構成での使用方法

別のPCから操作パネルや表示ボードにアクセスする場合:

1. **サーバーのIPアドレスを確認**:

   サーバーを起動しているPCで以下のコマンドを実行します:

   ```bash
   # Linux/Mac
   hostname -I

   # Windows
   ipconfig
   ```

2. **別のPCからアクセス**:

   `localhost` をサーバーのIPアドレスに置き換えてアクセスします:

   ```
   http://192.168.1.100:8080/             # トップページ
   http://192.168.1.100:8080/operation.html  # 操作パネル
   http://192.168.1.100:8080/board.html      # 表示ボード
   ```

3. **OBSでの設定**:

   - OBSで「ソース」→「追加」→「ブラウザ」を選択
   - URLに表示ボードのアドレスを入力: `http://192.168.1.100:8080/board.html`
   - クロマキー合成で緑色を抜く

WebSocket接続は、アクセスしたURLのホスト名を自動的に使用するため、追加の設定は不要です。

## 初期設定ファイルの生成

操作パネルを開いた際の初期値は `config/init_data.json` ファイルで設定します。このファイルは **自動生成ツール** を使って簡単に作成できます。

### 自動生成ツールの使い方

3つの方法で `init_data.json` を生成できます:

#### 1. インタラクティブモード（推奨）

対話形式で入力します:

```bash
npm run init
```

実行例:
```
大会名を入力してください [現在: 大会名]: 夏季大会
試合の最終イニングを入力してください [現在: 9]: 7
参加チーム名を入力してください [入力終了: enterのみ]:
  チーム 1: A
  チーム 2: B
  チーム 3: C
  チーム 4: D
  チーム 5: E

✓ 先攻チーム: A
✓ 後攻チーム: B
✓ init_data.json を生成しました
```

#### 2. YAMLファイルから生成

YAMLファイルを用意して生成します:

```bash
# サンプルファイルをコピー
cp config/config.yaml.example config/my-config.yaml

# 編集
nano config/my-config.yaml

# 生成
npm run init config/my-config.yaml
```

YAMLファイルの例（`config/my-config.yaml`）:
```yaml
game_title: 夏季大会
last_inning: 7
team_names:
  - A
  - B
  - C
  - D
  - E
```

#### 3. コマンドライン引数で生成

一行のコマンドで直接指定します:

```bash
npm run init -- -t "夏季大会" -i 7 --teams "A,B,C,D,E"
```

オプション:
- `-t, --title <string>`: 大会名（必須）
- `-i, --innings <number>`: 最終イニング（1-9、デフォルト: 9）
- `--teams <string>`: 参加チーム（カンマ区切り、必須、最低2チーム）
- `-h, --help`: ヘルプ表示

### 自動生成ルール

- **先攻チーム** (`team_top`): 参加チームの1番目
- **後攻チーム** (`team_bottom`): 参加チームの2番目
- **イニング配列** (`game_array`): `["試合前", 1, 2, ..., イニング数, "試合終了"]`
- **チーム選択肢** (`team_items`): `["　", チーム1, チーム2, ...]` ※先頭は全角スペース

### バリデーション

- 参加チーム数: 最低2チーム必要
- 最終イニング: 1から9の範囲

### バックアップ機能

既存の `config/init_data.json` がある場合、自動的に `config/init_data.json.bak` にバックアップされます。

### 生成される init_data.json の例

```json
{
  "game_title": "夏季大会",
  "team_top": "A",
  "team_bottom": "B",
  "game_array": ["試合前", 1, 2, 3, 4, 5, 6, 7, "試合終了"],
  "team_items": ["　", "A", "B", "C", "D","E"],
  "last_inning": 7
}
```

### 手動編集

もちろん、`config/init_data.json` を直接編集することも可能です。

- `game_title`: 大会名
- `team_top`: 先攻チーム
- `team_bottom`: 後攻チーム
- `game_array`: イニング選択プルダウンの選択肢
- `team_items`: チーム名選択プルダウンの選択肢（先頭は全角スペース）
- `last_inning`: 最終イニング

## 依存関係の管理

このプロジェクトでは、Bootstrap と Vue.js を npm 経由で管理しています。

### 依存ファイルの自動コピー

`npm install` を実行すると、`postinstall` フックにより `scripts/copy-deps.js` スクリプトが自動実行され、以下のファイルが `node_modules/` から静的ファイルディレクトリにコピーされます:

- `node_modules/bootstrap/dist/css/bootstrap.min.css` → `public/css/bootstrap.min.css`
- `node_modules/bootstrap/dist/js/bootstrap.bundle.min.js` → `public/js/bootstrap.bundle.min.js`
- `node_modules/vue/dist/vue.global.js` → `public/js/vue.global.js`

### 手動での依存ファイル更新

依存ファイルを手動で再コピーする場合は、以下のコマンドを実行します:

```bash
npm run build:deps
```

### 依存パッケージの更新

Bootstrap や Vue.js のバージョンを更新する場合:

1. `package.json` の依存バージョンを更新
2. `npm install` を実行（自動的に `copy-deps.js` が実行されます）

または、特定のパッケージを直接更新:

```bash
npm update bootstrap vue
```

## 状態の永続化

試合状況（スコア、イニング、BSO、ランナー等）はサーバー側で自動的に保存されます。

### 保存される情報

- 試合状況: `data/current_game.json` に自動保存
- 保存内容: スコア、イニング、表裏、BSO カウント、ランナー情報など

### 動作の詳細

1. **操作パネルでの変更**
   - スコアや BSO を変更すると、WebSocket 経由でサーバーに送信
   - サーバーが `data/current_game.json` に自動保存

2. **ブラウザをリフレッシュした場合**
   - 操作パネル、表示ボードともに最新の試合状況が復元される
   - 試合を中断せずに続行可能

3. **サーバーを再起動した場合**
   - サーバー起動時に `data/current_game.json` から状態を読み込み
   - 試合を中断した時点から再開可能

4. **試合途中で表示ボードを開いた場合**
   - サーバーが保持している最新の試合状況が即座に表示される
   - 操作パネルで何か操作する必要なし

### 大会設定と試合状況の違い

| ファイル | 用途 | 内容 |
|---------|------|------|
| `config/init_data.json` | 大会設定 | 大会名、参加チーム一覧、イニング数など |
| `data/current_game.json` | 試合状況 | スコア、BSO、ランナー、現在のイニングなど |

大会設定は手動または自動生成ツールで作成し、試合状況は実行時に自動的に保存・更新されます。

### データのリセット

新しい試合を開始する場合:

```bash
# 保存された試合状況を削除
rm data/current_game.json

# サーバーを再起動
node server.js
```

操作パネルを開くと `config/init_data.json` の初期値から開始されます。

## PM2を使った本番運用

本番環境では、PM2（Process Manager 2）を使用してサーバーを管理することを推奨します。PM2により、自動再起動、ログ管理、モニタリングなどの機能が利用できます。

### PM2のインストール

**グローバルインストール（本番環境）:**
```bash
npm install -g pm2
```

プロジェクトには既に開発依存関係として含まれています（`npm install` で自動的にインストールされます）。

### 基本的な使い方

#### サーバーの起動

**本番モードで起動:**
```bash
npm run pm2:start
```

**開発モードで起動:**
```bash
npm run pm2:dev
```

#### サーバーの操作

```bash
# ステータス確認
npm run pm2:status

# ログをリアルタイム表示
npm run pm2:logs

# サーバーの停止
npm run pm2:stop

# サーバーの再起動（ダウンタイムあり）
npm run pm2:restart

# サーバーのリロード（ゼロダウンタイム）
npm run pm2:reload

# PM2からアプリを削除
npm run pm2:delete

# リアルタイムモニタリング
npm run pm2:monit
```

### OS起動時の自動起動設定

サーバー再起動後も自動的にアプリケーションを起動する設定：

```bash
# 1. PM2のスタートアップスクリプトを生成
pm2 startup

# 表示されたコマンドを実行（sudoが必要な場合があります）
# 例: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u youruser --hp /home/youruser

# 2. 現在の状態を保存
pm2 save
```

これにより、サーバーを再起動してもアプリケーションが自動的に起動します。

### ログの確認

PM2はログを自動的にファイルに保存します：

```bash
# ログファイルの場所
logs/pm2-out.log    # 標準出力
logs/pm2-error.log  # エラー出力

# ログをリアルタイムで確認
npm run pm2:logs

# ログファイルを直接確認
tail -f logs/pm2-out.log
tail -f logs/pm2-error.log
```

### モニタリング

```bash
# リアルタイムモニタリング画面
npm run pm2:monit

# ステータス一覧
npm run pm2:status
```

モニタリング画面では、以下の情報が確認できます：
- CPU使用率
- メモリ使用量
- 稼働時間
- 再起動回数

### PM2設定のカスタマイズ

`ecosystem.config.js` で詳細な設定を変更できます：

```javascript
module.exports = {
  apps: [{
    name: 'baseball-board',
    script: './server.js',
    instances: 1,              // プロセス数
    autorestart: true,         // 自動再起動
    max_memory_restart: '500M' // メモリ制限
    // その他の設定...
  }]
};
```

### トラブルシューティング

**プロセスが起動しない場合:**
```bash
# ログを確認
npm run pm2:logs

# PM2を完全にリセット
npm run pm2:delete
pm2 kill
npm run pm2:start
```

**メモリ使用量が多い場合:**
- `ecosystem.config.js` の `max_memory_restart` を調整
- PM2が自動的に再起動してメモリをクリア

## 利用しているオープンソースソフトウェア

このプロジェクトは以下のオープンソースソフトウェアを使用しています（すべてMITライセンス）:

- [Vue.js](https://github.com/vuejs/core) (v3.4.0+) - [MIT License](https://github.com/vuejs/core/blob/main/LICENSE)
- [Bootstrap](https://github.com/twbs/bootstrap) (v5.3.3+) - [MIT License](https://github.com/twbs/bootstrap/blob/main/LICENSE)
- [ws](https://github.com/websockets/ws) (v8.13.0+) - [MIT License](https://github.com/websockets/ws/blob/master/LICENSE)
- [js-yaml](https://github.com/nodeca/js-yaml) (v4.1.0+) - [MIT License](https://github.com/nodeca/js-yaml/blob/master/LICENSE)

実際にインストールされるバージョンは `package-lock.json` をご確認ください。

