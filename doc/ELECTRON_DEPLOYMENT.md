# Electronアプリ デプロイガイド - ビルドと実行

## 目次

- [概要](#概要)
- [デプロイメントオプション](#デプロイメントオプション)
- [プラットフォーム別デプロイメント](#プラットフォーム別デプロイメント)
- [技術的な実装詳細](#技術的な実装詳細)
- [開発モードの既知の問題](#開発モードの既知の問題)
- [トラブルシューティング](#トラブルシューティング)
- [参考資料](#参考資料)

## 概要

このドキュメントでは、Baseball Scoreboard Electronアプリのデプロイメント方法と技術的な実装詳細について説明します。

## デプロイメントオプション

このプロジェクトは2つのデプロイメント方法をサポートしています：

### 1. Webアプリケーション版（安定版）

**推奨**: 開発・テスト・複数PC環境で使用する場合

```bash
# サーバー起動
node server.js

# ブラウザでアクセス
# 操作パネル: http://localhost:8080/operation.html
# 表示ボード: http://localhost:8080/board.html
```

**メリット**:
- セットアップが簡単
- 複数PCから同時アクセス可能（操作PC + 配信PC）
- ブラウザの開発者ツールでデバッグ可能
- 軽量で高速

**複数PC環境での使用**:
```bash
# サーバーPCのIPアドレスを確認（例: 192.168.0.31）
# 他のPCから以下のURLでアクセス
http://192.168.0.31:8080/operation.html
http://192.168.0.31:8080/board.html
```

### 2. Electronデスクトップアプリ版

**推奨**: 単一PC環境でスタンドアロンアプリとして使用する場合

**現在のステータス**:
- ✅ Linux (AppImage): 動作確認済み
- ⚠️ Windows: 未テスト（ビルド可能）
- ⚠️ macOS: 未テスト（ビルド可能）

**メリット**:
- サーバー起動が自動化
- デスクトップアプリとして動作
- メニューバー・システムトレイ統合
- 設定GUIが利用可能

## プラットフォーム別デプロイメント

### Linux (AppImage)

#### ビルド手順

```bash
# 依存関係のインストール
npm install

# AppImageのビルド
npm run build:linux

# 成果物
./dist/Baseball Scoreboard-1.0.0.AppImage
```

#### 実行要件

**Ubuntu 24.04以降の場合**:

FUSE2のインストールが必要です（Ubuntu 24.04はデフォルトでFUSE3を使用）：

```bash
sudo apt install libfuse2
```

#### 実行方法

```bash
# 実行権限を付与
chmod +x ./dist/Baseball\ Scoreboard-1.0.0.AppImage

# 実行（--no-sandboxオプションが必要）
./dist/Baseball\ Scoreboard-1.0.0.AppImage --no-sandbox
```

**重要**: `--no-sandbox` フラグが必要です（chrome-sandboxのパーミッション問題のため）。

#### データ保存場所

AppImageはマウントが読み取り専用のため、書き込み可能なデータは以下に保存されます：

```
~/.config/baseball_broadcast_board/
├── config/
│   └── init_data.json          # 設定ファイル
└── data/
    └── current_game.json        # 試合状態
```

### Windows

#### ビルド手順

```bash
npm run build:win
```

#### 成果物

```
./dist/Baseball Scoreboard Setup 1.0.0.exe  # インストーラー
./dist/win-unpacked/                        # ポータブル版
```

**注意**: Windows版は未テストです。動作確認後、このドキュメントを更新してください。

### macOS

#### ビルド手順

```bash
npm run build:mac
```

#### 成果物

```
./dist/Baseball Scoreboard-1.0.0.dmg
./dist/mac/Baseball Scoreboard.app
```

**注意**: macOS版は未テストです。動作確認後、このドキュメントを更新してください。

## 技術的な実装詳細

Electron版では、以下の技術的な課題を解決しています：

### 1. asarアーカイブ対応

AppImageなどのパッケージ版では、ファイルが`app.asar`アーカイブに圧縮されます。
サーバー実行に必要なファイルは`app.asar.unpacked`に展開されます。

**package.jsonの設定**:
```json
{
  "build": {
    "asarUnpack": [
      "server.js",
      "public/**/*",
      "config/**/*",
      "node_modules/**/*"
    ]
  }
}
```

**main.jsでのパス解決**:
```javascript
const serverPath = path.join(
  __dirname.replace('app.asar', 'app.asar.unpacked'),
  'server.js'
);
```

### 2. ファイルパス解決

`process.cwd()`（カレントディレクトリ）ではなく`__dirname`（実行ファイルの場所）ベースのパス解決を使用。

**server.jsでの実装**:
```javascript
// ❌ 悪い例（パッケージ版で動作しない）
const publicDir = path.resolve("./public");

// ✅ 良い例（開発版・パッケージ版の両方で動作）
const publicDir = path.join(__dirname, "public");
```

### 3. 書き込み可能データディレクトリ

AppImageは読み取り専用マウントのため、試合状態などの書き込み可能データは`app.getPath('userData')`に保存。

**main.jsでの実装**:
```javascript
function getCurrentGamePath() {
  return path.join(app.getPath('userData'), 'data', 'current_game.json');
}

function getInitDataPath() {
  if (isDev) {
    return path.join(__dirname, 'config', 'init_data.json');
  } else {
    return path.join(app.getPath('userData'), 'config', 'init_data.json');
  }
}
```

**server.jsへの環境変数渡し**:
```javascript
serverProcess = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    USER_DATA_PATH: app.getPath('userData')
  }
});
```

**server.jsでの使用**:
```javascript
const CONFIG_DIR = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, "config")
  : path.join(__dirname, "config");
```

### 4. サーバープロセス管理

Electronのメインプロセスから`spawn`でNode.jsサーバーを起動。

**起動処理**:
```javascript
serverProcess = spawn(process.execPath, [serverPath], {
  env: {
    ELECTRON_RUN_AS_NODE: '1',  // Electronバイナリをノードランタイムとして使用
    USER_DATA_PATH: app.getPath('userData')
  }
});

// 標準出力/エラー出力をキャプチャ（デバッグ用）
serverProcess.stdout.on('data', (data) => {
  console.log(`Server: ${data}`);
});

serverProcess.stderr.on('data', (data) => {
  console.error(`Server Error: ${data}`);
});
```

**終了処理**:
```javascript
app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
```

### 5. セキュリティチェックの修正

`server.js`のセキュリティチェックを`__dirname`ベースに修正し、403 Forbiddenエラーを防止。

**修正前**:
```javascript
const allowedFile = path.resolve("./config/init_data.json");
if (filePath !== allowedFile) {
  res.writeHead(403);
  res.end("Forbidden");
}
```

**修正後**:
```javascript
const INIT_DATA_FILE = path.join(CONFIG_DIR, "init_data.json");
const isConfigFile = filePath === path.resolve(INIT_DATA_FILE);
if (!isPublicFile && !isConfigFile) {
  res.writeHead(403);
  res.end("Forbidden");
}
```

### 6. Phase 2: 設定ウィンドウ機能

**IPC通信によるセキュアなAPI公開**:
```javascript
// preload.js - contextBridgeでセキュアに公開
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  readYaml: (filePath) => ipcRenderer.invoke('config:readYaml', filePath),
  generateConfig: (yamlPath) => ipcRenderer.invoke('config:generate', yamlPath),
  deleteCurrentGame: () => ipcRenderer.invoke('config:deleteCurrent'),
  reloadConfig: () => ipcRenderer.invoke('config:reload'),
  onReloadConfig: (callback) => {
    ipcRenderer.on('reload-config', callback);
  }
});
```

**WebSocket URL自動調整**:
```javascript
// public/js/operation.js - Electronモードでは常にlocalhostに接続
const isElectron = window.electronAPI?.isElectron || false;
const wsHost = isElectron ? 'localhost:8080' : window.location.host;
```

**設定の強制リロード**:
```javascript
// main.jsでのloadConfiguration()
loadConfiguration(forceReload = false) {
  fetch("/init_data.json")
    .then((response) => response.json())
    .then((data) => {
      this.game_array = data.game_array;
      this.team_items = data.team_items;

      // forceReload時はサーバー状態に関わらず全ての値を更新
      if (forceReload || !this.restoredFromServer) {
        this.game_title = data.game_title;
        this.team_top = data.team_top;
        this.team_bottom = data.team_bottom;
        this.last_inning = data.last_inning;
      }
    });
}
```

### 7. Phase 5: 初回起動ガイド

**初回起動時の自動セットアップ支援**:

Electronアプリを初めて起動すると、設定ウィンドウとウェルカムダイアログが自動的に表示され、初期設定をガイドします。

**初回起動時の動作**:

1. **設定ウィンドウが自動的に開く**
   - `createSettingsWindow()` が自動的に呼び出されます
   - `show: false` + `ready-to-show` イベントパターンでコンテンツ読み込み後に表示
   - `focus()` で確実に前面に表示

2. **ウェルカムダイアログが表示される**（1.5秒遅延）
   - 推奨ワークフローを5ステップで案内
   - 設定ウィンドウのUI要素（絵文字付きボタン）を参照
   - 日本語で表示（アプリUIと統一）

3. **操作パネルも同時に開く**
   - 設定完了後にすぐ使用できるよう背景で起動
   - 設定ウィンドウがフォーカスを持つ

**実装詳細**:

```javascript
// main.js - 初回起動検出
function isFirstRun() {
  const userDataPath = app.getPath('userData');
  const firstRunMarker = path.join(userDataPath, '.first_run_complete');
  return !fs.existsSync(firstRunMarker);
}

// main.js - マーカーファイル作成
function markFirstRunComplete() {
  const userDataPath = app.getPath('userData');
  const firstRunMarker = path.join(userDataPath, '.first_run_complete');

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  fs.writeFileSync(firstRunMarker, `First run completed: ${timestamp}\n`);
}

// main.js - アプリ起動フロー
app.whenReady().then(async () => {
  await startServer();
  createMenu();
  createTray();

  const firstRun = isFirstRun();

  if (firstRun) {
    console.log('First run detected, showing welcome dialog and settings');

    // 設定ウィンドウを開く
    createSettingsWindow();

    // ウェルカムダイアログを表示（1.5秒遅延）
    setTimeout(() => {
      showWelcomeDialog();
      markFirstRunComplete();
    }, 1500);
  }

  // 操作パネルを開く
  createOperationWindow();
});
```

**ウェルカムダイアログの内容**:

```
タイトル: Baseball Scoreboard へようこそ
メッセージ: 初めてご利用いただきありがとうございます!

詳細:
設定ウィンドウが開きます。以下の手順で大会情報を設定してください。

【推奨ワークフロー】
1. YAMLファイルを選択（または新規作成）
2. 「✅ 設定ファイルを生成」をクリック
3. 「🗑️ 試合状態を削除」をクリック（確認ダイアログで自動提案）
4. 「🔄 設定を再読み込み」をクリック（確認ダイアログで自動提案）
5. 操作パネルで試合を開始

ヘルプ: 設定ウィンドウ下部にYAMLファイルの例があります。
```

**マーカーファイル**:
```
保存場所: ~/.config/baseball_broadcast_board/.first_run_complete
形式: テキストファイル（タイムスタンプ付き）
例: "First run completed: 2025-11-30T12:34:56.789Z"
```

**2回目以降の起動**:
- マーカーファイルが存在するため、初回起動フローはスキップされます
- 操作パネルのみが起動します（通常の動作）

**手動リセット**:
```bash
# 初回起動フローを再度実行したい場合
rm ~/.config/baseball_broadcast_board/.first_run_complete
```

**設計上の利点**:
- **シンプル**: ファイルの存在チェックのみ（JSONパース不要）
- **高速**: ディスク読み込みは最小限
- **デバッグ可能**: タイムスタンプ記録で初回起動日時を確認可能
- **Unix慣習**: ドットプレフィックスで隠しファイル化

## 開発モードの既知の問題

### Linux: `npm run electron:dev`の失敗

**現象**:
```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

**回避策**:
- 開発時はWebアプリ版を使用: `node server.js`
- または、AppImageをビルドしてテスト: `npm run build:linux`

## トラブルシューティング

### AppImageが起動しない

**症状**: ダブルクリックしても何も起こらない

**解決策**:
```bash
# ターミナルから実行してエラーメッセージを確認
./dist/Baseball\ Scoreboard-1.0.0.AppImage --no-sandbox
```

### "dlopen: cannot load any more object with static TLS" エラー

**症状**: FUSE関連のエラーメッセージが表示される

**解決策**:
```bash
sudo apt install libfuse2
```

### ポート8080が既に使用されている

**症状**: "Error: listen EADDRINUSE: address already in use :::8080"

**解決策**:
```bash
# 既存のプロセスを確認
sudo lsof -i :8080

# プロセスを終了
kill -9 <PID>
```

## Electron実装履歴（Phase 1-5）

このセクションでは、Electron版の実装がどのように段階的に進められたかを記録しています。

### Phase 1: 基本機能実装

**実装内容**:
- ✅ Electron基本設定（`package.json`, `main.js`, `preload.js`）
- ✅ 自動サーバー起動機能
- ✅ メニューバー統合
- ✅ システムトレイアイコン
- ✅ ビルド設定（Windows/Mac/Linux対応）
- ✅ AppImage形式でのLinuxビルド
- ✅ ファイルパス解決（asar対応、ユーザーデータディレクトリへの状態保存）

**主要成果物**:
- `main.js`: Electronメインプロセス、サーバー起動、ウィンドウ管理
- `preload.js`: セキュアなIPC通信のためのコンテキストブリッジ
- `package.json`: Electron起動スクリプトとビルド設定

**技術的課題と解決策**:
- **asar対応**: `app.asar.unpacked`への展開により、サーバー関連ファイルを実行時にアクセス可能に
- **書き込み可能データ**: `app.getPath('userData')`を使用し、AppImageの読み取り専用制約を回避
- **サーバー起動**: `spawn`でElectronバイナリをNode.jsランタイムとして使用（`ELECTRON_RUN_AS_NODE`フラグ）

### Phase 2: 設定ウィンドウ

**実装内容**:
- ✅ GUI設定ウィンドウ（`public/settings.html`、`public/js/settings.js`）
- ✅ YAMLファイルから設定を生成（コマンドライン不要）
- ✅ 試合状態の削除・リセット機能
- ✅ 設定の再読み込み機能
- ✅ メニュー・トレイからのアクセス（`ファイル > 設定` または `Ctrl/Cmd+,`）
- ✅ 表示ボード背景色の設定（OBSクロマキー用）

**主要成果物**:
- `public/settings.html`: 設定ウィンドウのUI
- `public/js/settings.js`: 設定ウィンドウのVue.jsアプリ
- IPCハンドラ（`main.js`内）: ファイルダイアログ、YAML読み込み、設定生成、状態削除

**技術的課題と解決策**:
- **セキュアなファイル操作**: `contextBridge`でIPCを公開し、レンダラープロセスから安全にファイル操作
- **設定の強制リロード**: `loadConfiguration(forceReload=true)`で既存の試合状態に関わらず設定を更新
- **WebSocket URL自動調整**: Electron検出時は常に`localhost:8080`に接続

**詳細**: [Electron設定ウィンドウガイド](ELECTRON_SETTINGS.md)

### Phase 3: Electron版クライアントのMaster/Slave対応

**実装内容**:
- ✅ Electronクライアントの検出機能
- ✅ WebSocket接続の自動設定（localhost強制）
- ✅ Master/Slave制御の完全サポート

**仕様**:
- **Electron特別扱いなし**: Electronクライアントもブラウザクライアントと同じMaster/Slaveロジックに従う
- **トークンベース認証**: 同じマスタートークン永続化メカニズムを使用
- **柔軟な運用**: 複数のElectronインスタンスまたはElectron/ブラウザ混在環境に対応

**詳細**: [Master/Slave制御アーキテクチャ](MASTER_SLAVE_ARCHITECTURE.md)

### Phase 4: 背景色カスタマイズ機能

**実装内容**:
- ✅ `board_background_color`フィールドの追加（`config/init_data.json`）
- ✅ 設定ウィンドウでのGUI変更機能
- ✅ `public/js/board.js`での動的背景色適用
- ✅ Electron設定とinit_data.jsonの連携

**デフォルト値**: `#ff55ff`（マゼンタ）

**推奨色**:
- グリーン: `#00ff00`
- マゼンタ: `#ff00ff`
- ブルー: `#0000ff`

**技術的課題と解決策**:
- **優先順位の明確化**: init_data.jsonの値がElectron設定より優先（クロスプラットフォーム一貫性）
- **ライブ更新**: `board-background-color-changed`イベントで即座に反映

### Phase 5: 初回起動ガイド

**実装内容**:
- ✅ 初回起動時の自動検出（マーカーファイル: `~/.config/baseball_broadcast_board/.first_run_complete`）
- ✅ 設定ウィンドウの自動表示（`show: false` + `ready-to-show`パターン）
- ✅ ウェルカムダイアログによる手順案内（5ステップ）
- ✅ 2回目以降は通常起動（操作パネルのみ）

**初回起動フロー**:
1. 設定ウィンドウが自動的に開く（前面表示）
2. ウェルカムダイアログが1.5秒後に表示（推奨ワークフローを案内）
3. 操作パネルも同時に開く（背景で起動）

**マーカーファイルの仕組み**:
- **場所**: `~/.config/baseball_broadcast_board/.first_run_complete`
- **検出**: ファイルの存在チェックのみ（JSONパース不要）
- **作成**: ウェルカムダイアログ表示後に自動作成（タイムスタンプ付き）

**設計上の利点**:
- シンプルで高速（ファイル存在チェックのみ）
- デバッグ可能（タイムスタンプで初回起動日時を確認可能）
- Unix慣習に準拠（ドットプレフィックスの隠しファイル）

### 今後の拡張予定

- **Windows/macOS対応の確認**: 現在はLinuxのみ動作確認済み
- **自動更新機能**: `electron-updater`の統合
- **複数言語対応**: 英語版UIの追加
- **設定のインポート/エクスポート**: YAML設定の保存・読み込み

## 参考資料

- [Electron公式ドキュメント](https://www.electronjs.org/docs/latest/)
- [electron-builder公式ドキュメント](https://www.electron.build/)
- [AppImage仕様](https://docs.appimage.org/)
- [Electron設定ウィンドウガイド](ELECTRON_SETTINGS.md) - Phase 2の詳細
- [Master/Slave制御アーキテクチャ](MASTER_SLAVE_ARCHITECTURE.md) - Phase 3の詳細
