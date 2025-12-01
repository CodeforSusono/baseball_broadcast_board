const { app, BrowserWindow, Menu, Tray, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const os = require('os');
const fs = require('fs');
const yaml = require('js-yaml');

// Development mode check
const isDev = process.env.NODE_ENV === 'development';

/**
 * Security: Validate file path to prevent path traversal attacks
 * @param {string} filePath - File path to validate
 * @param {string[]} allowedExtensions - Allowed file extensions (e.g., ['.yaml', '.yml'])
 * @returns {{valid: boolean, error?: string, normalizedPath?: string}}
 */
function validateFilePath(filePath, allowedExtensions = []) {
  try {
    // SECURITY: Check for suspicious patterns BEFORE normalization
    // This prevents path traversal attacks from being resolved away
    const suspiciousPatterns = ['..', '~', '%00', '\0'];
    for (const pattern of suspiciousPatterns) {
      if (filePath.includes(pattern)) {
        return { valid: false, error: 'Path contains suspicious patterns' };
      }
    }

    // Normalize and resolve the path
    const normalizedPath = path.normalize(filePath);
    const resolvedPath = path.resolve(normalizedPath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return { valid: false, error: 'File does not exist' };
    }

    // Check if it's a file (not a directory)
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return { valid: false, error: 'Path is not a file' };
    }

    // Check file extension if specified
    if (allowedExtensions.length > 0) {
      const ext = path.extname(resolvedPath).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return {
          valid: false,
          error: `File extension must be one of: ${allowedExtensions.join(', ')}`
        };
      }
    }

    return { valid: true, normalizedPath: resolvedPath };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Server configuration
const SERVER_PORT = 8080;
const SERVER_STARTUP_DELAY = 3000; // 3 seconds to ensure server is ready

// Global references to prevent garbage collection
let operationWindow = null;
let settingsWindow = null;
let serverProcess = null;
let tray = null;

/**
 * Check if a port is already in use
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is in use
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

/**
 * Get local IP address for network access
 * @returns {string} - Local IP address
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Start the WebSocket server as a child process
 * @returns {Promise<void>}
 */
async function startServer() {
  // Check if port is already in use
  const portInUse = await isPortInUse(SERVER_PORT);
  if (portInUse) {
    const response = await dialog.showMessageBox({
      type: 'warning',
      title: 'ポート使用中',
      message: `ポート ${SERVER_PORT} は既に使用されています。`,
      detail: '別のアプリケーションインスタンスが既に起動している可能性があります。\n\n既存のサーバーに接続しますか？',
      buttons: ['既存サーバーに接続', 'キャンセル'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 1) {
      app.quit();
      return;
    }

    console.log('Using existing server on port', SERVER_PORT);
    return;
  }

  // Start server process
  console.log('Starting server on port', SERVER_PORT);

  // Resolve server.js path - handle both development and packaged app
  // In production (packaged app), use app.asar.unpacked directory
  let serverPath;
  if (isDev) {
    serverPath = path.join(__dirname, 'server.js');
  } else {
    // In packaged app, files in asarUnpack are placed in app.asar.unpacked
    serverPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'server.js');
  }

  if (isDev) {
    console.log('Server path:', serverPath);
    console.log('__dirname:', __dirname);
    console.log('process.execPath:', process.execPath);
  }

  // Use process.execPath (electron) to run the server script
  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1', // Run as Node.js, not Electron
      USER_DATA_PATH: app.getPath('userData') // Pass userData path for writable data
    },
    stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout and stderr for debugging
  });

  // Log server output for debugging
  serverProcess.stdout.on('data', (data) => {
    console.log('[Server stdout]:', data.toString());
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('[Server stderr]:', data.toString());
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
    dialog.showErrorBox('サーバー起動エラー', `サーバーの起動に失敗しました:\n${error.message}`);
    app.quit();
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error('Server exited with code:', code);
    }
  });

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, SERVER_STARTUP_DELAY));
  console.log('Server should be ready');
}

