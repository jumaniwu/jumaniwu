# SajiPOS — Sistem POS Terintegrasi untuk Cafe & Restoran

Aplikasi manajemen bisnis F&B lengkap: **Kasir (POS), Inventori, Procurement,
Akuntansi, HR/Payroll, dan CRM** dalam satu sistem yang saling terhubung.
Dibangun mengikuti cakupan fitur proposal **majoo** yang dilampirkan, dengan
seluruh modul benar-benar berfungsi — bukan sekadar tampilan.

---

## Menjalankan

Aplikasi ini murni HTML/CSS/JavaScript, **tanpa dependensi, tanpa build step,
tanpa server backend**.

```bash
# cara yang disarankan (data tersimpan permanen di browser)
cd pos
python3 -m http.server 8080
# lalu buka http://localhost:8080
```

> Membuka `index.html` langsung lewat `file://` juga bisa, tetapi sebagian
> browser memblokir `localStorage` pada protokol tersebut sehingga data hanya
> bertahan selama tab terbuka. Aplikasi akan memberi peringatan bila ini terjadi.

Saat pertama dibuka, sistem otomatis membuat **data contoh lengkap**: 3 outlet,
75 produk & bahan baku beserta resep, 40 pelanggan, 14 karyawan, 6 supplier,
serta riwayat transaksi sepanjang bulan berjalan (±2.500 pesanan) lengkap dengan
jurnal, stok, pembelian, absensi, dan payroll.

### Akun demo

| Pengguna | Peran | PIN | Cakupan |
|---|---|---|---|
| Budi Santoso | Owner | `1234` | seluruh modul, semua outlet |
| Rina Wijaya | Manager | `2222` | semua kecuali pengaturan sistem |
| Joko Susilo | Supervisor | `3333` | operasional + otorisasi void/refund |
| Andi Pratama | Kasir | `1111` | kasir, pesanan, shift |
| Bambang Irawan | Dapur | `4444` | kitchen display |
| Dewi Lestari | Akuntan | `5555` | keuangan & laporan |
| Maya Sari | HRD | `6666` | karyawan & payroll |
| Tono Suprapto | Gudang | `7777` | inventori & pembelian |

---

## Modul

### 🧾 Kasir (POS)
Kasir layar sentuh dengan grid menu, pencarian, dan pemindai barcode.
6 jenis pesanan (**dine in, bungkus, pengiriman, ojek online, reservasi, toko
online**), varian & modifier per item, catatan ke dapur, diskon manual
berotorisasi PIN, promo otomatis, **split payment** lintas metode
(tunai, QRIS, kartu debit/kredit, e-wallet, transfer, deposit member, invoice),
kembalian, cetak struk, struk digital (WhatsApp/email/SMS), tahan pesanan,
kirim ke dapur, serta **void & refund per item** dengan otorisasi supervisor.
Buka/tutup kasir dengan perhitungan selisih kas dan laporan shift tercetak.

### 🪑 Meja, Reservasi & Kitchen Display
Denah meja real-time per area (kosong / terisi / minta bill / reservasi),
durasi duduk, pindah meja, dan manajemen reservasi berikut deposit.
KDS memisahkan antrean **dapur** dan **bar**, menandai pesanan yang menunggu
terlalu lama, dan otomatis menyegarkan.

### 📦 Inventori
Produk & bahan baku, **resep (BOM) berjenjang**, multi satuan dengan konversi,
varian, dan modifier yang ikut memotong stok. Stok per outlet dengan **HPP
metode rata-rata bergerak (moving average)**, kartu stok, stok masuk,
stok terbuang, **stok opname**, mutasi antar outlet, dan produksi
(bahan baku → barang jadi). Peringatan stok minimum otomatis muncul di kasir,
dashboard, dan sidebar.

### 🛒 Procurement
Supplier dengan termin pembayaran, **Purchase Order** (draft → dikirim →
diterima sebagian → selesai) berikut cetak PO resmi, **penerimaan barang (GRN)**
yang langsung menambah stok dan membentuk tagihan, serta **hutang usaha** dengan
analisa umur tagihan dan pembayaran satuan maupun massal. Tombol
"Buat PO Otomatis" menyusun pesanan dari daftar bahan di bawah stok minimum.

### 📊 Akuntansi
**Double-entry penuh** dengan 43 akun standar Indonesia. Seluruh transaksi
operasional terposting otomatis:

