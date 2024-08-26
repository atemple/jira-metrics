const { app, BrowserWindow, nativeImage, ipcMain } = require('electron');

const path = require('path');

let window;

function createWindow () {
  window = new BrowserWindow({
    width: 800,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'), // Ensure the correct path here
      contextIsolation: false,
      nodeIntegration: true,
      enableRemoteModule: false,
      sandbox: false
    }
  });

  // Add icon
  const icon = nativeImage.createFromPath(`${app.getAppPath()}/build/icon.png`);

  if (app.dock) {
    app.dock.setIcon(icon);
  }

  // uncomment to debug
  // window.webContents.openDevTools();

  window.loadFile(path.join(__dirname, '../views/project.html')); 

  window.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  console.log('App is ready');
});

ipcMain.on('navigate', (event, fileName) => {
  window.loadFile(fileName);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
