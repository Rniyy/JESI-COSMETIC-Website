const { app, BrowserWindow } = require('electron'); // fixed

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 600,
    resizable: false,
    maximizable: false,  // fixed typo
    fullscreenable: false,
    frame: false,
    transparent: false,
    webPreferences: {
      contextIsolation: true,
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});