'use strict';
/* SORT desktop — a thin native shell.
   Every file operation goes through Node here, never through Chromium's
   File System Access API: iterating a picked directory hangs in Electron
   (electron/electron#45225), and that is SORT's main loop. */
const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');
const fsp  = fs.promises;

let win = null;

// the preload runs in its own process and reads this from the environment
process.env.SORT_VERSION = app.getVersion();

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 860, minWidth: 380, minHeight: 540,
    backgroundColor: '#f7f7f5',
    title: 'SORT',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // links go to the real browser, never to a second app window
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(
    process.platform === 'darwin'
      ? [{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]
      : [{ role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }]
  ));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

/* ---------------- file operations ---------------- */
const ok  = v => ({ ok: true, v });
const err = e => ({ ok: false, e: (e && e.message) || String(e) });

ipcMain.handle('version', async () => ok(app.getVersion()));

ipcMain.handle('pick', async (_e, { title }) => {
  const r = await dialog.showOpenDialog(win, {
    title: title || 'Choose a folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths.length) return ok(null);
  return ok(r.filePaths[0]);
});

ipcMain.handle('list', async (_e, { dir }) => {
  try {
    const ents = await fsp.readdir(dir, { withFileTypes: true });
    return ok(ents
      .filter(d => d.isFile() || d.isDirectory())
      .map(d => ({ name: d.name, kind: d.isDirectory() ? 'directory' : 'file' })));
  } catch (e) { return err(e); }
});

ipcMain.handle('stat', async (_e, { p }) => {
  try { const st = await fsp.stat(p);
    return ok({ size: st.size, mtime: st.mtimeMs, dir: st.isDirectory() });
  } catch (e) { return err(e); }
});

ipcMain.handle('read', async (_e, { p, start, end }) => {
  try {
    const fh = await fsp.open(p, 'r');
    try {
      const st = await fh.stat();
      const from = Math.max(0, Math.min(start | 0, st.size));
      const to   = Math.max(from, Math.min(end === undefined ? st.size : end, st.size));
      const buf  = Buffer.allocUnsafe(to - from);
      if (to > from) await fh.read(buf, 0, to - from, from);
      return ok(buf);
    } finally { await fh.close(); }
  } catch (e) { return err(e); }
});

ipcMain.handle('mkdir', async (_e, { dir }) => {
  try { await fsp.mkdir(dir, { recursive: true }); return ok(dir); } catch (e) { return err(e); }
});

ipcMain.handle('copy', async (_e, { from, to }) => {
  try { await fsp.copyFile(from, to); return ok(true); } catch (e) { return err(e); }
});

ipcMain.handle('writeBytes', async (_e, { to, bytes }) => {
  try { await fsp.writeFile(to, Buffer.from(bytes)); return ok(true); } catch (e) { return err(e); }
});

ipcMain.handle('rename', async (_e, { from, to }) => {
  try { await fsp.rename(from, to); return ok(true); }
  catch (e) {
    // different volume: rename cannot cross it, so fall back to copy + unlink
    if (e && e.code === 'EXDEV') {
      try { await fsp.copyFile(from, to); await fsp.unlink(from); return ok(true); }
      catch (e2) { return err(e2); }
    }
    return err(e);
  }
});

ipcMain.handle('unlink', async (_e, { p }) => {
  try { await fsp.unlink(p); return ok(true); } catch (e) { return err(e); }
});
