# WebSocket自動再接続機能 - 技術ドキュメント

## 目次

- [概要](#概要)
- [再接続の動作](#再接続の動作)
- [接続状態の確認](#接続状態の確認)
- [接続が切断される状況](#接続が切断される状況)
- [実装詳細](#実装詳細)
- [トラブルシューティング](#トラブルシューティング)

## 概要

操作パネル（`operation.html`）と表示ボード（`board.html`）は、WebSocket接続が切断された場合に自動的に再接続を試みます。この機能により、ネットワークの一時的な不調やサーバーの再起動時でも、ユーザーが手動でページをリロードする必要がありません。

## 再接続の動作

### 再接続の仕組み

- **自動再接続開始**: 接続が切断されると、自動的に再接続を開始
- **指数バックオフ方式**: 再接続間隔を徐々に延長（1秒 → 2秒 → 4秒 → 8秒...）
- **最大間隔**: 最大30秒まで再接続間隔を延長
- **最大試行回数**: 最大10回まで再接続を試行

### 指数バックオフの計算式

```javascript
reconnectDelay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
```

**例:**
- 1回目: 1秒
- 2回目: 2秒
- 3回目: 4秒
- 4回目: 8秒
- 5回目: 16秒
- 6回目: 30秒（最大値）
- 7回目以降: 30秒

### 接続状態

| 状態 | 表示 | 説明 |
|------|------|------|
| `connecting` | ⚪ **接続中...** | 初回接続を試みています |
| `connected` | 🟢 **接続中** | WebSocketが正常に接続されています |
| `reconnecting` | 🟡 **再接続中... (N/10)** | 接続が切断され、再接続を試みています（試行回数を表示） |
| `disconnected` | 🔴 **切断 (再接続失敗)** | 最大試行回数に達し、再接続に失敗しました |

## 接続状態の確認

### 操作パネル

- 画面上部のナビゲーションバーに接続状態インジケーターが表示されます
- 再接続中は試行回数（例: **3/10**）が表示されます
- 色分けにより一目で状態を判断できます

**実装箇所:** [public/operation.html](../public/operation.html) のナビゲーションバー

### 表示ボード

- 通常は接続状態を表示しません（配信画面に映り込まないため）
- ブラウザの開発者コンソール（F12）でログを確認できます

**コンソールログの例:**
```
WebSocket connected
WebSocket disconnected, attempting reconnect... (1/10)
WebSocket reconnect attempt 1 of 10
WebSocket connected
```

## 接続が切断される状況

以下の場合にWebSocket接続が切断されることがあります:

### 1. サーバー側の要因

- **サーバーの再起動**: `node server.js` を再実行した場合
- **PM2のリロード/再起動**: `npm run pm2:restart` や `npm run pm2:reload` を実行した場合
- **サーバーのクラッシュ**: エラーによりサーバープロセスが停止した場合
- **メンテナンス作業**: 意図的なサーバー停止

### 2. ネットワーク側の要因

- **ネットワークの一時的な不調**: Wi-Fi接続の不安定化
- **ファイアウォール**: ネットワーク機器によるWebSocket接続の遮断
- **タイムアウト**: 長時間のアイドル状態によるコネクション切断

### 3. クライアント側の要因

- **ブラウザタブのスリープ**: バックグラウンドタブがスリープ状態になった場合
- **デバイスのスリープ**: PCやタブレットがスリープモードに入った場合

### 対処方法

1. **自動再接続を待つ**: 通常は数秒以内に自動的に再接続されます
2. **ブラウザをリロード**: 再接続に失敗した場合は F5 キーでリロード
3. **サーバーの状態を確認**: それでも接続できない場合、サーバーが起動しているか確認

## 実装詳細

### 操作パネル (public/js/operation.js)

再接続ロジックは [public/js/operation.js](../public/js/operation.js) に実装されています。

**主要な実装箇所:**

1. **WebSocket接続管理**:
   - WebSocket接続の初期化
   - 接続状態の管理
   - イベントハンドラの設定

2. **再接続ロジック**:
   - `onclose` イベントで再接続をトリガー
   - 指数バックオフアルゴリズムで再接続間隔を計算
   - 最大試行回数に達したら停止

3. **接続状態インジケーター**:
   - Vue.jsのリアクティブプロパティで状態を管理
   - `connectionStatus` と `reconnectAttempt` を表示

### 表示ボード (public/js/board.js)

表示ボードも同様の再接続ロジックを実装しています。

**実装箇所:** [public/js/board.js](../public/js/board.js)

### 再接続パラメータ

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `maxReconnectAttempts` | 10 | 最大再接続試行回数 |
| `reconnectDelay` | 1000ms（初期値） | 初回再接続待機時間 |
| `maxReconnectDelay` | 30000ms | 最大再接続待機時間 |
| `connectionStatus` | `connecting`, `connected`, `reconnecting`, `disconnected` | 接続状態 |

### カスタマイズ方法

再接続パラメータを変更する場合は、以下のファイルを編集します:

**public/js/operation.js:**
```javascript
// 再接続パラメータの変更例
const maxReconnectAttempts = 20;  // 最大20回まで試行
const maxReconnectDelay = 60000;  // 最大60秒まで延長
```

**public/js/board.js:**
```javascript
// 同様に変更
const maxReconnectAttempts = 20;
const maxReconnectDelay = 60000;
```

## トラブルシューティング

### 再接続が繰り返される場合

**症状:** 接続と切断が頻繁に繰り返される

**原因:**
- サーバーが起動していない
- サーバーがクラッシュを繰り返している
- ネットワークが不安定

**対処方法:**
```bash
# 1. サーバーが起動しているか確認
npm run pm2:status

# 2. サーバーログを確認
npm run pm2:logs

# 3. サーバーを再起動
npm run pm2:restart
```

### 接続状態が「切断」のままの場合

**症状:** 🔴 **切断 (再接続失敗)** が表示され続ける

**原因:**
- サーバーが停止している
- ファイアウォールがWebSocket接続を遮断している
- ネットワークが到達不可能

**対処方法:**
1. ブラウザをリロード（F5キー）
2. サーバーを再起動: `npm run pm2:restart`
3. ブラウザの開発者コンソール（F12）でエラーメッセージを確認
4. ネットワーク接続を確認
5. ファイアウォール設定を確認（ポート8080が開いているか）

### ブラウザの開発者コンソールでエラーを確認

```
F12キーを押してコンソールを開く
→ ネットワークタブで WebSocket の接続状態を確認
→ コンソールタブでエラーメッセージを確認
```

**よくあるエラーメッセージ:**

| エラー | 原因 | 対処方法 |
|-------|------|---------|
| `WebSocket connection failed` | サーバーに接続できない | サーバーの起動を確認 |
| `ERR_CONNECTION_REFUSED` | サーバーが起動していない | `npm run pm2:start` でサーバーを起動 |
| `ERR_NAME_NOT_RESOLVED` | ホスト名が解決できない | URLを確認（localhost or IPアドレス） |
| `WebSocket is closed before the connection is established` | 接続が即座に切断される | サーバーログを確認 |

### デバッグモード

詳細なログを確認する場合:

```bash
# サーバーを開発モードで起動（詳細ログ有効）
node server.js

# または、PM2の開発モードで起動
npm run pm2:dev
```

開発モードでは、WebSocket接続/切断のログがコンソールに表示されます。

### 再接続ループから抜け出せない場合

最終手段として、以下の手順で完全にリセットします:

```bash
# 1. PM2プロセスを完全停止
npm run pm2:delete
pm2 kill

# 2. ブラウザのキャッシュをクリア
# Chrome: Ctrl+Shift+Del → キャッシュをクリア

# 3. サーバーを再起動
npm run pm2:start

# 4. ブラウザをリロード（Ctrl+F5でハードリロード）
```

## 参考リンク

- [WebSocket API - MDN](https://developer.mozilla.org/ja/docs/Web/API/WebSocket)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
- [ws - WebSocket ライブラリ](https://github.com/websockets/ws)
