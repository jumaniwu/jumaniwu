/**
 * OCRScan — scan foto dokumen (Surat Ukur / daftar koordinat) menjadi
 * input koordinat otomatis. OCR berjalan di browser via Tesseract.js (CDN,
 * lazy-load). parseCoords() murni sehingga bisa diuji di Node.
 */
(function (root) {
  'use strict';

  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var loading = null;

  /* ---------------- Parser (murni) ---------------- */

  /**
   * Ekstrak pasangan koordinat dari teks hasil OCR.
   * - Toleran pemisah ribuan gaya Indonesia (698.450,25) dan internasional (698,450.25)
   * - Format tabel Surat Ukur "No | X | Y" (angka pertama = nomor urut) dikenali
   * - Salah baca umum O→0, l/I→1 dikoreksi
   * - Koordinat skala UTM/TM3 (>10.000) dinormalisasi ke meter lokal
   * Mengembalikan { points, offset, rawPairs }.
   */
  function parseCoords(text) {
    var rawPairs = [];
    var lines = String(text || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], prev;
      // koreksi salah baca umum (O→0, l/I→1) di sekitar digit; ulang sampai stabil
      do {
        prev = line;
        line = line
          .replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0')
          .replace(/[lI](?=\d)|(?<=\d)[lI]/g, '1');
      } while (line !== prev);
      var nums = _extractNumbers(line);
      if (nums.length < 2) continue;
      var x, y;
      if (nums.length >= 3 && _looksLikeIndex(nums[0], rawPairs.length)) {
        x = nums[1]; y = nums[2];
      } else {
        x = nums[0]; y = nums[1];
      }
      if (isFinite(x) && isFinite(y)) rawPairs.push([x, y]);
    }

    // normalisasi skala UTM/TM3 → meter lokal
    var offset = null;
    if (rawPairs.length) {
      var minX = Infinity, minY = Infinity, maxAbs = 0;
      rawPairs.forEach(function (p) {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]));
      });
      if (maxAbs > 10000) {
        offset = { x: minX, y: minY };
        rawPairs = rawPairs.map(function (p) {
          return [+(p[0] - minX).toFixed(3), +(p[1] - minY).toFixed(3)];
        });
      }
    }
    return { points: rawPairs, offset: offset };
  }

  function _looksLikeIndex(n, expectedIdx) {
    // nomor urut: bilangan bulat kecil, idealnya berurutan
    return Number.isInteger(n) && n >= 0 && n < 1000 &&
      (expectedIdx === 0 || Math.abs(n - (expectedIdx + 1)) <= 2);
  }

  function _extractNumbers(line) {
    // 1) kolom dipisah spasi/;/| — format tabel umum
    var nums = _numsFromFields(line.split(/[\s;|]+/));
    if (nums.length >= 2) return nums;
    // 2) koma sebagai pemisah kolom ("120,0" atau CSV "1,10,20")
    nums = _numsFromFields(line.split(','));
    if (nums.length >= 2) return nums;
    return [];
  }

  function _numsFromFields(fields) {
    var out = [];
    for (var i = 0; i < fields.length; i++) {
      var m = fields[i].match(/-?\d[\d.,]*/);
      if (!m) continue;
      var v = _parseNumberToken(m[0]);
      if (v !== null) out.push(v);
    }
    return out;
  }

  function _parseNumberToken(tok) {
    tok = tok.replace(/[.,]+$/, ''); // buang tanda baca akhir kalimat
    if (!tok || tok === '-') return null;
    var hasDot = tok.indexOf('.') !== -1, hasComma = tok.indexOf(',') !== -1;
    var v;
    if (hasDot && hasComma) {
      // pemisah terakhir = desimal
      if (tok.lastIndexOf(',') > tok.lastIndexOf('.')) {
        v = parseFloat(tok.replace(/\./g, '').replace(',', '.')); // gaya Indonesia
      } else {
        v = parseFloat(tok.replace(/,/g, '')); // gaya internasional
      }
    } else if (hasComma) {
      // "9.214.300" vs "300,25": koma tunggal dengan ≤2 digit di belakang = desimal
      var parts = tok.split(',');
      if (parts.length === 2 && parts[1].length !== 3) {
        v = parseFloat(tok.replace(',', '.'));
      } else if (parts.slice(1).every(function (p) { return p.length === 3; })) {
        v = parseFloat(tok.replace(/,/g, ''));
      } else {
        v = parseFloat(tok.replace(',', '.'));
      }
    } else if (hasDot) {
      var dparts = tok.split('.');
      if (dparts.length === 2 && dparts[1].length !== 3) {
        v = parseFloat(tok); // desimal biasa
      } else if (dparts.slice(1).every(function (p) { return p.length === 3; })) {
        v = parseFloat(tok.replace(/\./g, '')); // ribuan gaya Indonesia
      } else {
        v = parseFloat(tok);
      }
    } else {
      v = parseFloat(tok);
    }
    return isFinite(v) ? v : null;
  }

  /* ---------------- Pra-proses gambar ---------------- */

  function preprocessImage(img) {
    var targetW = 1600;
    var scale = Math.min(1.5, targetW / img.width);
    var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h);
    var px = data.data;
    // grayscale + peregangan kontras
    var min = 255, max = 0, i, g;
    var gray = new Uint8ClampedArray(px.length / 4);
    for (i = 0; i < px.length; i += 4) {
      g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      gray[i / 4] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    var range = Math.max(1, max - min);
    for (i = 0; i < gray.length; i++) {
      g = ((gray[i] - min) / range) * 255;
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = g;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  /* ---------------- Tesseract ---------------- */

  function loadTesseract() {
    if (root.Tesseract) return Promise.resolve(root.Tesseract);
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = TESSERACT_URL;
        s.onload = function () {
          if (root.Tesseract) resolve(root.Tesseract);
          else reject(new Error('Tesseract tidak tersedia setelah dimuat.'));
        };
        s.onerror = function () {
          loading = null;
          reject(new Error('Gagal memuat mesin OCR (butuh koneksi internet).'));
        };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  /* ---------------- UI wiring ---------------- */

  var cfg = null;

  function init(config) {
    cfg = config;
    cfg.scanBtn.addEventListener('click', function () {
      cfg.fileInput.value = '';
      cfg.fileInput.click();
    });
    cfg.fileInput.addEventListener('change', function () {
      if (cfg.fileInput.files && cfg.fileInput.files[0]) {
        processFile(cfg.fileInput.files[0]);
      }
    });
    cfg.cancelBtn.addEventListener('click', closeModal);
    cfg.useBtn.addEventListener('click', function () {
      cfg.onUse(cfg.coordsEl.value);
      closeModal();
    });
    cfg.coordsEl.addEventListener('input', updatePreviewInfo);
  }

  function openModal() {
    cfg.modal.classList.remove('hidden');
    cfg.progressWrap.classList.remove('hidden');
    cfg.resultWrap.classList.add('hidden');
    cfg.useBtn.disabled = true;
    setProgress(0, 'Menyiapkan…');
  }

  function closeModal() {
    cfg.modal.classList.add('hidden');
  }

  function setProgress(frac, label) {
    cfg.progressBar.style.width = Math.round(frac * 100) + '%';
    cfg.statusEl.textContent = label;
  }

  function processFile(file) {
    openModal();
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var canvas;
      try {
        canvas = preprocessImage(img);
      } catch (e) {
        setProgress(0, 'Gagal memproses gambar: ' + e.message);
        return;
      }
      setProgress(0.05, 'Memuat mesin OCR…');
      loadTesseract().then(function (T) {
        return T.recognize(canvas, 'eng', {
          logger: function (m) {
            if (m.status === 'recognizing text') {
              setProgress(0.2 + 0.8 * (m.progress || 0),
                'Membaca dokumen… ' + Math.round((m.progress || 0) * 100) + '%');
            } else {
              setProgress(0.1, 'Menyiapkan OCR…');
            }
          }
        });
      }).then(function (res) {
        showResult(res.data.text);
      }).catch(function (err) {
        setProgress(0, 'OCR gagal: ' + err.message);
      });
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      setProgress(0, 'File bukan gambar yang valid.');
    };
    img.src = url;
  }

  function showResult(text) {
    var parsed = parseCoords(text);
    cfg.progressWrap.classList.add('hidden');
    cfg.resultWrap.classList.remove('hidden');
    if (!parsed.points.length) {
      cfg.coordsEl.value = '';
      cfg.infoEl.textContent = 'Tidak ada koordinat terbaca. Coba foto yang lebih tajam/terang, atau ketik manual.';
      cfg.useBtn.disabled = true;
      return;
    }
    cfg.coordsEl.value = parsed.points.map(function (p) { return p[0] + ',' + p[1]; }).join('\n');
    var info = '';
    if (parsed.offset) {
      info = 'Koordinat asli terdeteksi skala UTM/TM3 dan dikurangi offset E=' +
        parsed.offset.x.toLocaleString('id-ID') + ', N=' +
        parsed.offset.y.toLocaleString('id-ID') + ' (bentuk & luas tidak berubah). ';
    }
    cfg.infoEl.textContent = info;
    updatePreviewInfo();
  }

  function updatePreviewInfo() {
    var lines = cfg.coordsEl.value.split(/\n+/).filter(function (l) { return l.trim(); });
    var pts = [];
    lines.forEach(function (l) {
      var parts = l.split(/[,;\s]+/).filter(Boolean);
      if (parts.length >= 2) {
        var x = parseFloat(parts[0]), y = parseFloat(parts[1]);
        if (isFinite(x) && isFinite(y)) pts.push([x, y]);
      }
    });
    var base = cfg.infoEl.textContent.split('→')[0];
    var summary = 'Titik: ' + pts.length;
    if (pts.length >= 3 && root.Geom) {
      summary += ' · Luas: ±' + Math.round(root.Geom.polygonArea(pts)).toLocaleString('id-ID') + ' m²';
    }
    cfg.infoEl.textContent = (base ? base + '→ ' : '') + summary;
    cfg.useBtn.disabled = pts.length < 3;
  }

  var OCRScan = { init: init, parseCoords: parseCoords };
  root.OCRScan = OCRScan;
  if (typeof module !== 'undefined' && module.exports) module.exports = OCRScan;
})(typeof window !== 'undefined' ? window : globalThis);
