'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Primitives only. The File System Access shapes are built page-side in shim.js,
// because async iterators and handle objects do not survive the context bridge.
const call = (ch, args) => ipcRenderer.invoke(ch, args);

contextBridge.exposeInMainWorld('__sortNative', {
  platform : process.platform,
  sep      : process.platform === 'win32' ? '\\' : '/',
  pick     : title             => call('pick',       { title }),
  list     : dir               => call('list',       { dir }),
  stat     : p                 => call('stat',       { p }),
  read     : (p, start, end)   => call('read',       { p, start, end }),
  mkdir    : dir               => call('mkdir',      { dir }),
  copy     : (from, to)        => call('copy',       { from, to }),
  write    : (to, bytes)       => call('writeBytes', { to, bytes }),
  rename   : (from, to)        => call('rename',     { from, to }),
  unlink   : p                 => call('unlink',     { p })
});