| Kejadian | Jurnal otomatis |
|---|---|
| Penjualan POS | Kas/Bank/Piutang, Diskon, Pendapatan per kategori, Service charge, PB1 |
| HPP penjualan | Beban HPP ← Persediaan (dihitung dari resep) |
| Komisi pramusaji | Beban Komisi ← Hutang Gaji |
| Penerimaan barang | Persediaan ← Hutang Usaha |
| Pembayaran supplier | Hutang Usaha ← Kas/Bank |
| Stok terbuang / opname | Beban Kerugian Persediaan ← Persediaan |
| Payroll | Beban Gaji ← Hutang Gaji, PPh 21, BPJS (per outlet) |
| Tutup kasir | Setoran ke kas besar + selisih kas |
| Deposit pelanggan | Kas ← Deposit Pelanggan |

Laporan: **Laba Rugi, Neraca, Arus Kas, Neraca Saldo, Buku Besar per akun,
umur piutang & hutang**, serta **Laporan Pembanding** (periode berjalan vs
periode sebelumnya dan perbandingan antar outlet), plus jurnal manual dan
pencatatan pengeluaran.

### 👥 HR & Payroll
Data karyawan, struktur gaji (pokok, tunjangan, potongan BPJS), absensi
masuk/pulang dengan deteksi keterlambatan & lembur, jadwal shift, pengajuan
cuti berjenjang, **payroll otomatis** yang menarik data absensi, lembur, dan
komisi penjualan, serta **slip gaji** siap cetak.

### 💚 CRM
Pelanggan & membership berjenjang (Reguler → Silver → Gold → Platinum) dengan
kenaikan tier otomatis, poin, stamp card, dan deposit. Promo:
diskon persen/nominal, **buy 1 get 1**, stamp, diskon member otomatis, dengan
batasan hari, jam, kategori, dan minimum belanja. Kampanye marketing
WhatsApp/SMS/email per segmen (aktif, berisiko churn, ulang tahun, per tier).
Toko online & E-Menu QR dengan rekap performa per kanal (GoFood, GrabFood,
ShopeeFood, webstore) termasuk estimasi komisi platform.

### 📱 Perangkat Pendamping
Layar dan aplikasi tambahan yang berbagi satu basis data dengan kasir:

- **Self Order (E-Menu QR)** — pelanggan memindai QR di meja, memilih menu,
  menambahkan catatan, dan mengirim pesanan sendiri. Pesanan langsung muncul di
  Kitchen Display, Order Display, dan Daftar Pesanan kasir; meja otomatis
  berubah menjadi terisi. Layar ini **tidak memerlukan login** dan navigasinya
  dikunci hanya pada layar pelanggan.
- **Customer Display** — layar menghadap pelanggan yang menampilkan isi
  keranjang kasir **secara langsung dari jendela lain** (tersinkron antar tab
  melalui `localStorage`), lengkap dengan promo berjalan.
- **Order Display** — papan antrean "sedang disiapkan" dan "siap diambil"
  untuk pelanggan bungkus, menyegarkan diri otomatis.
- **QR Meja & Label Produk** — pembuat **QR Code** dan **barcode Code128** asli
  (tanpa pustaka pihak ketiga). Cetak kartu QR per meja dan label harga
  berbarcode untuk seluruh produk.
- **Aplikasi Owner** — tampilan ponsel untuk pemilik: omzet real-time,
  perbandingan antar outlet, posisi kas & tagihan, absensi hari ini,
  persetujuan cuti, notifikasi, dan **kirim pesan ke outlet**.
- **Aplikasi Teams** — tampilan ponsel untuk karyawan: absen masuk/pulang,
  jadwal shift 14 hari, riwayat absensi, struktur gaji, **slip gaji**, dan
  pengajuan cuti.

### 📑 Laporan & Analisa
**33 jenis laporan** siap ekspor CSV/Excel, mencakup penjualan, inventori,
pembelian, keuangan, karyawan, dan pelanggan. Halaman Analisa Bisnis
menyajikan **menu engineering** (bintang / kuda beban / teka-teki / kurang laku),
rasio kesehatan bisnis (food cost, biaya tenaga kerja, net margin),
peta jam ramai, perbandingan antar outlet, dan **rekomendasi otomatis**.

### ⚙️ Sistem
Multi outlet dengan pajak & service charge sendiri, pengaturan struk dan
printer, metode pembayaran beserta biaya MDR, pengguna & **hak akses granular
(23 permission)** dengan peran yang bisa disesuaikan, jejak aktivitas,
mode gelap, serta backup/restore data JSON.

---

## Arsitektur