/**
 * Create the operation panel window
 */
function createOperationWindow() {
  operationWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Baseball Scoreboard - 操作パネル',
    icon: path.join(__dirname, 'public/img/c4s_icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  // Load the operation panel from the local server
  operationWindow.loadURL(`http://localhost:${SERVER_PORT}/operation.html`);

  // Open DevTools in development mode
  if (isDev) {
    operationWindow.webContents.openDevTools();
  }

  // Handle window close
  operationWindow.on('closed', () => {
    operationWindow = null;
  });

  // Show error dialog if loading fails
  operationWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load operation panel:', errorDescription);
    dialog.showErrorBox(
      '読み込みエラー',
      `操作パネルの読み込みに失敗しました:\n${errorDescription}\n\nサーバーが起動しているか確認してください。`
    );
  });
}

/**
 * Create the settings window
 */
function createSettingsWindow() {
  // If settings window already exists, focus it
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 700,
    title: 'Baseball Scoreboard - 設定',
    icon: path.join(__dirname, 'public/img/c4s_icon.png'),
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  // Load the settings page from the local server
  settingsWindow.loadURL(`http://localhost:${SERVER_PORT}/settings.html`);

  // Show window when ready to render
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    settingsWindow.focus();
  });

  // Open DevTools in development mode
  if (isDev) {
    settingsWindow.webContents.openDevTools();
  }

  // Handle window close
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // Show error dialog if loading fails
  settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load settings page:', errorDescription);
    dialog.showErrorBox(
      '読み込みエラー',
      `設定画面の読み込みに失敗しました:\n${errorDescription}\n\nサーバーが起動しているか確認してください。`
    );
  });
}

/**
 * Create application menu
 */
