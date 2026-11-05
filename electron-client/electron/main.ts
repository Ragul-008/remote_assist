import { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog, screen as electronScreen, Menu, Tray, nativeImage, clipboard } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import https from 'node:https'
import http from 'node:http'
import { exec, execSync, spawn } from 'node:child_process'
import { autoUpdater } from 'electron-updater'

// Disable default menu bar across the entire application
Menu.setApplicationMenu(null);

// Check if running as administrator on Windows (High Integrity)
function isRunningAsAdmin(): boolean {
  if (process.platform !== 'win32') return true;
  try {
    // 'fsutil dirty query %systemdrive%' only succeeds with code 0 if run with Administrator privileges
    execSync('fsutil dirty query %systemdrive%', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if UAC elevation / visible desktop policy is active
function isUACElevationActive(): boolean {
  if (process.platform !== 'win32') return true;
  if (isRunningAsAdmin()) return true;
  try {
    const output = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop', { encoding: 'utf8' });
    if (output.includes('0x0')) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

// Safely manage Windows UAC Secure Desktop policy for IT Remote Support
function setUACSecureDesktop(enableSecureDesktop: boolean) {
  if (process.platform !== 'win32') return;
  const value = enableSecureDesktop ? 1 : 0;
  // 0 = Show UAC on normal desktop (visible to IT support stream)
  // 1 = Show UAC on isolated Secure Desktop (Windows default)
  exec(`reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop /t REG_DWORD /d ${value} /f`, (err) => {
    if (err) {
      console.warn('Could not update PromptOnSecureDesktop policy:', err.message);
    } else {
      console.log(`PromptOnSecureDesktop policy updated to: ${value} (SecureDesktop: ${enableSecureDesktop})`);
      win?.webContents.send('admin-status-changed', !enableSecureDesktop || isRunningAsAdmin());
    }
  });
}

function restoreUACSecureDesktopSync() {
  if (process.platform !== 'win32' || !isRunningAsAdmin()) return;
  try {
    execSync('reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop /t REG_DWORD /d 1 /f', { stdio: 'ignore' });
  } catch {
    // Ignore during shutdown
  }
}

// Ensure security policy is always synchronously restored on any shutdown or exit
app.on('before-quit', () => {
  restoreUACSecureDesktopSync();
});
app.on('will-quit', () => {
  restoreUACSecureDesktopSync();
});
process.on('exit', () => {
  restoreUACSecureDesktopSync();
});

// Bypass Vite bundler for native module
const nutjs = require(String('@nut-tree-fork/nut-js'))
const { mouse, Point, keyboard, Key, screen, Button } = nutjs
let selectedSourceId: string | null = null;

const DIST = path.join(__dirname, '../dist')
const VITE_PUBLIC = app.isPackaged ? DIST : path.join(DIST, '../public')

process.env.DIST = DIST
process.env.VITE_PUBLIC = VITE_PUBLIC

let win: BrowserWindow | null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// Helper to reliably extract session info from any launch method
function parseSessionLaunchInfo(argv: string[]): { sessionId: string; name: string } | null {
  // 1. Deep link protocol: remoteassist://join?sessionId=123&name=...
  const urlArg = argv.find(arg => arg.startsWith('remoteassist://'));
  if (urlArg) {
    try {
      const parsedUrl = new URL(urlArg);
      const sessionId = parsedUrl.searchParams.get('sessionId');
      const name = parsedUrl.searchParams.get('name') || 'Customer';
      if (sessionId) return { sessionId, name };
    } catch (e) {
      console.error('Failed to parse deep link URL:', e);
    }
  }

  // 2. Explicit command line argument: --session=123 or --session 123
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--session=')) {
      const sessionId = arg.split('=')[1];
      if (sessionId) return { sessionId, name: 'Customer' };
    }
    if (arg === '--session' && argv[i + 1]) {
      return { sessionId: argv[i + 1], name: 'Customer' };
    }
  }

  // 3. Dynamic filename: RemoteAssist_Session_123456.exe
  const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const match = exePath.match(/RemoteAssist_Session_(\d+)/i);
  if (match) {
    return { sessionId: match[1], name: 'Customer' };
  }

  return null;
}

interface UnattendedConfig {
  deviceKey: string;
  deviceName: string;
  group: string;
  autoStart: boolean;
}

let unattendedConfig: UnattendedConfig | null = null;
let appTray: Tray | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
const isUnattendedLaunch = process.argv.includes('--unattended') || process.argv.includes('--unattended-service');
let privacyWindows: BrowserWindow[] = [];

function apiPost(endpoint: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const rawApiUrl = process.env.VITE_API_URL || 'https://remote-assist-y8ot.onrender.com/api';
    try {
      const parsed = new URL(`${rawApiUrl.replace(/\/$/, '')}${endpoint}`);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;

      const postData = JSON.stringify(data);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.write(postData);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

function getUnattendedConfig(): UnattendedConfig {
  const configDir = app.getPath('userData');
  const configFile = path.join(configDir, 'unattended-config.json');

  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch {}
  }

  const newConfig: UnattendedConfig = {
    deviceKey: 'dev_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    deviceName: os.hostname(),
    group: 'Default',
    autoStart: true
  };

  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write unattended config:', err);
  }
  return newConfig;
}

function updateUnattendedConfig(updates: Partial<UnattendedConfig>) {
  const configDir = app.getPath('userData');
  const configFile = path.join(configDir, 'unattended-config.json');
  unattendedConfig = { ...(unattendedConfig || getUnattendedConfig()), ...updates };
  try {
    fs.writeFileSync(configFile, JSON.stringify(unattendedConfig, null, 2), 'utf8');
  } catch {}
}

function setupTray() {
  if (appTray) return;
  unattendedConfig = getUnattendedConfig();

  const iconPath = path.join(VITE_PUBLIC, 'electron-vite.svg');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }

  appTray = new Tray(icon);
  appTray.setToolTip(`RemoteAssist Host - ${unattendedConfig.deviceName} (Online)`);

  const refreshMenu = () => {
    const menu = Menu.buildFromTemplate([
      { label: `🖥️ Computer: ${unattendedConfig?.deviceName}`, enabled: false },
      { label: `🔑 Device Key: ${unattendedConfig?.deviceKey.substring(0, 10)}...`, enabled: false },
      { label: `🟢 Status: Online & Ready`, enabled: false },
      { type: 'separator' },
      {
        label: 'Start with Windows (Unattended)',
        type: 'checkbox',
        checked: Boolean(unattendedConfig?.autoStart),
        click: (item) => {
          updateUnattendedConfig({ autoStart: item.checked });
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            args: ['--unattended']
          });
        }
      },
      {
        label: 'Copy Device Key',
        click: () => {
          if (unattendedConfig?.deviceKey) {
            clipboard.writeText(unattendedConfig.deviceKey);
            dialog.showMessageBox({ message: 'Device key copied to clipboard!', title: 'RemoteAssist' });
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Open RemoteAssist Window',
        click: () => {
          if (win) {
            win.show();
            win.focus();
          }
        }
      },
      {
        label: 'Quit Host Service',
        click: () => {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          app.quit();
        }
      }
    ]);
    appTray?.setContextMenu(menu);
  };

  refreshMenu();
}

function startUnattendedService() {
  unattendedConfig = getUnattendedConfig();

  if (unattendedConfig.autoStart) {
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        args: ['--unattended']
      });
    } catch {}
  }

  // Initial registration with backend
  apiPost('/devices/register', {
    device_key: unattendedConfig.deviceKey,
    name: unattendedConfig.deviceName,
    hostname: os.hostname(),
    os_info: `${os.type()} ${os.release()} (${os.arch()})`,
    platform: process.platform,
    group: unattendedConfig.group,
    system_info: {
      cpus: os.cpus().length,
      memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      uptime_hours: Math.round(os.uptime() / 3600)
    }
  }).catch(() => {});

  // Polling heartbeat every 8 seconds
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    if (!unattendedConfig) return;
    try {
      const res = await apiPost(`/devices/${unattendedConfig.deviceKey}/heartbeat`, {
        device_key: unattendedConfig.deviceKey,
        system_info: {
          uptime_hours: Math.round(os.uptime() / 3600),
          free_mem_gb: Math.round(os.freemem() / (1024 * 1024 * 1024))
        }
      });

      if (res && res.active_session_code) {
        console.log(`[UNATTENDED DAEMON] Incoming technician connection! Session: ${res.active_session_code}`);
        setUACSecureDesktop(false);
        if (win) {
          win.webContents.send('handle-deep-link', {
            sessionId: res.active_session_code,
            name: unattendedConfig.deviceName
          });
        }
      }
    } catch {}
  }, 8000);
}

