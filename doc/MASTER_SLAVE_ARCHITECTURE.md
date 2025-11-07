# Master/Slave Operation Control - Architecture Documentation

## 目次

- [概要](#概要)
- [アーキテクチャ](#アーキテクチャ)
  - [サーバー側のロール管理](#サーバー側のロール管理-serverjs)
  - [クライアント側のロール管理](#クライアント側のロール管理-publicjsmainjs)
  - [UIインジケーター](#uiインジケーター-publicoperationhtml)
- [メッセージプロトコル](#メッセージプロトコル)
- [操作フロー](#操作フロー)
- [エッジケース](#エッジケース)
- [後方互換性](#後方互換性)
- [テスト](#テスト)
- [セキュリティ考慮事項](#セキュリティ考慮事項)

## 概要

複数のユーザーが操作パネルに同時にアクセスする場合の競合を防ぐため、マスター/スレーブアーキテクチャを実装しています:

- **マスター**: 最初に `operation.html` に接続したクライアントがマスターとなり、完全な操作権限を持ちます
- **スレーブ**: 後から接続したクライアントはスレーブとなり、閲覧専用となります
- **自動昇格**: マスターが切断されると、最も古いスレーブが自動的にマスターに昇格します
- **手動解放**: マスターは自発的に操作権限を解放し、他のユーザーに引き継ぐことができます

## アーキテクチャ

### サーバー側のロール管理 (server.js)

サーバーは接続中のすべてのクライアントとそのメタデータをマップで管理します:

```javascript
const clients = new Map(); // Map<clientId, {ws, type, role, connectedAt}>
let masterClientId = null;
```

**主要コンポーネント:**

1. **クライアント識別** ([server.js:62-68](../server.js#L62-L68)):
   - 各WebSocket接続には一意のID `client_${counter}_${timestamp}` が割り当てられます
   - クライアントタイプはハンドシェイクメッセージで判別されます

2. **ロール割り当て** ([server.js:147-190](../server.js#L147-L190)):
   - 操作クライアント: 最初の接続 → マスター、それ以降 → スレーブ
   - ボードクライアント: 常にビューアーロールを割り当て
   - ハンドシェイクタイムアウト (3秒): ハンドシェイクなしのクライアントはボードとして扱われます

3. **メッセージフィルタリング** ([server.js:210-229](../server.js#L210-L229)):
   - マスターのみが `game_state_update` メッセージを送信可能
   - マスター以外からの更新はログに記録され、拒否されます
   - すべてのクライアントはブロードキャストされた試合状態の更新を受信します

4. **昇格アルゴリズム** ([server.js:93-114](../server.js#L93-L114)):
   - マスター切断時、すべての操作スレーブを検索
   - 接続時刻でソート（最古優先）
   - 最も古いスレーブをマスターに昇格
   - `role_changed` 通知を送信

### クライアント側のロール管理 (public/js/main.js)

**状態変数** ([main.js:30-32](../public/js/main.js#L30-L32)):
```javascript
clientRole: null,  // null | 'master' | 'slave'
clientId: null,
masterClientId: null,
```

**主要機能:**

1. **ハンドシェイク** ([main.js:115-119](../public/js/main.js#L115-L119)):
   - 接続時に `{type: 'handshake', client_type: 'operation'}` を送信
   - 操作クライアント（ボードと区別）として識別

2. **ロールメッセージの処理** ([main.js:127-152](../public/js/main.js#L127-L152)):
   - `role_assignment`: サーバーからの初期ロール
   - `role_changed`: ロール更新（昇格または降格）
   - `game_state`: 他のクライアントからの状態更新

3. **UI制御** ([main.js:89-96](../public/js/main.js#L89-L96)):
   - `isOperationDisabled` 算出プロパティはスレーブの場合にtrueを返す
   - すべての操作ボタンは `:disabled="isOperationDisabled"` を使用

4. **更新ゲート** ([main.js:188-196](../public/js/main.js#L188-L196)):
   - `updateBoard()` は `clientRole === 'master'` の場合のみ更新を送信
   - スレーブが誤って状態変更を送信するのを防止

5. **手動解放** ([main.js:337-349](../public/js/main.js#L337-L349)):
   - `releaseMasterControl()` メソッドは `release_master` メッセージを送信
   - マスターのみ利用可能
   - 確認ダイアログを表示

### UIインジケーター (public/operation.html)

**ステータス表示** ([operation.html:180-202](../public/operation.html#L180-L202)):
- 緑色バッジ: 👑 マスター (操作可能)
- 黄色バッジ: 👁️ スレーブ (閲覧専用)
- 視認性のためナビゲーションバーに表示

**スレーブ警告バナー** ([operation.html:208-217](../public/operation.html#L208-L217)):
- ロールがスレーブの場合、ページ上部にアラートボックスを表示
- 閲覧専用状態を説明
- 自動昇格について通知

**マスター制御カード** ([operation.html:366-380](../public/operation.html#L366-L380)):
- `clientRole === 'master'` の場合のみ表示
- 解放ボタンを含む
- 簡単にアクセスできるよう右列に配置

## メッセージプロトコル

### クライアント → サーバー メッセージ

**ハンドシェイク**:
```json
{
  "type": "handshake",
  "client_type": "operation" | "board"
}
```

**試合状態更新** (マスターのみ):
```json
{
  "type": "game_state_update",
  "data": {
    "game_title": "...",
    "team_top": "...",
    "game_inning": 1,
    ...
  }
}
```

**マスター解放**:
```json
{
  "type": "release_master"
}
```

### サーバー → クライアント メッセージ

**ロール割り当て**:
```json
{
  "type": "role_assignment",
  "role": "master" | "slave" | "viewer",
  "clientId": "client_1_1234567890",
  "masterClientId": "client_0_1234567889"
}
```

**ロール変更**:
```json
{
  "type": "role_changed",
  "newRole": "master" | "slave",
  "reason": "master_disconnected" | "master_released"
}
```

**試合状態ブロードキャスト**:
```json
{
  "type": "game_state",
  "data": { ... }
}
```

## 操作フロー

### 初回接続

```
1. クライアントがWebSocketに接続
2. クライアントがハンドシェイク {type: "handshake", client_type: "operation"} を送信
3. サーバーがマスターの存在を確認
   - マスターなし → ロール: "master" を割り当て、masterClientIdを設定
   - マスターあり → ロール: "slave" を割り当て
4. サーバーが role_assignment メッセージを送信
5. サーバーが現在の game_state を送信
6. クライアントがロールインジケーターを表示し、UIを有効/無効化
```

### マスター切断

```
1. マスターのWebSocketが閉じる
2. サーバーが切断イベントを検出
3. サーバーが promoteNextMaster() を呼び出し
4. サーバーが connectedAt タイムスタンプで最も古いスレーブを検索
5. サーバーがスレーブのロールを "master" に更新
6. サーバーが新マスターに role_changed メッセージを送信
7. 新マスターがUI制御を有効化
```

### 手動解放

```
1. マスターが「マスター権限を解放」ボタンをクリック
2. 確認ダイアログが表示される
3. 確定すると、クライアントが {type: "release_master"} を送信
4. サーバーが masterClientId = null に設定
5. サーバーが元マスターのロールを "slave" に変更
6. サーバーが promoteNextMaster() を呼び出し
7. サーバーが両方に role_changed を送信:
   - 元マスター (newRole: "slave")
   - 新マスター (newRole: "master")
8. UIが適切に更新される
```

## エッジケース

**同時接続**:
- レースコンディションはサーバー側の逐次処理で解決
- 最初に処理されたハンドシェイクがマスターロールを獲得

**ネットワーク中断**:
- 自動再接続が新しいWebSocket接続をトリガー
- クライアントは新規接続として扱われる（マスターだった場合でも失う）
- 再接続は以前のロールを復元しない

**複数のブラウザタブ**:
- 各タブは独立した接続
- 最初のタブのみがマスターとなる
- 同じデバイスからの他のタブはスレーブとなる

**ハンドシェイクタイムアウト**:
- 3秒以内にハンドシェイクを送信しないクライアントはボードとして扱われる
- 古いboard.htmlバージョンとの後方互換性を確保
- ボードクライアントには "viewer" ロールが割り当てられる（操作権限なし）

## 後方互換性

**ボードクライアント**:
- `board.html` はハンドシェイクを送信するように更新（[board.js:72-76](../public/js/board.js#L72-L76)）
- ハンドシェイクなしの古いバージョンも動作（タイムアウト → ビューアー）
- ボードクライアントは操作マスター/スレーブロジックに干渉しない

**レガシー試合状態メッセージ**:
- `type` フィールドのないメッセージは試合状態更新として扱われる
- 古いクライアントコードとの互換性を維持
- サーバーチェック: `if (data.type === 'game_state_update' || !data.type)`

## テスト

### 基本機能

```bash
# ターミナル 1: サーバー起動
node server.js

# ブラウザ 1: 操作パネルを開く
# 表示されるべき内容: 👑 マスター (操作可能)
open http://localhost:8080/operation.html

# ブラウザ 2: 別の操作パネルを開く
# 表示されるべき内容: 👁️ スレーブ (閲覧専用)
open http://localhost:8080/operation.html
```

### マスター昇格

1. ブラウザ 1 (マスター) を閉じる
2. ブラウザ 2 が自動的にマスターに昇格するはず
3. ナビゲーションバーでロール変更を確認

### 手動解放

1. ブラウザ 1 がマスター、ブラウザ 2 がスレーブの状態で
2. ブラウザ 1 で「マスター権限を解放」をクリック
3. ダイアログを確認
4. ブラウザ 1 がスレーブに、ブラウザ 2 がマスターになる

### ネットワークログ

```bash
# 詳細ログを有効化
node server.js

# ログメッセージを確認:
# - Client connected: client_X_timestamp
# - Client client_X_timestamp registered as operation/master
# - Client client_Y_timestamp registered as operation/slave
# - Rejected update from non-master client client_Y_timestamp
# - Master client_X_timestamp released control
# - Client client_Y_timestamp promoted to master
```

## セキュリティ考慮事項

### 現在の実装

- 認証なし: 任意のクライアントが接続可能
- マスターは接続順のみで決定
- 信頼できるローカルネットワークまたは単一ユーザーシナリオに適している

### 将来の拡張案

- パスワード保護されたマスターアクセス
- IPベースのアクセス制御
- セッションベースのロール永続化
- 管理者オーバーライド機能
