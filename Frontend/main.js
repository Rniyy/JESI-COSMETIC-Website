const { app, BrowserWindow } = require('electron');

function createWindow() {
const win = new BrowserWindow({
  width: 1200,
  height: 800,
  fullscreenable: true,
  minimizable: true,
  frame: true
});

  win.loadURL('https://jesi-cosmetic-website.onrender.com');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});