function createWindow() {
  const sessionInfo = parseSessionLaunchInfo(process.argv);
  const isSessionLaunch = Boolean(sessionInfo) || process.argv.includes('--elevated-relaunch');

  win = new BrowserWindow({
    icon: path.join(VITE_PUBLIC, 'electron-vite.svg'),
    title: 'RemoteAssist',
    width: isSessionLaunch ? 380 : 800,
    height: isSessionLaunch ? 72 : 600,
    frame: !isSessionLaunch,
    transparent: isSessionLaunch,
    hasShadow: !isSessionLaunch,
    autoHideMenuBar: true,
    show: !isUnattendedLaunch, // If running as unattended host, start silently in background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // CRITICAL: Prevent WebRTC/WebSocket throttling when window is hidden
    },
  });

  win.removeMenu();
  win.setMenuBarVisibility(false);

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(DIST, 'index.html'))
  }
}

function registerIpcAndAppHandlers() {
  // Check for updates
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-downloaded', () => {
      autoUpdater.quitAndInstall()
    })
  }

  // Handle session active toggle from frontend
  ipcMain.on('session-active', (_event, isActive: boolean) => {
    setUACSecureDesktop(!isActive);
  })

  // Handle explicit quit from frontend (when session ends)
  ipcMain.on('quit-app', () => {
    restoreUACSecureDesktopSync(); // Restore Windows default security
    privacyWindows.forEach(w => { try { w.destroy(); } catch {} });
    privacyWindows = [];

    if (isUnattendedLaunch || (unattendedConfig && unattendedConfig.autoStart)) {
      // In unattended mode, hide window and stay active in system tray
      win?.hide();
    } else {
      app.quit();
    }
  });

  // Zoho Assist Privacy Screen (Screen Blanking)
  ipcMain.on('set-privacy-curtain', (_event, enabled: boolean) => {
    if (enabled) {
      if (privacyWindows.length > 0) return;
      const displays = electronScreen.getAllDisplays();
      privacyWindows = displays.map(d => {
        const pw = new BrowserWindow({
          x: d.bounds.x,
          y: d.bounds.y,
          width: d.bounds.width,
          height: d.bounds.height,
          frame: false,
          transparent: false,
          backgroundColor: '#000000',
          alwaysOnTop: true,
          skipTaskbar: true,
          focusable: false,
        });
        pw.loadURL('data:text/html,<body style="background:#0a0a0c;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;"><div style="text-align:center;"><h2 style="color:#aaa;">Remote Maintenance In Progress</h2><p>An IT Technician is servicing this computer securely.</p></div></body>');
        return pw;
      });
    } else {
      privacyWindows.forEach(w => {
        try { w.destroy(); } catch {}
      });
      privacyWindows = [];
    }
  });

  // Unattended Configuration IPC handlers
  ipcMain.handle('get-unattended-config', () => getUnattendedConfig());
  ipcMain.handle('update-unattended-config', (_event, updates) => {
    updateUnattendedConfig(updates);
    return getUnattendedConfig();
  });

  // Convert customer window into a compact, always-on-top floating control widget
  ipcMain.on('set-floating-widget', () => {
    if (!win) return;
    try {
      const primaryDisplay = electronScreen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      const widgetWidth = 380;
      const widgetHeight = 72;

      win.removeMenu();
      win.setMenuBarVisibility(false);
      win.setMinimumSize(widgetWidth, widgetHeight);
      win.setContentSize(widgetWidth, widgetHeight);
      win.setPosition(
        Math.round(width - widgetWidth - 24),
        Math.round(height - widgetHeight - 24)
      );
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setResizable(false);
      win.setMaximizable(false);
      win.setMinimizable(false);
      win.show();
      win.focus();
    } catch (err) {
      console.error('Failed to configure floating widget:', err);
      win?.show();
    }
  });

  // Query administrator privilege status
  ipcMain.handle('is-admin', () => {
    return isRunningAsAdmin() || isUACElevationActive();
  });

  // Multi-monitor screen listing
  ipcMain.handle('get-available-screens', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources.map((s, idx) => ({
      id: s.id,
      name: s.name || `Screen ${idx + 1}`,
      display_id: s.display_id,
    }));
  });

  ipcMain.on('select-screen-source', (_event, sourceId: string) => {
    selectedSourceId = sourceId;
    win?.webContents.send('screen-source-changed', sourceId);
  });

  // Auto-approve screen sharing requests in Electron
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      let chosen = sources[0];
      if (selectedSourceId) {
        const match = sources.find(s => s.id === selectedSourceId);
        if (match) chosen = match;
      }
      callback({ video: chosen, audio: 'loopback' });
    }).catch(err => {
      console.error('Error getting sources:', err);
    });
  });

  // Handle desktop capturer for screen sharing
  ipcMain.handle('get-desktop-sources', async () => {
    return await desktopCapturer.getSources({ types: ['screen', 'window'] });
  });

  // Native file transfer writer to customer Downloads directory
  ipcMain.handle('save-file-transfer', async (_event, fileInfo: { name: string; buffer: string; encoding?: string }) => {
    try {
      const downloadsDir = app.getPath('downloads');
      let targetPath = path.join(downloadsDir, fileInfo.name);
      let counter = 1;
      const ext = path.extname(fileInfo.name);
      const base = path.basename(fileInfo.name, ext);

      while (fs.existsSync(targetPath)) {
        targetPath = path.join(downloadsDir, `${base} (${counter})${ext}`);
        counter++;
      }

      const fileBuffer = Buffer.from(fileInfo.buffer, 'base64');
      fs.writeFileSync(targetPath, fileBuffer);
      return { success: true, path: targetPath, filename: path.basename(targetPath) };
    } catch (err: any) {
      console.error('File save error:', err);
      return { success: false, error: err.message };
    }
  });

  // Handle remote control commands with full mouse, keyboard, and gesture simulation
  ipcMain.on('remote-control', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') return;

      const screenWidth = await screen.width();
      const screenHeight = await screen.height();

      const getAbsoluteCoords = (rx: number, ry: number) => {
        const clampedX = Math.max(0, Math.min(1, rx));
        const clampedY = Math.max(0, Math.min(1, ry));
        return {
          x: Math.round(clampedX * screenWidth),
          y: Math.round(clampedY * screenHeight)
        };
      };

      if (['click', 'rightclick', 'doubleclick', 'mousedown', 'mouseup', 'mousemove'].includes(data.action)) {
        if (typeof data.relativeX === 'number' && typeof data.relativeY === 'number') {
          const { x, y } = getAbsoluteCoords(data.relativeX, data.relativeY);
          await mouse.setPosition(new Point(x, y));
        }

        if (data.action === 'click') {
          await mouse.leftClick();
        } else if (data.action === 'rightclick') {
          await mouse.rightClick();
        } else if (data.action === 'doubleclick') {
          await mouse.leftClick();
          await mouse.leftClick();
        } else if (data.action === 'mousedown') {
          await mouse.pressButton(Button.LEFT);
        } else if (data.action === 'mouseup') {
          await mouse.releaseButton(Button.LEFT);
        }
      } else if (data.action === 'scroll') {
        const delta = Number(data.deltaY) || 0;
        const scrollTicks = Math.min(5, Math.max(1, Math.round(Math.abs(delta) / 40)));
        if (delta > 0) {
          await mouse.scrollDown(scrollTicks);
        } else {
          await mouse.scrollUp(scrollTicks);
        }
      } else if (data.action === 'cad') {
        // Zoho Assist Ctrl+Alt+Del handler: Open Windows Security / Task Manager
        exec('start taskmgr.exe');
      } else if (data.action === 'hotkey' && Array.isArray(data.keys)) {
        const _keyMap: Record<string, any> = {
          'Control': Key.LeftControl,
          'Ctrl': Key.LeftControl,
          'Shift': Key.LeftShift,
          'Alt': Key.LeftAlt,
          'Meta': Key.LeftSuper,
          'Win': Key.LeftSuper,
          'Tab': Key.Tab,
          'Escape': Key.Escape,
          'Esc': Key.Escape,
          'Enter': Key.Enter,
          'Backspace': Key.Backspace,
          'Delete': Key.Delete,
        };

        // For simple combos like Ctrl+C, Ctrl+V, Win+R
        if (data.keys.length === 2 && (data.keys[0] === 'Control' || data.keys[0] === 'Ctrl')) {
          const secondKey = data.keys[1].toLowerCase();
          if (secondKey === 'c') {
            await keyboard.pressKey(Key.LeftControl, Key.C);
            await keyboard.releaseKey(Key.LeftControl, Key.C);
          } else if (secondKey === 'v') {
            await keyboard.pressKey(Key.LeftControl, Key.V);
            await keyboard.releaseKey(Key.LeftControl, Key.V);
          } else if (secondKey === 'a') {
            await keyboard.pressKey(Key.LeftControl, Key.A);
            await keyboard.releaseKey(Key.LeftControl, Key.A);
          }
        }
      } else if (data.action === 'keydown') {
        const key = data.key;
        if (typeof key !== 'string' || key.length === 0 || key.length > 50) return;

        if (key.length === 1 && key !== ' ') {
          await keyboard.type(key);
        } else {
          // Map special keys safely
          const keyMap: Record<string, any> = {
            'Enter': Key.Enter,
            'Backspace': Key.Backspace,
            'Delete': Key.Delete,
            'Escape': Key.Escape,
            'Tab': Key.Tab,
            'ArrowUp': Key.Up,
            'ArrowDown': Key.Down,
            'ArrowLeft': Key.Left,
            'ArrowRight': Key.Right,
            ' ': Key.Space,
            'Home': Key.Home,
            'End': Key.End,
            'PageUp': Key.PageUp,
            'PageDown': Key.PageDown,
          };
          if (keyMap[key]) {
            await keyboard.type(keyMap[key]);
          }
        }
      }
    } catch (err) {
      console.error("Remote control error:", err);
    }
  });

  // Zoho Assist-grade seamless session elevation
  ipcMain.on('elevate-session', (_event, payload: { mode: 'credentials' | 'prompt', username?: string, password?: string, sessionCode?: string }) => {
    if (process.platform !== 'win32') return;

    const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    const sessionCode = payload?.sessionCode || '';
    if (!sessionCode) {
      console.error('[ELEVATION] No sessionCode provided for elevation');
      return;
    }

    // Set registry policy so Secure Desktop doesn't black out screen during elevation
    setUACSecureDesktop(false);

    if (payload?.mode === 'credentials' && payload.username && payload.password) {
      let targetUser = payload.username.trim();
      // If user typed a plain username without domain or dot, suggest local machine format .\user
      if (!targetUser.includes('\\') && !targetUser.includes('@')) {
        targetUser = `.\\${targetUser}`;
      }

      console.log(`[ELEVATION] Validating credentials for user '${targetUser}'...`);
      win?.webContents.send('elevation-progress', 'Validating administrator credentials...');

      // Run schtasks directly to prevent PowerShell variable expansion of $ in passwords
      const authChild = spawn('schtasks.exe', [
        '/create',
        '/tn', 'RemoteAssistAuthTest',
        '/tr', 'whoami.exe',
        '/sc', 'once',
        '/st', '00:00',
        '/ru', targetUser,
        '/rp', payload.password,
        '/rl', 'HIGHEST',
        '/f'
      ], { windowsHide: true });

      let stderr = '';
      let stdout = '';
      authChild.stdout?.on('data', (d) => { stdout += d.toString(); });
      authChild.stderr?.on('data', (d) => { stderr += d.toString(); });

      authChild.on('close', (code) => {
        const fullOutput = (stdout + ' ' + stderr).toLowerCase();
        if (code !== 0 || fullOutput.includes('error:') || fullOutput.includes('logon failure') || fullOutput.includes('access is denied')) {
          console.warn('[ELEVATION] Credential verification failed. Code:', code, 'Output:', fullOutput);
          try { execSync('schtasks /delete /tn "RemoteAssistAuthTest" /f', { stdio: 'ignore' }); } catch {}

          if (fullOutput.includes('network address is invalid') || payload.username.toLowerCase().includes('azuread') || payload.username.includes('@')) {
            win?.webContents.send('elevation-failed', 'Windows Task Scheduler cannot authenticate Azure AD / Office 365 accounts with passwords. Please select "Prompt Customer for UAC Consent" above to elevate via Windows native UAC.');
          } else if (fullOutput.includes('access is denied')) {
            win?.webContents.send('elevation-failed', 'Standard user permissions block creating elevated tasks. Please select "Prompt Customer for UAC Consent" above.');
          } else {
            win?.webContents.send('elevation-failed', 'Invalid administrator credentials. For local admin, use format .\\Username. If using Azure AD / Office 365, select "Prompt Customer for UAC Consent".');
          }
          return;
        }

        // Clean up test task
        try { execSync('schtasks /delete /tn "RemoteAssistAuthTest" /f', { stdio: 'ignore' }); } catch {}

        console.log('[ELEVATION] Credentials verified! Relaunching RemoteAssist in Administrator mode...');
        win?.webContents.send('elevation-progress', 'Credentials verified! Switching to Administrator Mode...');

        // 2. Launch elevated app using a temporary wrapper batch file (bypasses Windows CLI quote parsing quirks)
        const launchBat = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `RemoteAssist_Elevate_${sessionCode}.cmd`);
        const batContent = `@echo off\r\nreg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop /t REG_DWORD /d 0 /f\r\nstart "" "${exePath}" --elevated-relaunch --session=${sessionCode}\r\n`;

        try {
          fs.writeFileSync(launchBat, batContent, { encoding: 'ascii' });
        } catch (e) {
          console.error('[ELEVATION] Failed to write launch script:', e);
        }

        const runElevateChild = spawn('schtasks.exe', [
          '/create',
          '/tn', 'RemoteAssistElevateApp',
          '/tr', `"${launchBat}"`,
          '/sc', 'once',
          '/st', '00:00',
          '/ru', targetUser,
          '/rp', payload.password,
          '/rl', 'HIGHEST',
          '/f'
        ], { windowsHide: true });

        runElevateChild.on('close', () => {
          exec('schtasks /run /tn "RemoteAssistElevateApp"', () => {
            setTimeout(() => {
              try { execSync('schtasks /delete /tn "RemoteAssistElevateApp" /f', { stdio: 'ignore' }); } catch {}
              try { fs.unlinkSync(launchBat); } catch {}
            }, 3000);
          });
        });
      });

    } else {
      // Mode: 'prompt' -> Prompt Customer for UAC Consent
      console.log(`[ELEVATION] Prompting customer for UAC consent for session ${sessionCode}...`);
      win?.webContents.send('elevation-progress', 'Prompting customer for Administrator consent...');

      const promptScript = `
        Start-Process -FilePath '${exePath.replace(/'/g, "''")}' -ArgumentList '--elevated-relaunch --session=${sessionCode}' -Verb RunAs;
      `.trim();

      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-WindowStyle', 'Hidden',
        '-Command',
        promptScript
      ]);

      child.on('close', (code) => {
        if (code !== 0) {
          console.warn('[ELEVATION] Customer rejected UAC prompt or launch failed. Code:', code);
          win?.webContents.send('elevation-failed', 'Customer declined the administrator elevation prompt.');
        }
      });
    }
  });
}

