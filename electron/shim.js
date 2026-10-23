'use strict';
/* Implements the slice of the File System Access API that SORT uses, backed by
   Node in the main process. Loaded before the app script, so HAS_FSA is true
   and every existing code path works unchanged. */
(function () {
  const N = window.__sortNative;
  if (!N) return;                       // plain browser: leave the real API alone

  const SEP = N.sep || (N.platform === 'win32' ? '\\' : '/');
  const join = (a, b) => a.endsWith(SEP) ? a + b : a + SEP + b;
  const base = p => { const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i < 0 ? p : p.slice(i + 1); };

  const unwrap = r => { if (!r || !r.ok) { const e = new Error(r ? r.e : 'native call failed'); e.name = 'NativeError'; throw e; } return r.v; };
  const notFound = p => { const e = new Error('No entry at ' + p); e.name = 'NotFoundError'; return e; };

  /* ---------- a Blob-like window onto a byte range of a real file ---------- */
  class NativeBlob {
    constructor(p, start, end) { this._p = p; this._s = start; this._e = end; }
    get size() { return Math.max(0, this._e - this._s); }
    slice(s = 0, e = this.size) {
      const from = this._s + Math.max(0, s);
      return new NativeBlob(this._p, from, Math.min(this._e, this._s + e));
    }
    async arrayBuffer() {
      const u8 = unwrap(await N.read(this._p, this._s, this._e));
      // a fresh copy, so the caller owns a plain ArrayBuffer
      return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    }
    async bytes() { return new Uint8Array(await this.arrayBuffer()); }
    stream() {
      const CH = 1 << 20;                // 1 MB at a time keeps memory flat
      let at = this._s; const end = this._e, p = this._p;
      return new ReadableStream({
        async pull(c) {
          if (at >= end) { c.close(); return; }
          const to = Math.min(at + CH, end);
          const u8 = unwrap(await N.read(p, at, to));
          at = to; c.enqueue(u8);
        }
      });
    }
  }

  /* ---------- what getFile() hands back ---------- */
  class NativeFile extends NativeBlob {
    constructor(p, size, mtime) { super(p, 0, size); this.__path = p; this.name = base(p); this.lastModified = mtime; this.type = ''; }
  }

  class NativeWritable {
    constructor(p) { this._p = p; this._chunks = []; }
    async write(data) {
      const d = (data && data.data !== undefined && data.type) ? data.data : data;   // {type:'write',data}
      // copying a file we already know the path of: let the OS move the bytes
      if (d && d.__path) { unwrap(await N.copy(d.__path, this._p)); this._done = true; return; }
      if (d instanceof Blob) { this._chunks.push(new Uint8Array(await d.arrayBuffer())); return; }
      if (d instanceof ArrayBuffer) { this._chunks.push(new Uint8Array(d)); return; }
      if (ArrayBuffer.isView(d)) { this._chunks.push(new Uint8Array(d.buffer, d.byteOffset, d.byteLength)); return; }
      if (typeof d === 'string') { this._chunks.push(new TextEncoder().encode(d)); return; }
      throw new TypeError('unsupported write payload');
    }
    async close() {
      if (this._done) return;
      let total = 0; for (const c of this._chunks) total += c.length;
      const all = new Uint8Array(total); let o = 0;
      for (const c of this._chunks) { all.set(c, o); o += c.length; }
      unwrap(await N.write(this._p, all));
      this._chunks = [];
    }
    async abort() { this._chunks = []; }
  }

  class NativeFileHandle {
    constructor(p) { this.kind = 'file'; this._p = p; this.name = base(p); }
    async getFile() {
      const st = unwrap(await N.stat(this._p));
      if (!st) throw notFound(this._p);
      return new NativeFile(this._p, st.size, st.mtime);
    }
    async createWritable() { return new NativeWritable(this._p); }
    async move(destDir, newName) {
      const to = join(destDir._p !== undefined ? destDir._p : destDir, newName || this.name);
      unwrap(await N.rename(this._p, to));
      this._p = to; this.name = base(to);
    }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
    isSameEntry(o) { return !!o && o._p === this._p; }
  }

  class NativeDirHandle {
    constructor(p) { this.kind = 'directory'; this._p = p; this.name = base(p) || p; }
    async *values() {
      for (const e of unwrap(await N.list(this._p))) {
        const full = join(this._p, e.name);
        yield e.kind === 'directory' ? new NativeDirHandle(full) : new NativeFileHandle(full);
      }
    }
    async *keys()    { for await (const h of this.values()) yield h.name; }
    async *entries() { for await (const h of this.values()) yield [h.name, h]; }
    [Symbol.asyncIterator]() { return this.entries(); }

    async getDirectoryHandle(name, opts) {
      const full = join(this._p, name);
      const st = unwrap(await N.stat(full));
      if (st && st.dir) return new NativeDirHandle(full);
      if (st && !st.dir) { const e = new Error(name + ' is a file'); e.name = 'TypeMismatchError'; throw e; }
      if (!opts || !opts.create) throw notFound(full);
      unwrap(await N.mkdir(full));
      return new NativeDirHandle(full);
    }
    async getFileHandle(name, opts) {
      const full = join(this._p, name);
      if (!opts || !opts.create) {
        const st = unwrap(await N.stat(full));
        if (!st) throw notFound(full);          // SORT relies on this to spot a clash
        if (st.dir) { const e = new Error(name + ' is a directory'); e.name = 'TypeMismatchError'; throw e; }
      }
      return new NativeFileHandle(full);        // create: the bytes arrive on write
    }
    async removeEntry(name) { unwrap(await N.unlink(join(this._p, name))); }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
    isSameEntry(o) { return !!o && o._p === this._p; }

    // SORT asks whether the destination sits inside the source before it writes
    // anything. [] is the same folder, null is unrelated.
    async resolve(child) {
      if (!child || typeof child._p !== 'string') return null;
      const strip = p => p.replace(/[\\/]+$/, '');
      const fold  = p => N.platform === 'linux' ? p : p.toLowerCase();  // mac and Windows ignore case
      const here = strip(this._p), there = strip(child._p);
      if (fold(here) === fold(there)) return [];
      if (fold(there).indexOf(fold(here) + SEP) !== 0) return null;
      return there.slice(here.length + SEP.length).split(/[\\/]/).filter(Boolean);
    }
  }

  window.showDirectoryPicker = async function (opts) {
    const p = unwrap(await N.pick(opts && opts.id === 'cdavio-dst' ? 'Choose where the folders go' : 'Choose the folder to sort'));
    if (!p) { const e = new Error('The user aborted a request.'); e.name = 'AbortError'; throw e; }
    return new NativeDirHandle(p);
  };
  window.__SORT_NATIVE_SHIM = true;
})();