function createMenu() {
  const template = [
    {
      label: 'ファイル',
      submenu: [
        {
          label: '操作パネルを表示',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (operationWindow) {
              operationWindow.show();
              operationWindow.focus();
            } else {
              createOperationWindow();
            }
          }
        },
        { type: 'separator' },
        {
          label: '設定',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            createSettingsWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'サーバー情報',
          click: () => {
            const localIP = getLocalIP();
            dialog.showMessageBox({
              type: 'info',
              title: 'サーバー情報',
              message: 'Baseball Scoreboard Server',
              detail: `ローカルURL: http://localhost:${SERVER_PORT}\n` +
                      `ネットワークURL: http://${localIP}:${SERVER_PORT}\n\n` +
                      `配信PCからアクセスする場合:\n` +
                      `http://${localIP}:${SERVER_PORT}/board.html`
            });
          }
        },
        { type: 'separator' },
        { label: '終了', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    {
      label: '表示',
      submenu: [
        { label: 'リロード', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '強制リロード', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '開発者ツール', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '拡大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '縮小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '実際のサイズ', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' }
      ]
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'バージョン情報',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'バージョン情報',
              message: 'Baseball Scoreboard',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode.js: ${process.versions.node}`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Create system tray icon and menu
 */
function createTray() {
  // Use the existing icon
  const iconPath = path.join(__dirname, 'public/img/c4s_icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '操作パネルを表示',
      click: () => {
        if (operationWindow) {
          operationWindow.show();
          operationWindow.focus();
        } else {
          createOperationWindow();
        }
      }
    },
    {
      label: '設定',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'サーバー情報',
      click: () => {
        const localIP = getLocalIP();
        dialog.showMessageBox({
          type: 'info',
          title: 'サーバー情報',
          message: `ローカルURL: http://localhost:${SERVER_PORT}\n\n配信PCからアクセスする場合:\nhttp://${localIP}:${SERVER_PORT}/board.html`
        });
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Baseball Scoreboard');

  // Show operation window on tray icon click
  tray.on('click', () => {
    if (operationWindow) {
      operationWindow.show();
      operationWindow.focus();
    } else {
      createOperationWindow();
    }
  });
}

/**
 * Helper functions for configuration management
 */

/**
 * Generate init_data.json from YAML configuration or parameters
 * @param {object} config - Configuration object {game_title, last_inning, team_names}
 * @returns {object} Generated init_data structure
 */
function generateInitData(config) {
  const { game_title, last_inning, team_names } = config;

  // Validate
  if (!Array.isArray(team_names) || team_names.length < 2) {
    throw new Error('参加チームは最低2チーム必要です');
  }

  const innings = parseInt(last_inning, 10);
  if (isNaN(innings) || innings < 1 || innings > 9) {
    throw new Error('最終イニングは 1 から 9 の範囲で指定してください');
  }

  // Generate game_array
  const game_array = ['試合前'];
  for (let i = 1; i <= innings; i++) {
    game_array.push(i);
  }
  game_array.push('試合終了');

  return {
    game_title: game_title,
    team_top: team_names[0],
    team_bottom: team_names[1],
    game_array: game_array,
    team_items: ['　', ...team_names],
    last_inning: innings,
    board_background_color: config.board_background_color || '#ff55ff'
  };
}

/**
 * Get path to config/init_data.json
 * In packaged app, use writable userData directory
 * @returns {string} Absolute path to init_data.json
 */
function getInitDataPath() {
  if (isDev) {
    return path.join(__dirname, 'config', 'init_data.json');
  } else {
    // Use writable userData directory for packaged app
    return path.join(app.getPath('userData'), 'config', 'init_data.json');
  }
}

/**
 * Get path to bundled init_data.json (read-only, for initial copy)
 * @returns {string} Absolute path to bundled init_data.json
 */
function getBundledInitDataPath() {
  return path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'config', 'init_data.json');
}

/**
 * Get path to data/current_game.json
 * @returns {string} Absolute path to current_game.json
 */
function getCurrentGamePath() {
  return path.join(app.getPath('userData'), 'data', 'current_game.json');
}

/**
 * Check if this is the first run of the application
 * @returns {boolean} - True if first run
 */
function isFirstRun() {
  const userDataPath = app.getPath('userData');
  const firstRunMarker = path.join(userDataPath, '.first_run_complete');
  return !fs.existsSync(firstRunMarker);
}

/**
 * Mark the first run as complete
 */
function markFirstRunComplete() {
  const userDataPath = app.getPath('userData');
  const firstRunMarker = path.join(userDataPath, '.first_run_complete');

  // Ensure userData directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // Create marker file with timestamp
  const timestamp = new Date().toISOString();
  fs.writeFileSync(firstRunMarker, `First run completed: ${timestamp}\n`);
  console.log('First run marked as complete');
}

/**
 * Show welcome dialog for first-time users
 */
function showWelcomeDialog() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Baseball Scoreboard へようこそ',
    message: '初めてご利用いただきありがとうございます!',
    detail: '設定ウィンドウが開きます。以下の手順で大会情報を設定してください。\n\n' +
            '【推奨ワークフロー】\n' +
            '1. YAMLファイルを選択（または新規作成）\n' +
            '2. 「✅ 設定ファイルを生成」をクリック\n' +
            '3. 「🗑️ 試合状態を削除」をクリック（確認ダイアログで自動提案）\n' +
            '4. 「🔄 設定を再読み込み」をクリック（確認ダイアログで自動提案）\n' +
            '5. 操作パネルで試合を開始\n\n' +
            'ヘルプ: 設定ウィンドウ下部にYAMLファイルの例があります。',
    buttons: ['OK']
  });
}

/**
 * Validate hex color code format
 * SECURITY: Prevent injection of non-color strings into configuration files
 *
 * @param {string} color - Color string to validate
 * @returns {Object} - Validation result with {valid: boolean, error?: string, normalizedColor?: string}
 */