```
pos/
├── index.html                  Shell aplikasi + layar login PIN
├── assets/css/
│   ├── app.css                 Design system (token, komponen, mode gelap)
│   └── pos.css                 Layar kasir, KDS, denah meja, struk cetak
└── js/
    ├── core/
    │   ├── util.js             Format rupiah/tanggal Indonesia, helper koleksi
    │   ├── db.js               Penyimpanan localStorage + katup pengaman kuota
    │   ├── ui.js               Modal, toast, form builder, tabel data
    │   ├── charts.js           Grafik SVG (garis, batang, donat, heatmap)
    │   ├── auth.js             Peran, hak akses, sesi, router hash
    │   ├── ledger.js           Mesin akuntansi double-entry & auto-posting
    │   ├── inventory.js        Stok, resep berjenjang, HPP rata-rata bergerak
    │   └── qr.js               Pembuat QR Code & barcode Code128
    ├── data/                   Data contoh (master + riwayat transaksi)
    ├── modules/                14 modul tampilan
    └── app.js                  Navigasi, rute, boot
```

**Alur integrasi inti** — satu transaksi kasir memicu:
stok bahan berkurang sesuai resep → HPP dihitung dari harga rata-rata bergerak →
jurnal penjualan + HPP + komisi terbentuk → poin, stamp, dan tier pelanggan
diperbarui → kas shift bertambah → seluruh laporan ikut berubah.

### Catatan teknis

- **Penyimpanan.** Data disimpan di `localStorage` browser (kuota ±5 MB).
  Data contoh menempati ±3,2 MB, menyisakan ruang untuk ribuan transaksi baru.
  Bila kuota hampir penuh, sistem otomatis mengarsipkan riwayat terlama dan
  meminta pengguna mengunduh backup.
- **Jurnal data contoh.** Transaksi riwayat diposting sebagai **rekap jurnal
  harian per outlet** (praktik lazim pada sistem POS) agar basis data tetap
  ringan. Transaksi baru yang Anda buat diposting **per transaksi** sehingga
  jejaknya bisa ditelusuri satu per satu di menu Jurnal Umum.
- **Konsistensi.** Buku besar persediaan selalu sama dengan nilai stok fisik
  (selisih < Rp 100 karena pembulatan), neraca selalu seimbang, dan laba per
  outlet dijumlah persis sama dengan laba konsolidasi.
- **Outlet Kemang** menanggung gaji staf pusat (owner, manager, HRD, akuntan)
  sehingga marginnya tampak paling tipis — kondisi yang memang ingin
  ditonjolkan pada laporan perbandingan antar outlet.
- **Zona waktu.** Seluruh perhitungan tanggal memakai waktu lokal perangkat,
  bukan UTC — penting agar transaksi dini hari di WIB/WITA/WIT tidak masuk ke
  tanggal yang salah.
- **QR & barcode** dibuat sendiri (Reed–Solomon, masking, penempatan format
  sesuai ISO/IEC 18004) dan diverifikasi dengan pustaka pembaca independen.

### Pintasan papan ketik

`F1` cari menu · `F2` kasir · `F3` daftar pesanan · `F4` meja · `F9` bayar ·
`Esc` tutup dialog · `Enter` konfirmasi

### Menyiapkan layar pendamping

Buka aplikasi di jendela/tab terpisah lalu arahkan ke alamat berikut:

| Layar | Alamat |
|---|---|
| Self Order meja tertentu | `#/selforder?o=<id-outlet>&t=<id-meja>` |
| Customer Display | `#/customerdisplay` |
| Order Display | `#/orderdisplay` |

QR siap cetak untuk tiap meja dibuat otomatis di menu **QR Meja & Label**.
Agar bisa dipindai dari HP pelanggan, ganti alamat dasar pada halaman tersebut
dengan alamat jaringan komputer kasir (mis. `http://192.168.1.10:8080/`),
bukan `localhost`.

---

## Pengujian

Seluruh modul diverifikasi otomatis menggunakan Playwright:

- 36 rute dimuat tanpa error JavaScript
- 33 laporan dirender dan diekspor
- Alur penjualan, void, opname, PO → penerimaan → tagihan → pembayaran, dan
  payroll diuji ujung ke ujung
- Integritas akuntansi diperiksa setiap langkah: total debit = kredit,
  neraca seimbang, tidak ada jurnal timpang, tidak ada stok negatif
- Alur self-order diuji dari pemilihan menu sampai muncul di Kitchen Display,
  Order Display, dan Daftar Pesanan kasir
- Sinkronisasi Customer Display diuji lintas jendela browser
- 200 QR Code di seluruh versi 1–10 (termasuk teks Unicode) diverifikasi dapat
  dibaca kembali oleh pustaka pemindai independen
- Perilaku penyegaran otomatis diuji: meninggalkan halaman KDS/Order Display
  tidak lagi menimpa halaman yang sedang dibuka
