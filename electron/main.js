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
    title: 'SORT by CDAV.IO',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  // the page's own <title> is written for search engines; the window keeps its name
  win.on('page-title-updated', e => e.preventDefault());
  win.setTitle('SORT by CDAV.IO');
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // links go to the real browser, never to a second app window
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// the copy the last update replaced, left behind on purpose until it is safe to go
function sweepOldBundle() {
  try {
    const here = bundlePath();
    if (here) fs.rmSync(here + '.old', { recursive: true, force: true });
  } catch (e) {}
}

app.whenReady().then(() => {
  sweepOldBundle();
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

// Not being there is an answer, not a failure: SORT asks about a folder
// before it creates one, and about a file to find out whether a name clashes.
ipcMain.handle('stat', async (_e, { p }) => {
  try { const st = await fsp.stat(p);
    return ok({ size: st.size, mtime: st.mtimeMs, dir: st.isDirectory() });
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return ok(null);
    return err(e);
  }
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

/* ---------------- updating itself ----------------
   The old bar sent people to the GitHub releases page and left them there.
   Most never worked out what to do with a .dmg. Now SORT fetches the right
   file itself, shows the progress, and puts the new version in place. */
const { spawn, execFileSync } = require('child_process');

function tmpDir() {
  const d = path.join(app.getPath('temp'), 'sort-update');
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
  return d;
}

// Chromium's stack, so it follows GitHub's redirect to the CDN and honours any proxy
function fetchToFile(url, dest, onProgress) {
  const { net } = require('electron');
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (e, v) => { if (done) return; done = true; clearTimeout(stall); e ? reject(e) : resolve(v); };

    // a download that goes quiet forever used to leave the bar stuck at nothing
    let stall = setTimeout(() => finish(new Error('the download stopped responding')), 60000);
    const alive = () => { clearTimeout(stall); stall = setTimeout(() => finish(new Error('the download stopped responding')), 60000); };

    const req = net.request({ url, redirect: 'follow' });
    req.on('response', res => {
      if (res.statusCode >= 400) { finish(new Error('the server answered ' + res.statusCode)); return; }
      const total = parseInt(res.headers['content-length'] || res.headers['Content-Length'] || 0, 10) || 0;
      let got = 0, last = 0;

      const out = fs.createWriteStream(dest);
      // without this the stream throws where nothing is listening and the
      // promise never settles, which looks exactly like a frozen button
      out.on('error', e => { try { res.destroy(); } catch (x) {} finish(e); });

      res.on('data', c => {
        alive();
        got += c.length;
        if (!out.write(c)) { try { res.pause(); out.once('drain', () => { try { res.resume(); } catch (x) {} }); } catch (x) {} }
        const now = Date.now();
        if (onProgress && (now - last > 120 || got === total)) { last = now; onProgress(got, total); }
      });
      res.on('end',   () => out.end(() => {
        if (total && got < total) { finish(new Error('the download was cut short')); return; }
        finish(null, dest);
      }));
      res.on('error', e => { out.destroy(); finish(e); });
    });
    req.on('error', finish);
    req.end();
  });
}

ipcMain.handle('updateDownload', async (_e, { url, name }) => {
  try {
    const dest = path.join(tmpDir(), name || 'SORT-update');
    try { fs.unlinkSync(dest); } catch (e) {}
    await fetchToFile(url, dest, (got, total) => {
      if (win && !win.isDestroyed()) win.webContents.send('updateProgress', { got, total });
    });
    return ok(dest);
  } catch (e) { return err(e); }
});

// /Applications/SORT.app/Contents/MacOS/SORT  ->  /Applications/SORT.app
function bundlePath() {
  const p = path.resolve(app.getPath('exe'), '..', '..', '..');
  return p.endsWith('.app') ? p : null;
}

function installMac(dmg) {
  // no -quiet here: the mount point is the last tab-separated field it prints
  const out = execFileSync('hdiutil', ['attach', '-nobrowse', '-noautoopen', dmg]).toString();
  const mount = out.split('\n').map(l => l.split('\t').pop().trim())
                   .filter(l => l.indexOf('/Volumes/') === 0).pop();
  if (!mount) throw new Error('the disk image did not mount');
  try {
    const src = path.join(mount, 'SORT.app');
    if (!fs.existsSync(src)) throw new Error('no SORT.app inside the disk image');
    const here = bundlePath();
    if (!here) throw new Error('SORT is not running from an app bundle');

    const staged = here + '.new', old = here + '.old';
    try { fs.rmSync(staged, { recursive: true, force: true }); } catch (e) {}
    execFileSync('ditto', [src, staged]);
    // the copy arrives quarantined, which is what makes macOS call it damaged
    try { execFileSync('xattr', ['-dr', 'com.apple.quarantine', staged]); } catch (e) {}

    try { fs.rmSync(old, { recursive: true, force: true }); } catch (e) {}
    fs.renameSync(here, old);                 // allowed while running: the inode stays open
    try { fs.renameSync(staged, here); }
    catch (e) { fs.renameSync(old, here); throw e; }   // put the working copy back
    // the old bundle is still mapped into this process: clearing it now can kill
    // us before the relaunch, so it waits for the next start
  } finally {
    try { execFileSync('hdiutil', ['detach', mount, '-quiet']); } catch (e) {}
  }
}

ipcMain.handle('updateInstall', async (_e, { file }) => {
  try {
    // a truncated or missing file is not an installer, whatever its name says
    let size = 0;
    try { size = fs.statSync(file).size; } catch (e) {}
    if (size < 1024 * 1024) return { ok: false, e: 'the downloaded file is not complete' };

    if (process.platform === 'darwin') {
      try {
        installMac(file);
        app.relaunch(); setTimeout(() => app.exit(0), 200);
        return ok('relaunch');
      } catch (e) {
        // no write permission, a locked folder, an unexpected image: hand over the .dmg
        await shell.openPath(file);
        return { ok: true, v: 'opened', why: (e && e.message) || String(e) };
      }
    }

    if (process.platform === 'win32') {
      try {
        // the arguments electron-updater uses: install without questions, then start SORT again
        const child = spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' });
        let failed = null;
        child.on('error', e => { failed = e; });
        child.unref();
        await new Promise(r => setTimeout(r, 400));     // long enough for a spawn error to arrive
        if (failed) throw failed;
        setTimeout(() => app.exit(0), 600);
        return ok('relaunch');
      } catch (e) {
        await shell.openPath(file);
        return { ok: true, v: 'opened', why: (e && e.message) || String(e) };
      }
    }

    await shell.openPath(file);
    return ok('opened');
  } catch (e) { return err(e); }
});
