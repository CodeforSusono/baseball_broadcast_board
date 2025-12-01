# Testing Framework Proposal for Baseball Scoreboard

## Executive Summary

このドキュメントでは、Baseball Scoreboard Electronアプリケーションに最適なテストフレームワークを提案します。プロジェクトの特性（Electron、Node.js、WebSocket、Vue.js）を考慮し、**Vitest + Spectron/Playwright**の組み合わせを推奨します。

## プロジェクトの特性分析

### テスト対象のコンポーネント

1. **メインプロセス (main.js)**
   - IPCハンドラ (セキュリティクリティカル)
   - ファイルシステム操作
   - ウィンドウ管理
   - サーバープロセス管理

2. **レンダラープロセス**
   - Vue.js コンポーネント (Scoreboard.js)
   - WebSocket クライアント (operation.js, board.js)
   - 設定UI (settings.js)

3. **サーバー (server.js)**
   - WebSocket リレー
   - HTTPファイルサーバー
   - 状態管理

4. **ユーティリティ (scripts/)**
   - init_data.json生成ロジック
   - 依存関係コピースクリプト

## 推奨テストフレームワーク

### 🏆 最優先推奨: **Vitest**

#### 選定理由

1. **高速**: Viteベースで並列実行が高速
2. **Jest互換API**: 学習コストが低い
3. **ESM/CommonJSサポート**: プロジェクトの混在環境に対応
4. **Vue.jsフレンドリー**: Vue Test Utilsとの統合が容易
5. **モダン**: 最新のJavaScript機能をサポート

#### 適用範囲

- ✅ ユニットテスト (main.js関数、scripts/、ユーティリティ)
- ✅ セキュリティテスト (validateFilePath、IPCハンドラ)
- ✅ Vue.jsコンポーネントテスト
- ✅ WebSocketサーバーロジック

#### 導入コスト

- **学習コスト**: 低 (Jest経験者なら即戦力)
- **設定コスト**: 低 (設定ファイル1つ)
- **メンテナンスコスト**: 低 (活発なコミュニティ)

---

### 補助的推奨: **Playwright for Electron**

#### 選定理由

1. **公式サポート**: ElectronのE2Eテストに対応
2. **クロスプラットフォーム**: Windows/macOS/Linux対応
3. **信頼性**: タイムアウト処理、自動待機が優秀
4. **デバッグ**: 開発者ツール統合、スクリーンショット

#### 適用範囲

- ✅ E2Eテスト (Electronアプリ全体の動作)
- ✅ UIインタラクションテスト
- ✅ 複数ウィンドウ間の連携テスト

#### 導入コスト

- **学習コスト**: 中 (Playwrightの学習が必要)
- **設定コスト**: 中 (Electron用設定が必要)
- **メンテナンスコスト**: 低 (安定したAPI)

---

## 代替案との比較

| フレームワーク | 速度 | Electron対応 | Vue対応 | 学習コスト | 総合評価 |
|--------------|------|--------------|---------|-----------|----------|
| **Vitest** (推奨) | ⚡⚡⚡ | ✅ (ユニット) | ✅✅ | 低 | ⭐⭐⭐⭐⭐ |
| **Playwright** (推奨) | ⚡⚡ | ✅✅ (E2E) | ✅ | 中 | ⭐⭐⭐⭐ |
| Jest | ⚡⚡ | ✅ (ユニット) | ✅ | 低 | ⭐⭐⭐⭐ |
| Mocha + Chai | ⚡⚡ | ✅ | ✅ | 中 | ⭐⭐⭐ |
| Spectron (非推奨) | ⚡ | ✅ (E2E) | ✅ | 高 | ⭐⭐ (deprecated) |

### なぜJestではなくVitestか

- **Vitest**: ESM/CommonJS両対応、Viteエコシステム統合、高速
- **Jest**: CommonJS中心、ESMサポートが実験的、やや遅い