function validateHexColor(color) {
  try {
    // Check if color is a non-empty string
    if (typeof color !== 'string' || color.trim() === '') {
      return { valid: false, error: 'Color must be a non-empty string' };
    }

    // Normalize: trim whitespace and convert to lowercase
    const normalizedColor = color.trim().toLowerCase();

    // SECURITY: Check for hex color code format (#rrggbb or #rgb)
    // Only accept standard hex color formats to prevent injection attacks
    const hexColorPattern = /^#([0-9a-f]{6}|[0-9a-f]{3})$/;

    if (!hexColorPattern.test(normalizedColor)) {
      return {
        valid: false,
        error: 'Color must be in hex format (#rrggbb or #rgb). Example: #ff55ff'
      };
    }

    // Expand 3-digit hex to 6-digit for consistency (#rgb -> #rrggbb)
    let expandedColor = normalizedColor;
    if (normalizedColor.length === 4) {
      // #rgb -> #rrggbb
      const r = normalizedColor[1];
      const g = normalizedColor[2];
      const b = normalizedColor[3];
      expandedColor = `#${r}${r}${g}${g}${b}${b}`;
    }

    return { valid: true, normalizedColor: expandedColor };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * IPC Handlers for settings window
 */

// File dialog
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(options);
  return result;
});

