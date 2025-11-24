# 野球中継スコアボード (Baseball Broadcast Board)

YouTube 等のライブ配信で野球の試合を中継する際に、OBS のような配信ソフトウェアにスコアボード画面をクロマキー合成で表示するためのアプリケーションです。

![表示ボード](doc/board.png)

## 📑 目次

- [主な機能](#主な機能)
- [Electron版について](#electron版について)
- [クイックスタート](#クイックスタート)
- [システム構成](#システム構成)
- [主要ファイル構成](#主要ファイル構成)
- [技術スタック](#技術スタック)
- [セットアップと実行方法](#セットアップと実行方法)
- [基本的な使い方](#基本的な使い方)
- [マルチPC構成での使用方法](#マルチpc構成での使用方法)
- [マスター/スレーブ操作制御](#マスタースレーブ操作制御)
- [初期設定ファイルの生成](#初期設定ファイルの生成)
- [試合のリセットと再開](#試合のリセットと再開)
- [トラブルシューティング](#トラブルシューティング)
- [さらに詳しく](#さらに詳しく)

## 主な機能

- **リアルタイム更新**: 操作パネルから入力した内容が、WebSocket を通じて即座に表示ボードへ反映されます。
- **状態の永続化**: 試合状況がサーバー側に自動保存され、ブラウザのリフレッシュやサーバー再起動後も試合を継続できます。
- **シンプルな操作画面**: Web ブラウザから誰でも簡単に試合状況（スコア、イニング、SBO カウント、ランナー情報）を更新できます。
- **OBS 連携**: 表示ボードは背景が緑色になっており、OBS などの配信ソフトウェアで簡単にクロマキー合成できます。
- **マルチPC対応**: サーバーのIPアドレスを指定することで、別のPCから操作パネルと表示ボードにアクセス可能です。
- **設定自動生成**: コマンドラインツールで`init_data.json`を簡単に生成できます（インタラクティブモード、YAML、コマンドライン引数の3つの方法に対応）。

## 🖥️ Electron版について

**現在のステータス: Linuxで動作確認済み** ✅

このプロジェクトのElectronデスクトップアプリケーション版が利用可能です。

### 実装済み機能

- ✅ Electron基本設定（`package.json`, `main.js`, `preload.js`）
- ✅ 自動サーバー起動機能（Electronプロセス内でNode.jsサーバーを起動）
- ✅ メニューバー統合
- ✅ システムトレイアイコン
- ✅ ビルド設定（Windows/Mac/Linux対応）
- ✅ AppImage形式でのLinuxビルド（動作確認済み）
- ✅ ファイルパス解決（asar対応、ユーザーデータディレクトリへの状態保存）

### Electron版の使用方法

#### Linux（AppImage）

Linuxでは、単一のAppImageファイルとして実行できます：

```bash
# ビルド
npm run build:linux

# 実行（Ubuntu 24.04+の場合）
# libfuse2が必要です
sudo apt install libfuse2

# AppImageを実行（サンドボックス無効化が必要）
./dist/Baseball\ Scoreboard-1.0.0.AppImage --no-sandbox
```

**⚠️ 注意点:**
- **サンドボックス**: `--no-sandbox` オプションが必要です（chrome-sandboxの権限問題を回避）
- **FUSE2**: Ubuntu 24.04以降ではデフォルトでFUSE3がインストールされているため、FUSE2を追加インストールする必要があります
- **データ保存場所**: 試合状況は `~/.config/baseball_broadcast_board/data/current_game.json` に保存されます

#### Windows / macOS

```bash
# Windowsビルド
npm run build:win

# macOSビルド
npm run build:mac
```

### Electron開発モード

⚠️ **既知の問題**: 一部のLinux環境で開発モード（`npm run electron:dev`）が動作しない問題があります。

```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

この問題は、AppImageビルド版では発生しません。開発時は以下の回避策を使用してください：
- Web版を使用: `node server.js`
- 別の環境で試行: Windows/macOSでは正常に動作する可能性があります

### 技術的な実装詳細

Electron版では、以下の技術的な課題を解決しています：

1. **asarアーカイブ対応**: `server.js`、`public/`、`config/`、`node_modules/` を `app.asar.unpacked` に展開して実行
2. **ファイルパス解決**: `__dirname` ベースのパス解決により、開発環境とパッケージ環境の両方で動作
3. **書き込み可能データ**: 試合状況データを `app.getPath('userData')` に保存し、AppImage実行時の読み取り専用制約を回避
4. **サーバープロセス管理**: Electronのメインプロセスから `spawn` でNode.jsサーバーを起動し、アプリ終了時に自動的にクリーンアップ

詳細は [CLAUDE.md](CLAUDE.md) の「Deployment Options」および「Electron Desktop App」セクションをご覧ください。

## 🚀 クイックスタート

**5分で始める最短手順**

### 1. 依存関係のインストール

```bash
npm install
```

このコマンドにより、以下が自動的に実行されます:
- 必要なnpmパッケージ（Bootstrap、Vue.js、ws、js-yamlなど）のインストール
- `postinstall`フックによる依存ファイルの自動コピー（Bootstrap CSS/JS、Vue.jsを`public/`へ）

### 2. サーバーの起動

```bash
node server.js
```

コンソールに `Server is listening on port 8080` と表示されれば成功です。

### 3. ブラウザでアクセス

- **トップページ**: http://localhost:8080/
- **操作パネル**: http://localhost:8080/operation.html
- **表示ボード**: http://localhost:8080/board.html

### 4. OBSで表示ボードを表示

1. OBSで「ソース」→「ブラウザ」を追加
2. URL: `http://localhost:8080/board.html`
3. 「エフェクトフィルタ」→「クロマキー」で緑色を抜く

詳細は [セットアップと実行方法](#セットアップと実行方法) をご覧ください。

## システム構成

トップページ(`index.html`)から、操作パネル(`operation.html`)と表示ボード(`board.html`)へアクセスします。操作パネルと表示ボードは、WebSocket サーバー(`server.js`)を介してリアルタイムに通信します。

```mermaid
graph LR;
    subgraph "サーバー"
        D("WebSocketサーバー</br>server.js</br><i>Master/Slave制御</i>");
    end

    subgraph "クライアント (ブラウザ)"
        A("トップページ</br>index.html");
        B1("操作パネル 1</br>operation.html</br><b>Master</b>");
        B2("操作パネル 2</br>operation.html</br><i>Slave (read-only)</i>");
        C("表示ボード</br>board.html</br><i>Viewer</i>");
    end

    D <-->|WebSocket</br>game_state_update| B1;
    D -->|WebSocket</br>game_state| B2;
    D -->|WebSocket</br>game_state| C;
    A --> B1;
    A --> B2;
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
├── doc/                    # ドキュメントと画像
│   ├── ARCHITECTURE.md     # システムアーキテクチャ詳細
│   ├── MASTER_SLAVE_ARCHITECTURE.md  # Master/Slave制御の詳細
│   ├── PRODUCTION_DEPLOYMENT.md      # 本番環境デプロイガイド
│   ├── WEBSOCKET_RECONNECTION.md     # WebSocket再接続機能
│   ├── board.png           # 表示ボードのスクリーンショット
│   ├── index.png           # トップページのスクリーンショット
│   ├── operation.png       # 操作パネルのスクリーンショット
│   └── operation_slave.png # スレーブ状態のスクリーンショット
├── logs/                   # ログファイル
│   ├── pm2-error.log       # PM2エラーログ（自動生成）
│   └── pm2-out.log         # PM2標準出力ログ（自動生成）
├── ecosystem.config.js     # PM2設定ファイル
├── main.js                 # Electronメインプロセス（開発中）
├── preload.js              # Electron preloadスクリプト（開発中）
├── server.js               # WebサーバーとWebSocketサーバー
└── package.json            # プロジェクト情報と依存ライブラリ
```

**Electron関連ファイル（開発中）**:
- `main.js`: Electronのメインプロセス。サーバー自動起動、ウィンドウ管理、メニュー統合
- `preload.js`: セキュアなIPC通信のためのプリロードスクリプト
- `package.json`: Electron起動スクリプト（`npm run electron:dev`）とビルド設定を含む
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
- **デスクトップ化（開発中）**:
  - Electron 25.9.8
  - electron-builder 25.1.8

## セットアップと実行方法

**前提条件**: [Node.js](https://nodejs.org/)と npm がインストールされていること。

### 1. 依存関係のインストール

プロジェクトのルートディレクトリで以下のコマンドを実行します。

```bash
npm install
```

このコマンドにより、以下が自動的に実行されます:
- 必要なnpmパッケージ（Bootstrap、Vue.js、ws、js-yamlなど）のインストール
- `postinstall`フックによる依存ファイルの自動コピー（Bootstrap CSS/JS、Vue.jsを`css/`と`js/`ディレクトリへ）

### 2. サーバーの起動

サーバーは「開発モード」と「本番モード」の 2 つのモードで実行できます。

#### 開発モード（ログ出力あり）

ターミナルにデバッグ用のログが出力されます。

```bash
node server.js
```

コンソールに`Server is listening on port 8080`などのメッセージが表示されれば成功です。

#### 本番モード（ログ出力なし）

本番の配信などでログを非表示にする場合は、`NODE_ENV`環境変数を`production`に設定して起動します。

```bash
NODE_ENV=production node server.js
```

### 3. アプリケーションの使用

- **トップページ**: `http://localhost:8080/` または `http://localhost:8080/index.html` にアクセスします。

  ![トップページ](doc/index.png)

- **操作パネル**: `http://localhost:8080/operation.html` にアクセスします。

  ![操作パネル](doc/operation.png)
  ![操作パネル（複数からアクセスしたとき）](doc/operation_slave.png)

- **表示ボード**: `http://localhost:8080/board.html` にアクセスします。この URL を OBS 等のブラウザソースに設定してください。

### 4. サーバーの停止

サーバーを起動したターミナルで `Ctrl + C` を押すと停止します。

## 📖 基本的な使い方

### 試合を開始する

1. 操作パネル (`http://localhost:8080/operation.html`) を開く
2. 大会名とチーム名が正しく表示されているか確認
3. 「表/裏」と「イニング」を選択して試合開始

### スコアを更新する

- **得点**: 「+」ボタンで加点、「-」ボタンで減点
- **BSO**: 各ボタンで増減、「クリア」でリセット
- **ランナー**: チェックボックスで出塁状態を切り替え
- **攻守交代**: 表裏を切り替えて次のイニングへ

### 表示ボードをOBSに表示する

1. OBSで「ソース」→「ブラウザ」を追加
2. URL: `http://localhost:8080/board.html`
3. 幅: 1920px、高さ: 1080px（または配信解像度に合わせて調整）
4. 「エフェクトフィルタ」→「クロマキー」を追加
5. キーカラータイプ: 緑色を選択
6. スコアボードが緑色の背景なしで表示されます

## マルチPC構成での使用方法

別のPCから操作パネルや表示ボードにアクセスする場合（例: 操作用PCと配信用PCを分ける）:

### 1. サーバーのIPアドレスを確認

サーバーを起動しているPCで以下のコマンドを実行します:

```bash
# Linux/Mac
hostname -I

# Windows
ipconfig
```

例: `192.168.1.100` と表示された場合

### 2. 別のPCからアクセス

`localhost` をサーバーのIPアドレスに置き換えてアクセスします:

```
http://192.168.1.100:8080/             # トップページ
http://192.168.1.100:8080/operation.html  # 操作パネル
http://192.168.1.100:8080/board.html      # 表示ボード
```

### 3. OBSでの設定

- OBSで「ソース」→「追加」→「ブラウザ」を選択
- URLに表示ボードのアドレスを入力: `http://192.168.1.100:8080/board.html`
- クロマキー合成で緑色を抜く

WebSocket接続は、アクセスしたURLのホスト名を自動的に使用するため、追加の設定は不要です。

### ⚠️ 注意: 複数人での同時操作について

複数の端末から`operation.html`に同時にアクセスした場合、最初に接続した端末のみが操作可能（Master）となり、後から接続した端末は閲覧専用（Slave）となります。詳細は[マスター/スレーブ操作制御](#マスタースレーブ操作制御)セクションをご覧ください。

## マスター/スレーブ操作制御

複数のユーザーが操作パネルに同時にアクセスする場合、競合を防ぐためマスター/スレーブ制御が働きます。

### 概要

- **マスター (👑)**: 最初に接続したユーザーのみが操作可能
- **スレーブ (👁️)**: 後から接続したユーザーは閲覧専用
- **リロード時の権限維持**: マスターがブラウザをリロードしても、マスター権限が維持されます（5秒以内の再接続）
- **自動昇格**: マスターがタブを閉じて5秒経過すると、最も古いスレーブが自動的にマスターに昇格
- **手動解放**: マスターは「🔓 マスター権限を解放」ボタンで権限を他のユーザーに明示的に譲渡可能

### UIインジケーター

操作パネルのナビゲーションバーに現在の役割が表示されます:

- 👑 **緑色バッジ**: マスター（操作可能）
- 👁️ **黄色バッジ**: スレーブ（閲覧専用）

### よくあるシナリオ

**複数のタブを開いた場合**:
- 最初のタブのみがマスターになります
- 2つ目以降のタブはスレーブになります
- 各タブは独立したセッションとして扱われます

**マスターがリロード（F5）した場合**:
- 5秒以内に再接続すれば、マスター権限が維持されます
- セッションストレージに保存されたトークンで自動認証されます
- スレーブユーザーには影響ありません

**マスターがタブを閉じた場合**:
- 5秒間の猶予期間が設けられます
- 猶予期間内に再接続しない場合、次に古いスレーブユーザーが自動的にマスターに昇格します
- UIが即座に更新されます

**2人での交代運用**:
- マスターが「🔓 マスター権限を解放」ボタンをクリック
- 最も古いスレーブが即座にマスターに昇格
- 元マスターはスレーブに降格（意図しない切り替えを防止）

**技術的詳細は [doc/MASTER_SLAVE_ARCHITECTURE.md](doc/MASTER_SLAVE_ARCHITECTURE.md) をご覧ください。**

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

**オプション:**
- `-t, --title <string>`: 大会名（必須）
- `-i, --innings <number>`: 最終イニング（1-9、デフォルト: 9）
- `--teams <string>`: 参加チーム（カンマ区切り、必須、最低2チーム）
- `-h, --help`: ヘルプ表示

### 自動生成ルール

- **先攻チーム** (`team_top`): 参加チームの1番目
- **後攻チーム** (`team_bottom`): 参加チームの2番目
- **イニング配列** (`game_array`): `["試合前", 1, 2, ..., イニング数, "試合終了"]`
- **チーム選択肢** (`team_items`): `["　", チーム1, チーム2, ...]` ※先頭は全角スペース

### バックアップ機能

既存の `config/init_data.json` がある場合、自動的に `config/init_data.json.bak` にバックアップされます。

### 生成される init_data.json の例

```json
{
  "game_title": "夏季大会",
  "team_top": "A",
  "team_bottom": "B",
  "game_array": ["試合前", 1, 2, 3, 4, 5, 6, 7, "試合終了"],
  "team_items": ["　", "A", "B", "C", "D", "E"],
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

## 試合のリセットと再開

### 方法1: 操作パネルから初期化（推奨）

操作パネルの「🔄 試合初期化」ボタンで試合状況をリセットできます。

**リセットされる内容:**
- イニング → 試合前（0回）
- 得点 → 両チーム0点
- BSO・ランナー → すべてクリア

**維持される内容:**
- チーム名と大会名（そのまま引き継がれます）

### 方法2: 新規大会で初期化

新しい大会を開始する場合:

1. `npm run init` で新しい `config/init_data.json` を生成
2. 操作パネルの「📋 新規大会で初期化」ボタンをクリック
3. 新しい大会設定が読み込まれます

### 方法3: コマンドラインから削除

サーバーにアクセスできる場合:

```bash
# 保存された試合状況を削除
rm data/current_game.json

# サーバーを再起動
node server.js
```

操作パネルを開くと `config/init_data.json` の初期値から開始されます。

## 🔧 トラブルシューティング

### 操作パネルで変更しても表示ボードに反映されない

**原因と対処法:**
- WebSocket接続が切断されている可能性があります
- ナビゲーションバーの接続状態インジケーターを確認してください
- ブラウザをリフレッシュ（F5キー）してください
- サーバーが起動しているか確認: `ps aux | grep node`

### 「🔴 切断」と表示される

**原因:**
- サーバーが停止している
- ネットワーク接続に問題がある

**対処法:**
1. サーバーが起動しているか確認: `node server.js` または `npm run pm2:status`
2. ネットワーク接続を確認
3. ブラウザの開発者コンソール（F12）でエラーメッセージを確認
4. 自動再接続を待つ（通常は数秒以内）
5. 再接続に失敗した場合はブラウザをリロード（F5キー）

詳細は [doc/WEBSOCKET_RECONNECTION.md](doc/WEBSOCKET_RECONNECTION.md) をご覧ください。

### 複数人で操作したいが全員スレーブになる

**原因:**
- 最初に接続したユーザーがマスターを保持している

**対処法:**
- マスターユーザーに「🔓 マスター権限を解放」ボタンを押してもらう
- または、マスターユーザーがブラウザを閉じると自動的に次のユーザーがマスターに昇格

### OBSで表示ボードが表示されない

**原因と対処法:**
- **URLが間違っている**: `http://[サーバーIP]:8080/board.html` を確認
- **OBSのキャッシュ問題**: ブラウザソースを削除して再作成
- **ファイアウォール**: サーバーのポート8080が開いているか確認

### ポート8080が既に使用されている

**対処法:**
```bash
# ポート8080を使用しているプロセスを確認
lsof -i :8080

# プロセスを終了
kill -9 <PID>

# または、PM2で管理している場合
npm run pm2:stop
```

## 📚 さらに詳しく

### 開発者向けドキュメント

- **[システムアーキテクチャ](doc/ARCHITECTURE.md)** - 技術スタック、状態管理、WebSocketプロトコル、セキュリティ
- **[Master/Slave アーキテクチャ](doc/MASTER_SLAVE_ARCHITECTURE.md)** - 詳細な実装、メッセージプロトコル、エッジケース、テスト手順
- **[WebSocket自動再接続](doc/WEBSOCKET_RECONNECTION.md)** - 再接続アルゴリズム、実装詳細、トラブルシューティング

### 運用者向けドキュメント

- **[本番環境デプロイ](doc/PRODUCTION_DEPLOYMENT.md)** - PM2を使った運用、モニタリング、自動起動設定、ログ管理

### 依存関係の管理

このプロジェクトでは、Bootstrap と Vue.js を npm 経由で管理しています。

**依存ファイルを手動で再コピーする場合:**
```bash
npm run build:deps
```

**依存パッケージを更新する場合:**
```bash
npm update bootstrap vue
```

詳細は [doc/ARCHITECTURE.md - 依存関係の管理](doc/ARCHITECTURE.md#依存関係の管理) をご覧ください。

## 利用しているオープンソースソフトウェア

このプロジェクトは以下のオープンソースソフトウェアを使用しています（すべてMITライセンス）:

- [Vue.js](https://github.com/vuejs/core) (v3.4.0+) - [MIT License](https://github.com/vuejs/core/blob/main/LICENSE)
- [Bootstrap](https://github.com/twbs/bootstrap) (v5.3.3+) - [MIT License](https://github.com/twbs/bootstrap/blob/main/LICENSE)
- [ws](https://github.com/websockets/ws) (v8.13.0+) - [MIT License](https://github.com/websockets/ws/blob/master/LICENSE)
- [js-yaml](https://github.com/nodeca/js-yaml) (v4.1.0+) - [MIT License](https://github.com/nodeca/js-yaml/blob/master/LICENSE)

実際にインストールされるバージョンは `package-lock.json` をご確認ください。
