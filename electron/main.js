// Must be set before app is imported
process.env.ELECTRON_DISABLE_SANDBOX = '1'

const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')

app.commandLine.appendSwitch('no-sandbox')

const PORT = 3002
let mainWindow
let serverInstance

function getResourcePath(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts)
  }
  return path.join(__dirname, '..', ...parts)
}

async function startBackend() {
  const userData = app.getPath('userData')
  const dataDir = path.join(userData, 'data')
  const uploadsDir = path.join(userData, 'uploads')

  // Set env vars before requiring the server
  process.env.SLIDES_DATA_DIR = dataDir
  process.env.SLIDES_UPLOADS_DIR = uploadsDir
  process.env.NODE_ENV = 'production'
  process.env.PORT = String(PORT)

  const serverPath = getResourcePath('server', 'index.js')
  const { startServer } = require(serverPath)
  serverInstance = await startServer(PORT)

  console.log(`Backend started on port ${PORT}`)
  console.log(`Data: ${dataDir}`)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Slides Editor',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)

  // Remove default menu bar (optional — keeps it clean)
  // mainWindow.setMenuBarVisibility(false)

  // Open external links in the default browser, allow new windows for present mode
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:') || url.startsWith(`http://localhost:${PORT}`)) {
      return { action: 'allow' }
    }
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    await startBackend()
    createWindow()
  } catch (err) {
    dialog.showErrorBox('Startup Error', `Failed to start: ${err.message}`)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close()
  }
})