// -------------------------------------------------------------
// Application Lifecycle & Single Instance Lock Coordination
// -------------------------------------------------------------
const isElevatedRelaunch = process.argv.includes('--elevated-relaunch');

function startApplication() {
  app.on('second-instance', (_event, commandLine) => {
    // If an elevated instance has just been launched, the current unprivileged instance
    // must gracefully yield the lock and exit so the elevated instance takes over.
    if (commandLine.includes('--elevated-relaunch')) {
      console.log('[ELEVATION] Elevated child instance spawned. Releasing lock and exiting standard instance.');
      app.releaseSingleInstanceLock();
      if (win) {
        win.destroy();
        win = null;
      }
      app.exit(0);
      return;
    }

    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }

    const sessionInfo = parseSessionLaunchInfo(commandLine);
    if (sessionInfo && win) {
      win.webContents.send('handle-deep-link', sessionInfo);
    }
  });

  app.on('window-all-closed', () => {
    restoreUACSecureDesktopSync();
    if (isUnattendedLaunch || (unattendedConfig && unattendedConfig.autoStart)) {
      // In unattended mode, keep host running silently in the system tray
      return;
    }
    if (process.platform !== 'darwin') {
      app.quit();
      win = null;
    }
  });

  // macOS specific deep linking
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const sessionInfo = parseSessionLaunchInfo([url]);
    if (sessionInfo && win) {
      win.webContents.send('handle-deep-link', sessionInfo);
    }
  });

  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient('remoteassist');
    createWindow();

    if (process.platform === 'win32') {
      ipcMain.on('react-ready', () => {
        const sessionInfo = parseSessionLaunchInfo(process.argv);
        if (sessionInfo && win) {
          setUACSecureDesktop(false);
          win.webContents.send('handle-deep-link', sessionInfo);
        }
      });
    }

    registerIpcAndAppHandlers();
    setupTray();
    startUnattendedService();
  });
}

// Coordinate lock acquisition (wait for predecessor to yield if this is an elevated relaunch)
let gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock && isElevatedRelaunch) {
  // Polling lock acquisition: unprivileged instance received second-instance and is exiting
  let attempts = 0;
  const pollLock = setInterval(() => {
    attempts++;
    gotTheLock = app.requestSingleInstanceLock();
    if (gotTheLock) {
      clearInterval(pollLock);
      startApplication();
    } else if (attempts > 15) { // 15 * 200ms = 3000ms max wait
      clearInterval(pollLock);
      console.error('[ELEVATION] Timed out waiting to acquire single instance lock.');
      app.quit();
    }
  }, 200);
} else if (!gotTheLock) {
  app.quit();
} else {
  startApplication();
}
