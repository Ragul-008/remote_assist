import { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog, screen as electronScreen } from 'electron'
import path from 'node:path'
import { exec, execSync, spawn } from 'node:child_process'
import { autoUpdater } from 'electron-updater'

// Check if running as administrator on Windows
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

// Safely manage Windows UAC Secure Desktop policy for IT Remote Support
function setUACSecureDesktop(enableSecureDesktop: boolean) {
  if (process.platform !== 'win32' || !isRunningAsAdmin()) return;
  const value = enableSecureDesktop ? 1 : 0;
  // 0 = Show UAC on normal desktop (visible to IT support stream)
  // 1 = Show UAC on isolated Secure Desktop (Windows default)
  exec(`reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v PromptOnSecureDesktop /t REG_DWORD /d ${value} /f`, (err) => {
    if (err) {
      console.warn('Could not update PromptOnSecureDesktop policy (requires Admin):', err.message);
    } else {
      console.log(`PromptOnSecureDesktop policy updated to: ${value} (SecureDesktop: ${enableSecureDesktop})`);
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

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(VITE_PUBLIC, 'electron-vite.svg'),
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // CRITICAL: Prevent WebRTC/WebSocket throttling when window is hidden
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(DIST, 'index.html'))
    win.webContents.openDevTools() // Open DevTools to debug white screen
  }
}

function handleDeepLink(argv: string[]) {
  const url = argv.find(arg => arg.startsWith('remoteassist://'));
  if (url && win) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === 'join') {
        const sessionId = parsedUrl.searchParams.get('sessionId');
        const name = parsedUrl.searchParams.get('name');
        if (sessionId && name) {
          win.webContents.send('handle-deep-link', { sessionId, name });
        }
      }
    } catch (e) {
      console.error('Failed to parse deep link', e);
    }
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine, _workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    handleDeepLink(commandLine)

    // If the old invisible app is running, and the user downloads and runs a NEW exe, handle the new filename
    const exePath = commandLine.find(arg => arg.includes('RemoteAssist_Session_'));
    if (exePath && win) {
      const match = exePath.match(/RemoteAssist_Session_(\d+)/i);
      if (match) {
        const sessionId = match[1];
        
        // Present native prompt
        const response = dialog.showMessageBoxSync(win, {
          type: 'question',
          buttons: ['Yes, Allow', 'No, Cancel'],
          title: 'RemoteAssist Request',
          message: 'The technician is requesting permission to view and control your screen. Do you want to allow this?',
          defaultId: 0,
          cancelId: 1
        });

        if (response === 0) {
          win.hide();
          setUACSecureDesktop(false); // Enable technician UAC visibility
          win.webContents.send('handle-deep-link', { sessionId, name: 'Customer' });
        } else {
          setUACSecureDesktop(true);
          app.quit();
        }
      }
    }
  })

  app.on('window-all-closed', () => {
    setUACSecureDesktop(true);
    if (process.platform !== 'darwin') {
      app.quit()
      win = null
    }
  })

  // macOS specific deep linking
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink([url]);
  })

  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient('remoteassist')
    createWindow()

    // Handle initial deep link and custom filename on Windows
    if (process.platform === 'win32') {
      // Instead of an arbitrary timeout, wait for React to tell us it's ready
      ipcMain.on('react-ready', () => {
        handleDeepLink(process.argv)
        
        // Custom filename parsing for dynamic downloads (Zip extraction folder or Portable EXE)
        const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
        const match = exePath.match(/RemoteAssist_Session_(\d+)/i);
        if (match && win) {
          const sessionId = match[1];
          
          // Small delay so UI doesn't visually flash before hiding
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
              win!.hide(); // Hide completely
              setUACSecureDesktop(false); // Enable technician UAC visibility
              win!.webContents.send('handle-deep-link', { sessionId, name: 'Customer' });
            } else {
              setUACSecureDesktop(true);
              app.quit();
            }
          }, 100);
        }
      });
    }

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
    setUACSecureDesktop(true); // Restore Windows default security
    app.quit()
  })

  // Convert customer window into a compact, always-on-top floating control widget
  ipcMain.on('set-floating-widget', () => {
    if (!win) return;
    try {
      const primaryDisplay = electronScreen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      const widgetWidth = 360;
      const widgetHeight = 68;

      win.setMinimumSize(widgetWidth, widgetHeight);
      win.setSize(widgetWidth, widgetHeight);
      win.setPosition(
        Math.round(width - widgetWidth - 20),
        Math.round(height - widgetHeight - 20)
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
  })

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
})
}