このプロジェクトは将来的にESM移行の可能性があるため、Vitestの方が柔軟性が高いです。

### なぜSpectronではなくPlaywrightか

- **Spectron**: 2022年に開発停止、Electron 15+で非推奨
- **Playwright**: 公式サポート、活発な開発、Electron最新版対応

---

## 導入ロードマップ

### Phase 1: Vitestによるユニットテスト (優先度: 高)

**目標**: セキュリティクリティカルな関数のテストカバレッジ確保

**対象**:
1. `validateFilePath()` - パストラバーサル対策
2. IPCハンドラ - `config:readYaml`, `config:generate`
3. `generateInitData()` - 設定ファイル生成ロジック
4. WebSocketサーバーロジック

**工数見積**: 1-2日

---

### Phase 2: Vue.jsコンポーネントテスト (優先度: 中)

**目標**: UIコンポーネントの動作保証

**対象**:
1. Scoreboard.js - スコアボード表示ロジック
2. operation.js - 操作パネルのVue app
3. settings.js - 設定ウィンドウのVue app

**工数見積**: 2-3日

---

### Phase 3: Playwright E2Eテスト (優先度: 低)

**目標**: アプリケーション全体の統合テスト

**対象**:
1. 設定ウィンドウからYAML読み込み
2. 操作パネルでの試合操作
3. 複数ウィンドウ間の状態同期

**工数見積**: 3-4日

---

## 詳細な導入手順

### Step 1: Vitestのインストール

```bash
npm install -D vitest @vitest/ui
npm install -D @vue/test-utils happy-dom  # Vue.jsコンポーネントテスト用
```

### Step 2: Vitest設定ファイル作成

`vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // テスト環境
    environment: 'node', // メインプロセス、サーバーテスト用

    // グローバルAPI (describe, it, expect) を自動インポート
    globals: true,

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'main.js',
        'server.js',
        'scripts/**/*.js',
        'public/js/**/*.js'
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    },

    // テストファイルのパターン
    include: ['test/**/*.test.js', 'test/**/*.spec.js'],

    // タイムアウト設定
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
```

### Step 3: package.json更新

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

### Step 4: テストディレクトリ作成

```bash
mkdir -p test/unit
mkdir -p test/integration
mkdir -p test/e2e
```

---

## サンプルテストコード

