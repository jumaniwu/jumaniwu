# SitePlan Generator

Sistem desain layout siteplan otomatis: cukup masukkan titik koordinat batas lahan,
pilih apa yang ingin dibangun, dan siteplan langsung terbentuk.

## Fitur

- **Input koordinat** meter lokal X,Y (satu titik per baris, toleran `x,y` / `x y` / `x;y`)
- **📷 Scan Foto Dokumen** — foto/upload dokumen daftar koordinat (mis. Surat Ukur);
  angka dibaca otomatis dengan OCR di browser (Tesseract.js), koordinat UTM/TM3
  dinormalisasi ke meter lokal, dengan pratinjau koreksi sebelum dipakai
- **Auto-layout**: kavling rumah (ukuran bebas, default 6×12 m), jalan utama &
  lingkungan, fasum/fasos, RTH/taman, dan ruko komersial di frontage jalan utama
- **Tampilan interaktif**: zoom (scroll), pan (drag), tooltip per kavling, label blok
  (A-01, B-02, R-01…), legenda, panah utara, skala batang
- **Ringkasan otomatis**: jumlah kavling, luas & persentase per kategori, efisiensi lahan
- **Export**: PNG resolusi tinggi, DXF (AutoCAD R12 — layer per kategori), PDF (A4 landscape)

## Menjalankan

Aplikasi statis tanpa build. Buka `index.html` langsung, atau:

```bash
npx http-server -p 8080
# buka http://localhost:8080
```

Export PDF dan scan OCR memuat jsPDF/Tesseract.js dari CDN saat dipakai
(butuh koneksi internet); fitur lain berjalan penuh secara offline.

## Struktur

| File | Isi |
|---|---|
| `js/geometry.js` | Primitif geometri (shoelace, point-in-polygon, clipping Sutherland–Hodgman) |
| `js/layout.js` | Algoritma auto-layout: band jalan + baris kavling, fasum/RTH, penomoran |
| `js/renderer.js` | Renderer canvas 2D interaktif |
| `js/export-*.js` | Export PNG / DXF / PDF |
| `js/ocr-scan.js` | Scan foto dokumen → koordinat (OCR + parser + normalisasi UTM) |
| `js/app.js` | Perekat UI |

## Pengujian

```bash
node test/unit.mjs                 # unit test geometri, layout, parser OCR, DXF
npm install                        # sekali, untuk dependensi test (jspdf)
http-server -p 8080 &              # server statis
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/verify.mjs   # E2E Playwright
```
