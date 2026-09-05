const { app, BrowserWindow, shell, ipcMain, nativeTheme } = require('electron');
const path = require('path');

// Enable experimental SQLite in Electron's Node runtime
try {
  app.commandLine.appendSwitch('js-flags', '--experimental-sqlite');
} catch (e) {
  // ignored
}

let mainWindow;

const PORT = process.env.PORT || 3050;
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// Theme palettes matching Cortex Design System tokens
const THEME_PALETTES = {
  dark: {
    barColor: '#131c2e',    // matches dark --bg-card (#131C2E)
    symbolColor: '#94a3b8', // matches dark --text-secondary (#94A3B8)
    bgColor: '#090d16',     // matches dark --bg-app (#090D16)
  },
  light: {
    barColor: '#ffffff',    // matches light --bg-card (#FFFFFF)
    symbolColor: '#475569', // matches light --text-secondary (#475569)
    bgColor: '#f8fafc',     // matches light --bg-app (#F8FAFC)
  },
};

async function startServer() {
  if (isDev) {
    // In dev mode, express server is started separately via npm run dev:server
    return;
  }
  // In production package, import compiled Express server
  try {
    require('../server/dist/index.js');
  } catch (err) {
    console.error('Failed to start internal server:', err);
  }
}

function createWindow() {
  // Determine initial palette from system or default to light/dark
  const initialIsDark = nativeTheme.shouldUseDarkColors;
  const initialPalette = initialIsDark ? THEME_PALETTES.dark : THEME_PALETTES.light;

  mainWindow = new BrowserWindow({
    width: 1520,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: initialPalette.bgColor,
    title: 'Cortex - Antigravity Conversation Tracker',
    icon: path.join(__dirname, '../client/public/favicon.png'),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: initialPalette.barColor,
      symbolColor: initialPalette.symbolColor,
      height: 52, // Matched to exact .hud-top-header height (52px)
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const targetUrl = isDev
    ? (process.env.VITE_DEV_URL || 'http://127.0.0.1:5200')
    : `http://127.0.0.1:${PORT}`;

  mainWindow.loadURL(targetUrl);

  // In dev, open devtools on F12 or shortcut if desired, retry if loading
  mainWindow.webContents.on('did-fail-load', () => {
    console.log(`Failed to load ${targetUrl}, retrying in 1s...`);
    setTimeout(() => {
      if (mainWindow) mainWindow.loadURL(targetUrl);
    }, 1000);
  });

  // Open external links (docs, git) in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Synchronize native window title bar controls with active theme (Light & Dark)
ipcMain.on('update-titlebar-theme', (event, isDark) => {
  const palette = isDark ? THEME_PALETTES.dark : THEME_PALETTES.light;
  if (mainWindow) {
    try {
      if (typeof mainWindow.setTitleBarOverlay === 'function') {
        mainWindow.setTitleBarOverlay({
          color: palette.barColor,
          symbolColor: palette.symbolColor,
          height: 52,
        });
      }
      if (typeof mainWindow.setBackgroundColor === 'function') {
        mainWindow.setBackgroundColor(palette.bgColor);
      }
    } catch (e) {
      // Ignored if platform doesn't support
    }
  }
});

app.whenReady().then(async () => {
  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
