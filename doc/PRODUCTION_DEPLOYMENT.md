# 本番環境デプロイガイド - PM2を使った運用

## 目次

- [概要](#概要)
- [PM2のインストール](#pm2のインストール)
- [基本的な使い方](#基本的な使い方)
- [OS起動時の自動起動設定](#os起動時の自動起動設定)
- [ログの確認](#ログの確認)
- [モニタリング](#モニタリング)
- [PM2設定のカスタマイズ](#pm2設定のカスタマイズ)
- [トラブルシューティング](#トラブルシューティング)

## 概要

本番環境では、PM2（Process Manager 2）を使用してサーバーを管理することを推奨します。PM2により、自動再起動、ログ管理、モニタリングなどの機能が利用できます。

**PM2の主な利点:**
- プロセスのデーモン化（バックグラウンド実行）
- 自動再起動（クラッシュ時）
- ログ管理とローテーション
- リアルタイムモニタリング
- OS起動時の自動起動
- ゼロダウンタイムリロード

## PM2のインストール

### グローバルインストール（本番環境推奨）

```bash
npm install -g pm2
```

### ローカル開発環境

プロジェクトには既に開発依存関係として含まれています（`npm install` で自動的にインストールされます）。

```bash
# プロジェクトのルートディレクトリで
npm install
```

## 基本的な使い方

### サーバーの起動

#### 本番モードで起動

```bash
npm run pm2:start
```

このコマンドは以下を実行します:
- `NODE_ENV=production` でサーバーを起動
- `ecosystem.config.js` の設定を使用
- プロセス名: `baseball-board`

#### 開発モードで起動

```bash
npm run pm2:dev
```

開発モードではコンソールにログが出力されます。

### サーバーの操作

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

### コマンドの詳細説明

| コマンド | 説明 | 使用場面 |
|---------|------|---------|
| `pm2:start` | アプリを起動 | 初回起動、削除後の再起動 |
| `pm2:stop` | アプリを停止（プロセスは残る） | 一時的な停止 |
| `pm2:restart` | アプリを再起動（短時間のダウンタイム） | 設定変更後 |
| `pm2:reload` | ゼロダウンタイムで再起動 | コード更新後 |
| `pm2:delete` | アプリをPM2から削除 | 完全なクリーンアップ |
| `pm2:logs` | リアルタイムログ表示 | デバッグ |
| `pm2:status` | プロセス状態確認 | 動作確認 |
| `pm2:monit` | リアルタイムモニタリング | パフォーマンス監視 |

## OS起動時の自動起動設定

サーバー再起動後も自動的にアプリケーションを起動する設定：

### 1. スタートアップスクリプトを生成

```bash
pm2 startup
```

このコマンドを実行すると、OSに応じたスタートアップコマンドが表示されます。

### 2. 表示されたコマンドを実行

表示されたコマンドをコピーして実行してください（sudoが必要な場合があります）。

**例（Linux/systemd）:**
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u youruser --hp /home/youruser
```

**例（macOS）:**
```bash
pm2 startup launchd
```

### 3. 現在の状態を保存

```bash
pm2 save
```

これにより、現在実行中のアプリケーションリストが保存され、OS起動時に自動的に起動します。

### 4. 動作確認

```bash
# サーバーを再起動
sudo reboot

# 再起動後、PM2の状態を確認
pm2 status
```

`baseball-board` が自動的に起動していれば成功です。

## ログの確認

PM2はログを自動的にファイルに保存します。

### ログファイルの場所

```
logs/pm2-out.log    # 標準出力
logs/pm2-error.log  # エラー出力
```

これらのパスは [ecosystem.config.js](../ecosystem.config.js) で設定されています。

### ログの表示方法

```bash
# リアルタイムでログを表示（Ctrl+C で終了）
npm run pm2:logs

# 標準出力のみ表示
npm run pm2:logs --out

# エラーログのみ表示
npm run pm2:logs --err

# 最新100行を表示
npm run pm2:logs --lines 100
```

### ログファイルを直接確認

```bash
# リアルタイムで標準出力を確認
tail -f logs/pm2-out.log

# リアルタイムでエラーログを確認
tail -f logs/pm2-error.log

# 最新50行を表示
tail -n 50 logs/pm2-out.log
```

### ログのローテーション

ログファイルが大きくなりすぎる場合は、PM2のログローテーションモジュールを使用できます:

```bash
# PM2ログローテーションモジュールをインストール
pm2 install pm2-logrotate

# 設定例（最大10MBで1日ごとにローテーション）
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## モニタリング

### リアルタイムモニタリング

```bash
npm run pm2:monit
```

モニタリング画面では、以下の情報がリアルタイムで確認できます:
- **CPU使用率** - プロセスのCPU消費量
- **メモリ使用量** - プロセスのメモリ消費量
- **稼働時間** - 起動からの経過時間
- **再起動回数** - クラッシュによる再起動回数
- **ログ** - リアルタイムログストリーム

### ステータス一覧

```bash
npm run pm2:status
```

**出力例:**
```
┌─────┬──────────────────┬─────────┬─────────┬──────────┬───────┐
│ id  │ name             │ mode    │ ↺       │ status   │ cpu   │
├─────┼──────────────────┼─────────┼─────────┼──────────┼───────┤
│ 0   │ baseball-board   │ fork    │ 0       │ online   │ 0.2%  │
└─────┴──────────────────┴─────────┴─────────┴──────────┴───────┘
```

**各列の説明:**
- **id**: プロセスID
- **name**: アプリケーション名
- **mode**: 実行モード（fork/cluster）
- **↺**: 再起動回数
- **status**: 状態（online/stopped/errored）
- **cpu**: CPU使用率
- **memory**: メモリ使用量

### プロセス情報の詳細表示

```bash
pm2 show baseball-board
```

より詳細な情報（稼働時間、環境変数、ログパスなど）が表示されます。

## PM2設定のカスタマイズ

[ecosystem.config.js](../ecosystem.config.js) で詳細な設定を変更できます:

```javascript
module.exports = {
  apps: [{
    name: 'baseball-board',
    script: './server.js',
    instances: 1,              // プロセス数（1 or 'max'）
    autorestart: true,         // 自動再起動
    watch: false,              // ファイル監視（本番ではfalse推奨）
    max_memory_restart: '500M', // メモリ制限
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,          // すべてのインスタンスのログを統合
    min_uptime: '10s',         // 正常起動と判断する最小稼働時間
    max_restarts: 10           // 最大再起動回数
  }]
};
```

### 主要な設定オプション

| オプション | 説明 | 推奨値 |
|-----------|------|-------|
| `instances` | プロセス数 | `1`（WebSocketサーバーのため） |
| `max_memory_restart` | メモリ制限 | `500M` or `1G` |
| `autorestart` | 自動再起動 | `true` |
| `watch` | ファイル監視 | 本番: `false`, 開発: `true` |
| `min_uptime` | 正常起動判断時間 | `10s` |
| `max_restarts` | 最大再起動回数 | `10` |

### 設定変更後の反映

```bash
# 設定を変更したら再起動
npm run pm2:restart
```

## トラブルシューティング

### プロセスが起動しない場合

```bash
# 1. ログを確認
npm run pm2:logs

# 2. PM2を完全にリセット
npm run pm2:delete
pm2 kill
npm run pm2:start

# 3. 直接nodeコマンドで起動確認
node server.js
```

### メモリ使用量が多い場合

```bash
# 1. 現在のメモリ使用量を確認
npm run pm2:status

# 2. ecosystem.config.jsの max_memory_restart を調整
# 例: max_memory_restart: '300M'

# 3. 設定を反映
npm run pm2:restart
```

PM2が指定したメモリ量を超えると自動的に再起動してメモリをクリアします。

### ログが表示されない場合

```bash
# ログファイルのパスを確認
pm2 show baseball-board

# ログファイルが存在するか確認
ls -la logs/

# ログディレクトリの権限を確認
chmod 755 logs/
```

### ポートが既に使用されている場合

```bash
# ポート8080を使用しているプロセスを確認
lsof -i :8080

# プロセスを終了
kill -9 <PID>

# または、PM2で管理されているプロセスを停止
npm run pm2:stop
```

### 自動起動が機能しない場合

```bash
# 1. スタートアップ設定を削除
pm2 unstartup

# 2. 再度スタートアップ設定
pm2 startup
# 表示されたコマンドを実行

# 3. 現在の状態を保存
pm2 save

# 4. 保存された設定を確認
cat ~/.pm2/dump.pm2
```

### PM2プロセスが見つからない場合

```bash
# PM2デーモンの状態を確認
pm2 ping

# PM2を完全に再起動
pm2 kill
pm2 resurrect
```

## 参考リンク

- [PM2公式ドキュメント](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/)
- [PM2 Startup Hook](https://pm2.keymetrics.io/docs/usage/startup/)
