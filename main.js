const { app, BrowserWindow, Menu, Tray, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const os = require('os');

// Development mode check
const isDev = process.env.NODE_ENV === 'development';

// Server configuration
const SERVER_PORT = 8080;
const SERVER_STARTUP_DELAY = 3000; // 3 seconds to ensure server is ready

// Global references to prevent garbage collection
let operationWindow = null;
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
  serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: isDev ? 'inherit' : 'ignore'
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
