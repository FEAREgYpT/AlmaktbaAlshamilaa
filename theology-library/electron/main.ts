import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import getPort from 'get-port';
import { startServer, stopServer } from '../server';
import { closeDb, initializeDb } from '../server/db/connection';

let mainWindow: BrowserWindow | null = null;
let localPort = 0;

function resolveRendererUrl(): string {
  if (!app.isPackaged) return `http://localhost:5173`;
  return `http://127.0.0.1:${localPort}`;
}

async function createWindow() {
  const userDataPath = app.getPath('userData');
  initializeDb(userDataPath);

  localPort = await getPort({ port: getPort.makeRange(5000, 6000) });
  await startServer(localPort, userDataPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ipcMain.handle('sth:get-api-base-url', () => `http://127.0.0.1:${localPort}/api`);
  await mainWindow.loadURL(resolveRendererUrl());

  mainWindow.on('closed', async () => {
    await stopServer();
    closeDb();
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  await stopServer();
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on('before-quit', async () => {
  await stopServer();
  closeDb();
});