// Read YAML file
ipcMain.handle('config:readYaml', async (event, filePath) => {
  try {
    // Security: Validate file path to prevent path traversal attacks
    const validation = validateFilePath(filePath, ['.yaml', '.yml']);
    if (!validation.valid) {
      return { success: false, error: `Invalid file path: ${validation.error}` };
    }

    // Use the validated and normalized path
    const fileContents = fs.readFileSync(validation.normalizedPath, 'utf8');
    const data = yaml.load(fileContents);
    return { success: true, data: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Generate config from YAML
ipcMain.handle('config:generate', async (event, yamlPath) => {
  try {
    // Security: Validate file path to prevent path traversal attacks
    const validation = validateFilePath(yamlPath, ['.yaml', '.yml']);
    if (!validation.valid) {
      return { success: false, error: `Invalid file path: ${validation.error}` };
    }

    // Read YAML file using validated path
    const fileContents = fs.readFileSync(validation.normalizedPath, 'utf8');
    const yamlData = yaml.load(fileContents);

    // Validate required fields
    if (!yamlData.game_title || !yamlData.last_inning || !yamlData.team_names) {
      throw new Error('YAMLファイルに必須フィールド(game_title, last_inning, team_names)が不足しています');
    }

    // Generate init_data
    const initData = generateInitData({
      game_title: yamlData.game_title,
      last_inning: yamlData.last_inning,
      team_names: yamlData.team_names,
      board_background_color: yamlData.board_background_color
    });

    // Get writable path
    const initDataPath = getInitDataPath();
    const configDir = path.dirname(initDataPath);

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Backup existing file
    const backupPath = initDataPath + '.bak';
    if (fs.existsSync(initDataPath)) {
      fs.copyFileSync(initDataPath, backupPath);
    }

    // Save init_data.json
    fs.writeFileSync(initDataPath, JSON.stringify(initData, null, 2), 'utf8');

    return {
      success: true,
      message: `設定ファイルを生成しました\n先攻: ${initData.team_top}\n後攻: ${initData.team_bottom}`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete current game state
ipcMain.handle('config:deleteCurrent', async () => {
  try {
    const currentGamePath = getCurrentGamePath();

    if (!fs.existsSync(currentGamePath)) {
      return { success: true, message: '試合状態ファイルは存在しません' };
    }

    fs.unlinkSync(currentGamePath);
    return { success: true, message: '試合状態を削除しました。次回起動時に新しい設定が適用されます。' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Reload configuration (notify all clients)
ipcMain.handle('config:reload', async () => {
  try {
    // Send reload signal to all windows
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('reload-config');
    });

    return { success: true, message: '設定を再読み込みしました' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get app version
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

/**
 * Get board settings file path
 * @returns {string} - Path to board settings file
 */
function getBoardSettingsPath() {
  return path.join(app.getPath('userData'), 'config', 'board_settings.json');
}

/**
 * Get board background color
 */
ipcMain.handle('board:getBackgroundColor', async () => {
  try {
    const settingsPath = getBoardSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return settings.backgroundColor || '#ff55ff';
    }
    return '#ff55ff';
  } catch (error) {
    console.error('Failed to get background color:', error);
    return '#ff55ff';
  }
});

/**
 * Set board background color
 */
ipcMain.handle('board:setBackgroundColor', async (_event, color) => {
  try {
    // SECURITY: Validate color input to prevent injection of non-color strings
    const validation = validateHexColor(color);
    if (!validation.valid) {
      return { success: false, error: `Invalid color format: ${validation.error}` };
    }

    // Use the validated and normalized color (e.g., #rgb -> #rrggbb)
    const validatedColor = validation.normalizedColor;

    const settingsPath = getBoardSettingsPath();
    const settingsDir = path.dirname(settingsPath);

    // Ensure directory exists
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    // Save settings to file with validated color
    const settings = { backgroundColor: validatedColor };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // Also update init_data.json for browser access
    try {
      const initDataPath = getInitDataPath();
      const initDataDir = path.dirname(initDataPath);

      // Ensure config directory exists
      if (!fs.existsSync(initDataDir)) {
        fs.mkdirSync(initDataDir, { recursive: true });
      }

      // Read current init_data.json
      let initData = {};
      if (fs.existsSync(initDataPath)) {
        initData = JSON.parse(fs.readFileSync(initDataPath, 'utf8'));
      } else {
        // If init_data.json doesn't exist in userData, copy from bundled
        const bundledPath = getBundledInitDataPath();
        if (fs.existsSync(bundledPath)) {
          initData = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
        }
      }

      // Update background color with validated value
      initData.board_background_color = validatedColor;

      // Write updated init_data.json
      fs.writeFileSync(initDataPath, JSON.stringify(initData, null, 2));
      console.log(`Updated init_data.json with background color: ${validatedColor}`);
    } catch (initDataError) {
      console.error('Failed to update init_data.json:', initDataError);
      // Don't fail the entire operation if init_data.json update fails
    }

    // Notify all board windows with validated color
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('board-background-color-changed', validatedColor);
    });

    console.log(`Board background color set to: ${validatedColor}`);
    return { success: true, message: '背景色を適用しました' };
  } catch (error) {
    console.error('Failed to set background color:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Application initialization
 */
app.whenReady().then(async () => {
  console.log('App is ready, starting server...');

  // Start the server first
  await startServer();

  // Create menu
  createMenu();

  // Create tray icon
  createTray();

  // Check for first run
  const firstRun = isFirstRun();

  if (firstRun) {
    console.log('First run detected, showing welcome dialog and settings');

    // Open settings window first (after server is ready)
    createSettingsWindow();

    // Show welcome dialog after settings window loads
    setTimeout(() => {
      showWelcomeDialog();
      markFirstRunComplete();
    }, 1500);
  }

  // Create operation window
  createOperationWindow();

  // macOS specific behavior
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOperationWindow();
    }
  });
});

/**
 * Quit when all windows are closed (except on macOS)
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Clean up before quitting
 */
app.on('before-quit', () => {
  console.log('App is quitting, stopping server...');

  // Kill server process
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

/**
 * Handle quit event
 */
app.on('quit', () => {
  console.log('App has quit');
});

/**
 * Export functions for testing
 * Only export when not running as Electron app (for unit tests)
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateFilePath,
    generateInitData,
    getInitDataPath,
    getCurrentGamePath,
    getBoardSettingsPath,
  };
}
