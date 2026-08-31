import { Tray, Menu, nativeImage, type BrowserWindow } from 'electron'

/**
 * Icône de zone de notification : clic gauche → afficher la fenêtre, menu
 * contextuel → ouvrir / quitter.
 */

export interface TrayDeps {
  iconPath: string
  getWindow: () => BrowserWindow | null
  onQuit: () => void
}

export function createTray(deps: TrayDeps): Tray {
  const image = nativeImage.createFromPath(deps.iconPath)
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('Hextech Client')

  const show = (): void => {
    const win = deps.getWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  tray.on('click', show)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Ouvrir Hextech Client', click: show },
      { type: 'separator' },
      { label: 'Quitter', click: deps.onQuit },
    ]),
  )

  return tray
}
