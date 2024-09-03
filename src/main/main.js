const { app, BrowserWindow, nativeImage, ipcMain } = require('electron');

const fs = require('fs');
const path = require('path');

require('dotenv').config(); // Load environment variables from .env

let window;
let config = {}; // Global config object to hold current configuration

function createWindow () {
  loadConfig();

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

  // Send config to renderer process
  window.webContents.on('did-finish-load', () => {
    window.webContents.send('load-config', config);
  });

  window.on('closed', () => {
    window = null;
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

// Load existing config into memory
function loadConfig() {
  const configFilePath = path.join(app.getPath('userData'), 'config.json');
  if (fs.existsSync(configFilePath)) {
      const configData = fs.readFileSync(configFilePath);
      config = JSON.parse(configData); // Load into global config object
  } else {
      // Initialize with .env defaults
      config = {
        jiraApiToken: process.env.JIRA_API_TOKEN || '',
        jiraEmail: process.env.JIRA_EMAIL || '',
        jiraBaseDomain: process.env.JIRA_BASE_URL || '',
        jiraProjectKeys: process.env.JIRA_PROJECT_KEYS || ''
    };
    saveConfig(config); // Save the default config to config.json
  }
}

// Save the config object to config.json
function saveConfig(config) {
  const configFilePath = path.join(app.getPath('userData'), 'config.json');
  fs.writeFileSync(configFilePath, JSON.stringify(config), (err) => {
      if (err) {
          console.error('Failed to save config:', err);
      } else {
          console.log('Config saved successfully');
      }
  });
}

// Listen for 'save-config' events from the renderer
ipcMain.on('save-config', (event, newConfig) => {
  const configFilePath = path.join(app.getPath('userData'), 'config.json');

  // Update the global config object
  config = { ...config, ...newConfig };

  // Save the updated config to a file
  saveConfig(config);

  // Optionally, send a response back to the renderer to confirm save
  event.sender.send('config-saved', config);
});