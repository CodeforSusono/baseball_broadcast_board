# 設定ウィンドウガイド - Electron機能

## 目次

- [概要](#概要)
- [設定ウィンドウの開き方](#設定ウィンドウの開き方)
- [機能詳細](#機能詳細)
- [推奨ワークフロー](#推奨ワークフロー)
- [UIコンポーネント](#uiコンポーネント)
- [トラブルシューティング](#トラブルシューティング)
- [ファイル構造](#ファイル構造)
- [技術仕様](#技術仕様)
- [参考資料](#参考資料)

## 概要

このドキュメントでは、Baseball Scoreboard Electronアプリの設定ウィンドウ機能について説明します。

Phase 2で実装された設定ウィンドウ機能により、コマンドラインを使用せずにGUIで以下の操作が可能になりました：

- ✅ YAMLファイルからの設定ファイル生成
- ✅ 試合状態の削除
- ✅ 設定の再読み込み（全ウィンドウへの通知）

## 設定ウィンドウの開き方

### メニューバーから

1. **ファイル > 設定** をクリック
2. キーボードショートカット: `Ctrl+,` (Linux/Windows) / `Cmd+,` (macOS)

### システムトレイから

1. トレイアイコンを右クリック
2. **設定** をクリック

## 機能詳細

### 1. YAMLファイルから設定生成

**目的**: 新しい大会・トーナメントの設定を簡単に作成

**手順**:

1. **YAMLファイルを準備**

   ```yaml
   game_title: 夏季大会2025
   last_inning: 7
   team_names:
     - チームA
     - チームB
     - チームC
   ```

2. **設定ウィンドウで操作**
   - `📁 YAMLファイルを選択` ボタンをクリック
   - YAMLファイルを選択
   - プレビューで内容を確認
   - `✅ 設定ファイルを生成` ボタンをクリック

3. **確認ダイアログ**
   - 成功メッセージが表示されます
   - 「試合状態も削除しますか?」という確認が表示されます
   - 新しい大会を開始する場合は「OK」をクリック

**生成されるファイル**:

```
~/.config/baseball_broadcast_board/config/init_data.json
~/.config/baseball_broadcast_board/config/init_data.json.bak (バックアップ)
```

**生成内容の例**:

```json
{
  "game_title": "夏季大会2025",
  "team_top": "チームA",
  "team_bottom": "チームB",
  "game_array": ["試合前", 1, 2, 3, 4, 5, 6, 7, "試合終了"],
  "team_items": ["　", "チームA", "チームB", "チームC"],
  "last_inning": 7
}
```

### 2. 試合状態を削除

**目的**: 現在の試合状態をリセットし、新しい設定を適用可能にする

**手順**:

1. `🗑️ 試合状態を削除` ボタンをクリック
2. 確認ダイアログで「OK」をクリック
3. 「設定を再読み込みしますか?」という確認が表示されます
4. すぐに反映させる場合は「OK」をクリック

**削除されるファイル**:

```
~/.config/baseball_broadcast_board/data/current_game.json
```

**注意点**:

- このファイルには現在の試合状況（イニング、スコア、BSO、ランナー）が保存されています
- 削除すると試合がリセットされます
- バックアップは自動作成されませんので、必要に応じて手動でバックアップしてください

### 3. 設定を再読み込み

**目的**: すべてのウィンドウに設定変更を通知し、自動的に反映させる

**手順**:

1. `🔄 設定を再読み込み` ボタンをクリック
2. 成功メッセージが表示されます

**動作**:

- すべてのBrowserWindow（操作パネル、表示ボード）に`reload-config`イベントが送信されます
- 操作パネルは自動的に`init_data.json`を再読み込みします
- **手動でリロード（F5）する必要はありません**

**技術的な仕組み**:

```javascript
// main.js - すべてのウィンドウに通知
BrowserWindow.getAllWindows().forEach(window => {
  window.webContents.send('reload-config');
});

// public/js/operation.js - イベント受信と処理
window.electronAPI.onReloadConfig(() => {
  console.log('Received reload-config event from Electron');
  this.loadConfiguration(true); // forceReload = true
});
```

## 推奨ワークフロー

### 新しい大会を開始する場合

```
1. YAMLファイルを用意（大会名、チーム名、イニング数を記載）
   ↓
2. 設定ウィンドウで「YAMLファイルから設定生成」をクリック
   ↓
3. 確認ダイアログで「試合状態も削除しますか?」→「OK」
   （自動的に試合状態削除機能が実行されます）
   ↓
4. 確認ダイアログで「設定を再読み込みしますか?」→「OK」
   （自動的に設定再読み込み機能が実行されます）
   ↓
5. 操作パネルで新しい設定が反映されていることを確認
```

このワークフローでは、確認ダイアログに従うだけで全ての処理が自動的に実行されます。

### 大会設定だけを変更する場合（試合をリセットしない）

```
1. YAMLファイルで大会名やチーム名を変更
   ↓
2. 設定ウィンドウで「YAMLファイルから設定生成」をクリック
   ↓
3. 「試合状態も削除しますか?」→「キャンセル」
   （試合中の状態は保持されます）
   ↓
4. 設定ウィンドウで「設定を再読み込み」をクリック
   ↓
5. 操作パネルのドロップダウン選択肢が更新されます
   （ただし、現在の大会名・チーム名は変更されません）
```

## UIコンポーネント

### ステータスメッセージ

各カードには操作結果を表示するアラートが表示されます：

- **成功**: 緑色の背景（`alert-success`）
- **エラー**: 赤色の背景（`alert-danger`）
- **自動消去**: 5秒後に自動的に消えます

### バージョン表示

設定ウィンドウの右上にアプリのバージョンが表示されます：

```html
<span class="badge bg-light text-dark">Version: {{ appVersion }}</span>
```

このバージョンは`package.json`の`version`フィールドから自動取得されます。

## ヘルプセクション

設定ウィンドウには、YAMLファイルの例とワークフローのヒントが含まれています：

```yaml
game_title: 夏季大会
last_inning: 7
team_names:
  - チームA
  - チームB
  - チームC
```

## トラブルシューティング

### 「設定ファイルを生成」ボタンが押せない

**原因**: YAMLファイルが選択されていません

**解決策**: `📁 YAMLファイルを選択` ボタンをクリックしてファイルを選択してください

### 「YAMLファイルの読み込みに失敗しました」エラー

**考えられる原因**:
1. YAMLファイルのフォーマットが正しくない
2. 必須フィールド（`game_title`, `last_inning`, `team_names`）が不足している
3. ファイルのエンコーディングがUTF-8ではない

**解決策**:
1. YAMLファイルの内容を確認してください
2. 必須フィールドがすべて含まれているか確認してください
3. ファイルをUTF-8で保存してください

### 「設定を再読み込み」しても操作パネルが更新されない

**原因**: 操作パネルのロード条件により、サーバーから復元された状態では更新されない仕様でした

**解決策**: Phase 2の最新実装では、`loadConfiguration(true)`による強制リロードが実装されているため、この問題は解決されています。

最新版を使用しているか確認してください：
```bash
git pull origin master
npm run build:linux
```

### 設定ウィンドウが開かない

**原因**: サーバーが起動していない可能性があります

**解決策**:
1. 操作パネルが正常に開いているか確認してください
2. ターミナルでエラーメッセージを確認してください
3. アプリを再起動してください

## ファイル構造

設定ウィンドウ機能に関連するファイル：

```
electron_bbb/
├── public/
│   ├── settings.html                 # 設定ウィンドウのHTML
│   └── js/
│       └── settings.js                # 設定ウィンドウのVue.jsアプリ
├── main.js                            # IPCハンドラの実装
├── preload.js                         # セキュアなAPI公開
└── server.js                          # 設定ファイル配信（優先度ロジック）
```

## 技術仕様

### IPC通信

設定ウィンドウは以下のIPCチャンネルを使用します：

| チャンネル | 説明 | 引数 | 戻り値 |
|-----------|------|------|--------|
| `dialog:openFile` | ファイル選択ダイアログ | `options` | `{canceled, filePaths}` |
| `config:readYaml` | YAMLファイル読み込み | `filePath` | `{success, data/error}` |
| `config:generate` | 設定ファイル生成 | `yamlPath` | `{success, message/error}` |
| `config:deleteCurrent` | 試合状態削除 | - | `{success, message/error}` |
| `config:reload` | 設定再読み込み通知 | - | `{success, message/error}` |
| `app:getVersion` | アプリバージョン取得 | - | `string` (version) |

### イベント通信

| イベント | 送信元 | 受信先 | 説明 |
|---------|--------|--------|------|
| `reload-config` | Main process | All BrowserWindows | 設定再読み込み要求 |

### セキュリティ

- `contextIsolation: true` - レンダラープロセスとプリロードスクリプトを分離
- `nodeIntegration: false` - レンダラープロセスでのNode.js APIを無効化
- `enableRemoteModule: false` - remoteモジュールを無効化
- `contextBridge` - セキュアなAPIのみを公開

## 参考資料

- [Electron IPC通信](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Vue.js 3ドキュメント](https://v3.vuejs.org/)
- [js-yamlドキュメント](https://github.com/nodeca/js-yaml)
