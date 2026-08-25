/* =============================================================
   SajiPOS — Pembuat QR Code & Barcode Code128 (tanpa dependensi)
   Dipakai untuk E-Menu per meja dan label produk.
   QR: mode byte, koreksi kesalahan level M, versi 1–10.
   ============================================================= */
window.App = window.App || {};

App.QR = (function () {

  /* ---------- Aritmetika GF(256) untuk Reed-Solomon ---------- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;          // polinomial primitif
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  function rsGenerator(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], 1);
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function rsEncode(data, ecLen) {
    const gen = rsGenerator(ecLen);
    const res = new Array(ecLen).fill(0);
    for (const byte of data) {
      const factor = byte ^ res[0];
      res.shift(); res.push(0);
      for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
    }
    return res;
  }

  /* ---------- Tabel versi untuk level koreksi M ---------- */
  /* [total data codeword, EC codeword/blok, blok grup1, data/blok g1, blok grup2, data/blok g2] */
  const VERSIONS_M = {
    1:  [16, 10, 1, 16, 0, 0],
    2:  [28, 16, 1, 28, 0, 0],
    3:  [44, 26, 1, 44, 0, 0],
    4:  [64, 18, 2, 32, 0, 0],
    5:  [86, 24, 2, 43, 0, 0],
    6:  [108, 16, 4, 27, 0, 0],
    7:  [124, 18, 4, 31, 0, 0],
    8:  [154, 22, 2, 38, 2, 39],
    9:  [182, 22, 3, 36, 2, 37],
    10: [216, 26, 4, 43, 1, 44]
  };
  const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function pickVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      const cap = VERSIONS_M[v][0];
      const header = 4 + (v < 10 ? 8 : 16);
      if (byteLen * 8 + header <= cap * 8) return v;
    }
    return null;
  }

  /* ---------- Penyusunan aliran bit ---------- */
  function buildData(bytes, version) {
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4);                                   // mode byte
    push(bytes.length, version < 10 ? 8 : 16);         // jumlah karakter
    bytes.forEach(b => push(b, 8));

    const capacityBits = VERSIONS_M[version][0] * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);   // terminator
    while (bits.length % 8) bits.push(0);
    const pad = [0xEC, 0x11];
    let p = 0;
    while (bits.length < capacityBits) { push(pad[p++ % 2], 8); }

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codewords.push(b);
    }
    return codewords;
  }

  /* ---------- Blok data + koreksi kesalahan, lalu di-interleave ---------- */
  function interleave(codewords, version) {
    const [, ecLen, g1, d1, g2, d2] = VERSIONS_M[version];
    const blocks = [];
    let pos = 0;
    for (let i = 0; i < g1; i++) { blocks.push(codewords.slice(pos, pos + d1)); pos += d1; }
    for (let i = 0; i < g2; i++) { blocks.push(codewords.slice(pos, pos + d2)); pos += d2; }
    const ecBlocks = blocks.map(b => rsEncode(b, ecLen));

    const out = [];
    const maxData = Math.max(...blocks.map(b => b.length));
    for (let i = 0; i < maxData; i++)
      blocks.forEach(b => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < ecLen; i++)
      ecBlocks.forEach(b => out.push(b[i]));
    return out;
  }

  /* ---------- Matriks ---------- */
  function createMatrix(version) {
    const size = version * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    const setF = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) { m[r][c] = v; reserved[r][c] = true; } };

    /* pola pencari + pemisah */
    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const on = inBox && ((r === 0 || r === 6 || c === 0 || c === 6) ||
                             (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setF(r0 + r, c0 + c, on ? 1 : 0);
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    /* pola waktu */
    for (let i = 8; i < size - 8; i++) {
      setF(6, i, i % 2 === 0 ? 1 : 0);
      setF(i, 6, i % 2 === 0 ? 1 : 0);
    }

    /* pola perataan */
    const centers = ALIGN[version];
    centers.forEach(r => centers.forEach(c => {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) return;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        setF(r + dr, c + dc, on ? 1 : 0);
      }
    }));

    /* modul gelap + area format */
    setF(size - 8, 8, 1);
    for (let i = 0; i < 9; i++) { if (m[8][i] === null) setF(8, i, 0); if (m[i][8] === null) setF(i, 8, 0); }
    for (let i = 0; i < 8; i++) { setF(8, size - 1 - i, 0); setF(size - 1 - i, 8, 0); }

    /* informasi versi (versi 7 ke atas) */
    if (version >= 7) {
      const vbits = versionBits(version);
      for (let i = 0; i < 18; i++) {
        const bit = (vbits >> i) & 1;
        setF(Math.floor(i / 3), size - 11 + (i % 3), bit);
        setF(size - 11 + (i % 3), Math.floor(i / 3), bit);
      }
    }
    return { m, reserved, size };
  }

  function versionBits(version) {
    let d = version << 12;
    for (let i = 17; i >= 12; i--) if ((d >> i) & 1) d ^= 0x1F25 << (i - 12);
    return (version << 12) | d;
  }
  function formatBits(maskIdx) {
    const ecBits = 0b00;                       // level M
    let data = (ecBits << 3) | maskIdx;
    let d = data << 10;
    for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= 0x537 << (i - 10);
    return ((data << 10) | d) ^ 0x5412;
  }

  function placeData(state, codewords) {
    const { m, reserved, size } = state;
    const bits = [];
    codewords.forEach(cw => { for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1); });

    let idx = 0, up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                    // lewati kolom pola waktu
      for (let i = 0; i < size; i++) {
        const row = up ? size - 1 - i : i;
        for (let c = 0; c < 2; c++) {
          const cc = col - c;
          if (reserved[row][cc]) continue;
          m[row][cc] = idx < bits.length ? bits[idx++] : 0;
        }
      }
      up = !up;
    }
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  function applyMask(state, maskIdx) {
    const { m, reserved, size } = state;
    const out = m.map(row => row.slice());
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
      if (!reserved[r][c] && MASKS[maskIdx](r, c)) out[r][c] ^= 1;
    return out;
  }

  /* Penempatan 15 bit informasi format mengikuti ISO/IEC 18004:
     bit 14 (MSB) di (8,0) menurun ke bit 0 di (0,8) pada salinan pertama. */
  function writeFormat(matrix, size, maskIdx) {
    const f = formatBits(maskIdx);
    for (let i = 0; i < 15; i++) {
      const bit = (f >> i) & 1;
      /* salinan pertama — mengelilingi pola pencari kiri atas */
      if (i < 6)       matrix[i][8] = bit;
      else if (i === 6) matrix[7][8] = bit;
      else if (i === 7) matrix[8][8] = bit;
      else if (i === 8) matrix[8][7] = bit;
      else              matrix[8][14 - i] = bit;
      /* salinan kedua — di kanan pencari kanan atas & bawah pencari kiri bawah */
      if (i < 8) matrix[8][size - 1 - i] = bit;
      else       matrix[size - 15 + i][8] = bit;
    }
    matrix[size - 8][8] = 1;                   // modul gelap
  }

  function penalty(matrix, size) {
    let score = 0;
    /* aturan 1: deretan sewarna */
    for (let i = 0; i < size; i++) {
      for (const line of [matrix[i], matrix.map(r => r[i])]) {
        let run = 1;
        for (let j = 1; j < size; j++) {
          if (line[j] === line[j - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
          else run = 1;
        }
      }
    }
    /* aturan 2: blok 2×2 */
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) score += 3;
    }
    /* aturan 3: pola mirip pencari */
    const pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    for (let i = 0; i < size; i++) for (let j = 0; j <= size - 11; j++) {
      const row = matrix[i].slice(j, j + 11);
      const col = matrix.slice(j, j + 11).map(r => r[i]);
      [row, col].forEach(seq => {
        if (pat1.every((v, k) => v === seq[k]) || pat2.every((v, k) => v === seq[k])) score += 40;
      });
    }
    /* aturan 4: keseimbangan gelap-terang */
    let dark = 0;
    matrix.forEach(r => r.forEach(v => dark += v));
    const pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  /* ---------- API utama ---------- */
  function encode(text) {
    const bytes = [];
    for (const ch of unescape(encodeURIComponent(String(text)))) bytes.push(ch.charCodeAt(0));
    const version = pickVersion(bytes.length);
    if (!version) throw new Error('Teks terlalu panjang untuk QR (maks ~200 karakter)');

    const codewords = interleave(buildData(bytes, version), version);
    const state = createMatrix(version);
    placeData(state, codewords);

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const cand = applyMask(state, mask);
      writeFormat(cand, state.size, mask);
      const sc = penalty(cand, state.size);
      if (sc < bestScore) { bestScore = sc; best = cand; }
    }
    return { matrix: best, size: state.size, version };
  }

  /* SVG siap cetak; `quiet` = margin wajib (4 modul) */
  function svg(text, opts = {}) {
    const { size = 160, quiet = 4, color = '#000', bg = '#fff' } = opts;
    const { matrix, size: n } = encode(text);
    const total = n + quiet * 2;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (matrix[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">
      <rect width="${total}" height="${total}" fill="${bg}"/><path d="${path}" fill="${color}"/></svg>`;
  }

  /* ---------- Barcode Code128 (subset B/C) untuk label produk ---------- */
  const C128 = ['11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000','11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100','11001001110','11011100100','11001110100','11101101110','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010','11011011000','11011000110','11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000','11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110','11101110110','11010001110','11000101110','11011101000','11011100010','11011101110','11101011000','11101000110','11100010110','11101101000','11101100010','11100011010','11101111010','11001000010','11110001010','10100110000','10100001100','10010110000','10010000110','10000101100','10000100110','10110010000','10110000100','10011010000','10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010','10100111100','10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100','11110010010','11011011110','11011110110','11110110110','10101111000','10100011110','10001011110','10111101000','10111100010','11110101000','11110100010','10111011110','10111101110','11101011110','11110101110','11010000100','11010010000','11010011100','1100011101011'];

  function code128(text) {
    const s = String(text);
    const codes = [104];                        // START B
    for (const ch of s) codes.push(ch.charCodeAt(0) - 32);
    let sum = 104;
    codes.slice(1).forEach((c, i) => sum += c * (i + 1));
    codes.push(sum % 103);                      // checksum
    codes.push(106);                            // STOP
    return codes.map(c => C128[c]).join('');
  }
  function barcodeSVG(text, opts = {}) {
    const { width = 200, height = 46, showText = true } = opts;
    const bits = code128(text);
    const bw = width / bits.length;
    let path = '', x = 0;
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') path += `M${(x).toFixed(3)} 0h${bw.toFixed(3)}v${showText ? height - 12 : height}h-${bw.toFixed(3)}z`;
      x += bw;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#fff"/><path d="${path}" fill="#000"/>
      ${showText ? `<text x="${width/2}" y="${height - 1}" font-family="monospace" font-size="10" text-anchor="middle">${String(text).replace(/[<&]/g,'')}</text>` : ''}</svg>`;
  }

  return { encode, svg, code128, barcodeSVG };
})();
