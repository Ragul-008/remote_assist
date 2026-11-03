import { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog, screen as electronScreen, Menu } from 'electron'
import path from 'node:path'
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
const { mouse, Point, keyboard, Key, screen } = nutjs

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
    show: !isSessionLaunch,
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
    app.quit()
  })

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

  // Auto-approve screen sharing requests in Electron
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      // Automatically share the primary screen (first source)
      callback({ video: sources[0], audio: 'loopback' })
    }).catch(err => {
      console.error('Error getting sources:', err)
    })
  })

  // Handle desktop capturer for screen sharing
  ipcMain.handle('get-desktop-sources', async () => {
    return await desktopCapturer.getSources({ types: ['screen', 'window'] })
  })

  // Handle remote control commands with strict input sanitization
  ipcMain.on('remote-control', async (event, data) => {
    try {
      if (!data || typeof data !== 'object') return;

      if (data.action === 'click' || data.action === 'rightclick') {
        if (typeof data.relativeX !== 'number' || typeof data.relativeY !== 'number') return;
        if (isNaN(data.relativeX) || isNaN(data.relativeY)) return;

        // Strictly clamp coordinates between 0.0 and 1.0
        const clampedX = Math.max(0, Math.min(1, data.relativeX));
        const clampedY = Math.max(0, Math.min(1, data.relativeY));

        const screenWidth = await screen.width()
        const screenHeight = await screen.height()
        
        const absoluteX = Math.round(clampedX * screenWidth)
        const absoluteY = Math.round(clampedY * screenHeight)
        
        await mouse.setPosition(new Point(absoluteX, absoluteY))
        
        if (data.action === 'click') {
          await mouse.leftClick()
        } else {
          await mouse.rightClick()
        }
      } else if (data.action === 'keydown') {
        const key = data.key
        if (typeof key !== 'string' || key.length === 0 || key.length > 50) return;

        if (key.length === 1 && key !== ' ') {
          await keyboard.type(key)
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
          }
          if (keyMap[key]) {
            await keyboard.type(keyMap[key])
          }
        }
      }
    } catch (err) {
      console.error("Remote control error:", err)
    }
  })

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
      const safeUser = payload.username.replace(/'/g, "''");
      const safePass = payload.password.replace(/'/g, "''");

      console.log(`[ELEVATION] Validating credentials for user '${payload.username}'...`);
      win?.webContents.send('elevation-progress', 'Validating administrator credentials...');

      // 1. Validate credentials with a lightweight test scheduled task
      const testCmd = `schtasks /create /tn "RemoteAssistAuthTest" /tr "cmd.exe /c exit 0" /sc once /st 00:00 /ru '${safeUser}' /rp '${safePass}' /rl HIGHEST /f`;
      
      exec(`powershell.exe -NoProfile -WindowStyle Hidden -Command "${testCmd}"`, (err, _stdout, stderr) => {
        const errorMsg = (stderr || err?.message || '').toLowerCase();
        if (err || errorMsg.includes('error:') || errorMsg.includes('logon failure') || errorMsg.includes('access is denied')) {
          console.warn('[ELEVATION] Credential verification failed:', stderr || err?.message);
          try { execSync('schtasks /delete /tn "RemoteAssistAuthTest" /f', { stdio: 'ignore' }); } catch {}
          win?.webContents.send('elevation-failed', 'Invalid administrator credentials. Please check your username and password.');
          return;
        }

        // Clean up test task
        try { execSync('schtasks /delete /tn "RemoteAssistAuthTest" /f', { stdio: 'ignore' }); } catch {}

        console.log('[ELEVATION] Credentials verified! Relaunching RemoteAssist in Administrator mode...');
        win?.webContents.send('elevation-progress', 'Credentials verified! Switching to Administrator Mode...');

        // 2. Launch elevated app using verified credentials
        const launchScript = `
          $regCmd = 'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop /t REG_DWORD /d 0 /f';
          schtasks /create /tn "RemoteAssistPolicy" /tr "cmd.exe /c $regCmd" /sc once /st 00:00 /ru '${safeUser}' /rp '${safePass}' /rl HIGHEST /f;
          schtasks /run /tn "RemoteAssistPolicy";
          
          $targetExe = '${exePath.replace(/'/g, "''")}';
          $runCmd = "\`"$targetExe\`" --elevated-relaunch --session=${sessionCode}";
          schtasks /create /tn "RemoteAssistElevateApp" /tr $runCmd /sc once /st 00:00 /ru '${safeUser}' /rp '${safePass}' /rl HIGHEST /f;
          schtasks /run /tn "RemoteAssistElevateApp";
          
          Start-Sleep -Milliseconds 2500;
          schtasks /delete /tn "RemoteAssistPolicy" /f;
          schtasks /delete /tn "RemoteAssistElevateApp" /f;
        `.trim();

        spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', launchScript]);
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
      win.focus();
    }

    const sessionInfo = parseSessionLaunchInfo(commandLine);
    if (sessionInfo && win) {
      win.webContents.send('handle-deep-link', sessionInfo);
    }
  });

  app.on('window-all-closed', () => {
    restoreUACSecureDesktopSync();
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
          const isElevated = process.argv.includes('--elevated-relaunch');
          if (isElevated) {
            win.hide();
            setUACSecureDesktop(false);
            win.webContents.send('handle-deep-link', sessionInfo);
            return;
          }

          // Initial launch confirmation prompt for customer
          setTimeout(() => {
            const response = dialog.showMessageBoxSync(win!, {
              type: 'question',
              buttons: ['Yes, Allow', 'No, Cancel'],
              title: 'RemoteAssist Request',
              message: 'The technician is requesting permission to view and control your screen. Do you want to allow this?',
              defaultId: 0,
              cancelId: 1
            });

            if (response === 0) {
              win!.hide();
              setUACSecureDesktop(false);
              win!.webContents.send('handle-deep-link', sessionInfo);
            } else {
              setUACSecureDesktop(true);
              app.quit();
            }
          }, 100);
        }
      });
    }

    registerIpcAndAppHandlers();
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
