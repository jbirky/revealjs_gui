// Must be set before app is imported
process.env.ELECTRON_DISABLE_SANDBOX = '1'

const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('path')
const net = require('net')

app.commandLine.appendSwitch('no-sandbox')

let mainWindow
let serverInstance
let activePort

function getResourcePath(...parts) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts)
  }
  return path.join(__dirname, '..', ...parts)
}

function findFreePort(preferred) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => {
      // preferred is taken; let OS assign any free port
      const fallback = net.createServer()
      fallback.unref()
      fallback.listen(0, '127.0.0.1', () => {
        const port = fallback.address().port
        fallback.close(() => resolve(port))
      })
      fallback.on('error', reject)
    })
    server.listen(preferred, '127.0.0.1', () => {
      server.close(() => resolve(preferred))
    })
  })
}

async function startBackend() {
  const userData = app.getPath('userData')
  const dataDir = path.join(userData, 'data')
  const uploadsDir = path.join(userData, 'uploads')

  activePort = await findFreePort(3002)

  process.env.SLIDES_DATA_DIR = dataDir
  process.env.SLIDES_UPLOADS_DIR = uploadsDir
  process.env.NODE_ENV = 'production'
  process.env.PORT = String(activePort)

  const serverPath = getResourcePath('server', 'index.js')
  const { startServer } = require(serverPath)
  serverInstance = await startServer(activePort)

  console.log(`Backend started on port ${activePort}`)
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

  mainWindow.loadURL(`http://localhost:${activePort}`)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:') || url.startsWith(`http://localhost:${activePort}`)) {
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
