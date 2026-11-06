# Penambang Bitcoin Web

Solo mining Bitcoin (SHA-256d) langsung di browser, tanpa GPU dan tanpa instalasi.
Satu file HTML, tanpa dependensi.

## Cara pakai

- Buka `index.html` langsung di browser, atau deploy folder ini ke Vercel/Netlify sebagai situs statis.
- Isi alamat Bitcoin mainnet (bc1q…, bc1p…, 1…, atau 3…), pilih jumlah thread, tekan **Mulai menambang**.
- Tanpa alamat, atau jika data blok dari mempool.space tidak bisa diambil, halaman berjalan sebagai uji kecepatan.

## Cara kerja

- Data blok terbaru diambil dari API publik mempool.space (`/api/blocks`), dicek ulang setiap 30 detik.
- Halaman menyusun blok berisi satu transaksi coinbase (tinggi blok BIP34 + extranonce) yang membayar
  subsidi blok ke alamat Anda, lalu setiap Web Worker mencoba 2³² nonce per header.
- Saat halaman dibuka, mesin hash diuji dengan menghitung ulang blok genesis Bitcoin.
- Jika hash memenuhi target, hex blok lengkap ditampilkan untuk dikirim lewat `bitcoin-cli submitblock`.

## Ekspektasi yang realistis

Browser biasa menghitung sekitar 1–10 MH/s. Dengan kesulitan jaringan sekitar 148 triliun, waktu rata-rata
menemukan satu blok adalah miliaran tahun, dan hasil rata-rata per hari jauh di bawah 1 satoshi.
Halaman ini menampilkan hitungan itu dengan angka perangkat Anda sendiri.

Jalankan hanya di perangkat Anda sendiri. Menjalankan penambang di perangkat pengunjung website tanpa
izin adalah cryptojacking.
