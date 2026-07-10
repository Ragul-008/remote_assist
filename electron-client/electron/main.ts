import { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog } from 'electron'
import path from 'node:path'
import { autoUpdater } from 'electron-updater'

// Bypass Vite bundler for native module
const nutjs = require(String('@nut-tree-fork/nut-js'))
const { mouse, Point, keyboard, Key, screen } = nutjs

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
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
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    handleDeepLink(commandLine)
  })

  app.on('window-all-closed', () => {
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
      setTimeout(() => {
        handleDeepLink(process.argv)
        
        // Custom filename parsing for dynamic downloads (Zip extraction folder or Portable EXE)
        const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
        const match = exePath.match(/RemoteAssist_Session_(\d+)/i);
        if (match && win) {
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
            // Yes, Allow
            win.hide(); // Hide the frontend UI completely
            win.webContents.send('handle-deep-link', { sessionId, name: 'Customer' });
          } else {
            // No, Cancel
            app.quit();
          }
        }
      }, 1500) // Delay to ensure React is loaded
    }

  // Check for updates
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-downloaded', () => {
      autoUpdater.quitAndInstall()
    })
  }

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

  // Handle remote control commands
  ipcMain.on('remote-control', async (event, data) => {
    try {
      if (data.action === 'click' || data.action === 'rightclick') {
        const screenWidth = await screen.width()
        const screenHeight = await screen.height()
        
        // Calculate absolute position based on relative coordinates from frontend
        const absoluteX = Math.max(0, Math.min(screenWidth, data.relativeX * screenWidth))
        const absoluteY = Math.max(0, Math.min(screenHeight, data.relativeY * screenHeight))
        
        await mouse.setPosition(new Point(absoluteX, absoluteY))
        
        if (data.action === 'click') {
          await mouse.leftClick()
        } else {
          await mouse.rightClick()
        }
      } else if (data.action === 'keydown') {
        const key = data.key
        if (key.length === 1 && key !== ' ') {
          await keyboard.type(key)
        } else {
          // Map special keys
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
