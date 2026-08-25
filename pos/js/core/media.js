/* =============================================================
   SajiPOS — Penyimpanan Media (IndexedDB)
   Foto materi promosi disimpan di IndexedDB, bukan localStorage,
   karena localStorage hanya ~5 MB dan sudah dipakai basis data.
   ============================================================= */
window.App = window.App || {};

App.Media = (function () {
  const DB_NAME = 'sajipos.media', STORE = 'files', VERSION = 1;

  /* Ukuran baku materi promosi layar pelanggan */
  const SPEC = {
    idealW: 1920, idealH: 1080,          // 16:9 — pas layar penuh saat idle
    minW: 1280,  minH: 720,              // di bawah ini gambar mulai pecah
    maxSourceMB: 12,
    quality: 0.85,
    safeX: 0.60,                         // area aman teks: tengah 60% lebar
    safeY: 0.90                          //                  tengah 90% tinggi
  };

  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB tidak tersedia di browser ini'));
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Gagal membuka penyimpanan media'));
    });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let out;
      try { out = fn(store); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
    }));
  }

  function put(rec)     { return tx('readwrite', s => s.put(rec)); }
  function get(id)      { return tx('readonly',  s => s.get(id)); }
  function remove(id)   { return tx('readwrite', s => s.delete(id)); }
  function all()        { return tx('readonly',  s => s.getAll()); }
  function clear()      { return tx('readwrite', s => s.clear()); }

  /* ---------- pemrosesan gambar ---------- */
  function loadImage(fileOrURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = typeof fileOrURL === 'string' ? fileOrURL : URL.createObjectURL(fileOrURL);
      img.onload = () => { resolve({ img, url }); };
      img.onerror = () => { reject(new Error('Berkas bukan gambar yang bisa dibaca')); };
      img.src = url;
    });
  }

  /* Perkecil bertahap agar hasil tetap tajam pada penyusutan besar */
  function drawScaled(img, tw, th) {
    let sw = img.naturalWidth, sh = img.naturalHeight;
    let canvas = document.createElement('canvas');
    let ctx;
    while (sw / 2 > tw && sh / 2 > th) {
      const c = document.createElement('canvas');
      c.width = Math.floor(sw / 2); c.height = Math.floor(sh / 2);
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, c.width, c.height);
      img = c; sw = c.width; sh = c.height;
    }
    canvas.width = tw; canvas.height = th;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, tw, th);
    return canvas;
  }

  /* Proses berkas unggahan: perkecil ke ukuran baku, kompres, laporkan mutu. */
  function process(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error('Hanya berkas gambar (JPG/PNG/WebP) yang bisa diunggah'));
      if (file.size > SPEC.maxSourceMB * 1048576)
        return reject(new Error(`Ukuran berkas melebihi ${SPEC.maxSourceMB} MB`));

      loadImage(file).then(({ img, url }) => {
        const sw = img.naturalWidth, sh = img.naturalHeight;
        const warnings = [];
        if (sw < SPEC.minW || sh < SPEC.minH)
          warnings.push(`Resolusi asli ${sw}×${sh} px di bawah minimum ${SPEC.minW}×${SPEC.minH} px — gambar berpotensi terlihat pecah di layar besar.`);
        const ar = sw / sh, idealAR = SPEC.idealW / SPEC.idealH;
        if (Math.abs(ar - idealAR) > 0.25)
          warnings.push(`Rasio gambar ${ar.toFixed(2)}:1 berbeda jauh dari 16:9 — sebagian sisi akan terpotong agar layar terisi penuh.`);

        /* Muat dalam 1920×1080 tanpa mengubah proporsi (tidak digepengkan) */
        const scale = Math.min(SPEC.idealW / sw, SPEC.idealH / sh, 1);
        const tw = Math.max(1, Math.round(sw * scale));
        const th = Math.max(1, Math.round(sh * scale));
        const canvas = drawScaled(img, tw, th);
        const hasAlpha = /png|webp/i.test(file.type);
        const mime = hasAlpha ? 'image/png' : 'image/jpeg';

        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error('Gagal memproses gambar'));
          resolve({
            blob, width: tw, height: th, type: mime,
            sourceWidth: sw, sourceHeight: sh, sourceSize: file.size,
            size: blob.size, name: file.name, warnings
          });
        }, mime, SPEC.quality);
      }).catch(reject);
    });
  }

  /* ---------- API tingkat atas ---------- */
  const urlCache = new Map();

  async function save(file) {
    const p = await process(file);
    const id = App.U.uid('img');
    await put({ id, blob: p.blob, type: p.type, width: p.width, height: p.height,
                size: p.size, name: p.name, createdAt: App.U.now() });
    return { id, ...p };
  }
  async function url(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const rec = await get(id);
    if (!rec) return null;
    const u = URL.createObjectURL(rec.blob);
    urlCache.set(id, u);
    return u;
  }
  function forget(id) {
    if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
  }
  async function del(id) { forget(id); await remove(id); }

  async function usage() {
    const list = await all();
    const bytes = list.reduce((a, r) => a + (r.size || 0), 0);
    let quota = null;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        quota = { usage: e.usage, quota: e.quota };
      }
    } catch (e) {}
    return { count: list.length, bytes, quota };
  }

  /* Cadangan: ubah seluruh gambar menjadi data URL agar ikut dalam berkas backup */
  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(dataURL) {
    const [head, b64] = String(dataURL).split(',');
    const mime = (/data:([^;]+)/.exec(head) || [])[1] || 'image/jpeg';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  async function exportAll() {
    const list = await all();
    const out = {};
    for (const r of list) {
      out[r.id] = { data: await blobToDataURL(r.blob), type: r.type,
                    width: r.width, height: r.height, size: r.size, name: r.name, createdAt: r.createdAt };
    }
    return out;
  }
  async function importAll(map) {
    if (!map) return 0;
    let n = 0;
    for (const [id, m] of Object.entries(map)) {
      await put({ id, blob: dataURLToBlob(m.data), type: m.type, width: m.width,
                  height: m.height, size: m.size, name: m.name, createdAt: m.createdAt });
      forget(id); n++;
    }
    return n;
  }

  return { SPEC, save, url, del, all, get, clear, usage, exportAll, importAll, process, forget };
})();
