import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { IpcChannels } from '../shared/ipc'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#010a13',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'] as string)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerWindowControls(getWin: () => BrowserWindow | null): void {
  ipcMain.handle(IpcChannels.windowMinimize, () => {
    getWin()?.minimize()
  })
  ipcMain.handle(IpcChannels.windowToggleMaximize, () => {
    const w = getWin()
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.handle(IpcChannels.windowClose, () => {
    getWin()?.close()
  })
  ipcMain.handle(IpcChannels.windowIsMaximized, () => getWin()?.isMaximized() ?? false)
}

app.whenReady().then(() => {
  let win: BrowserWindow | null = createWindow()
  registerWindowControls(() => win)

  win.on('closed', () => {
    win = null
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      win = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