### 1. セキュリティテスト (test/unit/security.test.js)

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import the function from main.js (requires module.exports)
// For now, we'll redefine it for testing
function validateFilePath(filePath, allowedExtensions = []) {
  try {
    const normalizedPath = path.normalize(filePath);
    const resolvedPath = path.resolve(normalizedPath);

    if (!fs.existsSync(resolvedPath)) {
      return { valid: false, error: 'File does not exist' };
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return { valid: false, error: 'Path is not a file' };
    }

    if (allowedExtensions.length > 0) {
      const ext = path.extname(resolvedPath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return {
          valid: false,
          error: `File extension must be one of: ${allowedExtensions.join(', ')}`
        };
      }
    }

    const suspiciousPatterns = ['..', '~', '%00', '\0'];
    for (const pattern of suspiciousPatterns) {
      if (normalizedPath.includes(pattern)) {
        return { valid: false, error: 'Path contains suspicious patterns' };
      }
    }

    return { valid: true, normalizedPath: resolvedPath };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

describe('Path Traversal Security Tests', () => {
  let tempYamlFile;

  beforeAll(() => {
    // Create a temporary YAML file for testing
    tempYamlFile = path.join(__dirname, 'temp-test.yaml');
    fs.writeFileSync(tempYamlFile, 'test: data', 'utf8');
  });

  afterAll(() => {
    // Clean up temporary file
    if (fs.existsSync(tempYamlFile)) {
      fs.unlinkSync(tempYamlFile);
    }
  });

  describe('Valid files', () => {
    it('should accept valid YAML file with .yaml extension', () => {
      const result = validateFilePath(tempYamlFile, ['.yaml', '.yml']);
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toBeDefined();
    });

    it('should accept file when no extension filter is specified', () => {
      const result = validateFilePath(tempYamlFile, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('Path traversal attacks', () => {
    it('should reject path traversal with ../', () => {
      const result = validateFilePath('../../../../etc/passwd', ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
    });

    it('should reject path traversal with valid extension', () => {
      const result = validateFilePath('../../../etc/passwd.yaml', ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
    });

    it('should reject path with .. pattern', () => {
      const maliciousPath = path.join(__dirname, '..', '..', '..', 'etc', 'passwd');
      const result = validateFilePath(maliciousPath, ['.yaml']);
      expect(result.valid).toBe(false);
    });
  });

  describe('Invalid extensions', () => {
    it('should reject .json file when .yaml is required', () => {
      const jsonFile = path.join(__dirname, '..', '..', 'package.json');
      const result = validateFilePath(jsonFile, ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File extension must be one of');
    });

    it('should reject .txt file', () => {
      const result = validateFilePath('/tmp/test.txt', ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
    });
  });

  describe('Invalid file types', () => {
    it('should reject directory paths', () => {
      const dirPath = path.join(__dirname, '..');
      const result = validateFilePath(dirPath, ['.yaml']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path is not a file');
    });
  });

  describe('Non-existent files', () => {
    it('should reject non-existent file', () => {
      const result = validateFilePath('/nonexistent/path/file.yaml', ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File does not exist');
    });
  });

  describe('Suspicious patterns', () => {
    it('should reject paths with tilde (~)', () => {
      const result = validateFilePath('~/test.yaml', ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path contains suspicious patterns');
    });

    it('should reject paths with null byte (%00)', () => {
      const result = validateFilePath('test.yaml%00.txt', ['.yaml', '.yml']);
      expect(result.valid).toBe(false);
    });
  });
});
```

### 2. サーバーロジックテスト (test/unit/server.test.js)

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import path from 'path';

describe('WebSocket Server Tests', () => {
  let serverProcess;
  const SERVER_PORT = 8081; // Use different port for testing

  beforeEach(async () => {
    // Start server in test mode
    serverProcess = spawn('node', ['server.js'], {
      env: { ...process.env, PORT: SERVER_PORT, NODE_ENV: 'test' },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterEach(() => {
    // Stop server
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should accept WebSocket connections', async () => {
    const ws = new WebSocket(`ws://localhost:${SERVER_PORT}`);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        resolve();
      });
      ws.on('error', reject);
    });
  });

  it('should relay messages between clients', async () => {
    const client1 = new WebSocket(`ws://localhost:${SERVER_PORT}`);
    const client2 = new WebSocket(`ws://localhost:${SERVER_PORT}`);

    await Promise.all([
      new Promise(resolve => client1.on('open', resolve)),
      new Promise(resolve => client2.on('open', resolve))
    ]);

    // Send handshake for client1 (operation panel - master)
    client1.send(JSON.stringify({
      type: 'handshake',
      client_type: 'operation'
    }));

    // Wait for role assignment
    await new Promise(resolve => setTimeout(resolve, 100));

    // client2 should receive messages from client1
    const messagePromise = new Promise(resolve => {
      client2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'game_state_update') {
          resolve(msg);
        }
      });
    });

    // client1 sends game state update
    client1.send(JSON.stringify({
      type: 'game_state_update',
      game_inning: 5,
      score_top: 3,
      score_bottom: 2
    }));

    const receivedMsg = await messagePromise;
    expect(receivedMsg.game_inning).toBe(5);
    expect(receivedMsg.score_top).toBe(3);

    client1.close();
    client2.close();
  });
});
```

### 3. Vue.jsコンポーネントテスト (test/unit/scoreboard.test.js)

```javascript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Scoreboard from '../../public/js/Scoreboard.js';

describe('Scoreboard Component', () => {
  it('should render team names', () => {
    const wrapper = mount(Scoreboard, {
      props: {
        boardData: {
          team_top: 'Team A',
          team_bottom: 'Team B',
          score_top: 0,
          score_bottom: 0,
          game_inning: 1,
          top: true,
          ball_cnt: 0,
          strike_cnt: 0,
          out_cnt: 0,
          first_base: false,
          second_base: false,
          third_base: false
        }
      }
    });

    expect(wrapper.html()).toContain('Team A');
    expect(wrapper.html()).toContain('Team B');
  });

  it('should display correct score', () => {
    const wrapper = mount(Scoreboard, {
      props: {
        boardData: {
          team_top: 'Team A',
          team_bottom: 'Team B',
          score_top: 5,
          score_bottom: 3,
          game_inning: 7,
          top: false
        }
      }
    });

    // Check if scores are rendered
    const svg = wrapper.find('svg');
    expect(svg.exists()).toBe(true);
  });

  it('should show bases when runners are on', () => {
    const wrapper = mount(Scoreboard, {
      props: {
        boardData: {
          first_base: true,
          second_base: false,
          third_base: true,
          game_inning: 1,
          top: true
        }
      }
    });

    // Bases should be visible when v-show is true
    const bases = wrapper.findAll('.base');
    expect(bases.length).toBeGreaterThan(0);
  });
});
```

---

## Playwright for Electron設定例

### インストール

```bash
npm install -D @playwright/test
npx playwright install
```

### playwright.config.js

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'electron',
      use: {
        browserName: 'chromium',
        // Electron specific configuration
      },
    },
  ],
});
```

### E2Eテスト例 (test/e2e/app.spec.js)

```javascript
import { test, expect, _electron as electron } from '@playwright/test';

test('should launch Electron app', async () => {
  const app = await electron.launch({
    args: ['main.js']
  });

  const window = await app.firstWindow();
  expect(await window.title()).toBe('Baseball Scoreboard');

  await app.close();
});

test('should open settings window', async () => {
  const app = await electron.launch({ args: ['main.js'] });

  const operationWindow = await app.firstWindow();

  // Trigger settings window (Ctrl+,)
  await operationWindow.keyboard.press('Control+Comma');

  // Wait for settings window to appear
  const windows = await app.windows();
  expect(windows.length).toBeGreaterThan(1);

  const settingsWindow = windows.find(w => w.url().includes('settings.html'));
  expect(settingsWindow).toBeDefined();

  await app.close();
});
```

---

## カバレッジ目標

### Phase 1 (最優先)
- **セキュリティ関連**: 100% カバレッジ
  - `validateFilePath()`
  - IPC ハンドラ (`config:readYaml`, `config:generate`)

### Phase 2
- **コアロジック**: 80% カバレッジ
  - `generateInitData()`
  - WebSocketサーバーロジック

### Phase 3
- **UIコンポーネント**: 60% カバレッジ
  - Vue.js コンポーネント

---

## CI/CD統合

### GitHub Actions設定例 (.github/workflows/test.yml)

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:run

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## まとめ

### 推奨する最小構成 (即座に開始可能)

1. **Vitest** - ユニット・統合テスト
   - 優先度: ⭐⭐⭐⭐⭐
   - 導入コスト: 低
   - 効果: 高 (セキュリティテスト確保)

2. **@vue/test-utils** - Vue.jsコンポーネントテスト
   - 優先度: ⭐⭐⭐
   - 導入コスト: 低
   - 効果: 中 (UIロジック保証)

### 将来的に追加を検討

3. **Playwright for Electron** - E2Eテスト
   - 優先度: ⭐⭐
   - 導入コスト: 中
   - 効果: 中 (統合動作保証)

---

## 次のアクション

1. ✅ Vitestをインストール
2. ✅ セキュリティテストを作成 (validateFilePath)
3. ✅ CIパイプラインに統合
4. ⏳ カバレッジレポート確認
5. ⏳ 必要に応じてPlaywright追加

**質問や不明点があれば、お気軽にお尋ねください!**
