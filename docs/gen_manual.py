from weasyprint import HTML, CSS

css = CSS(string="""
@page { size: A4; margin: 2cm; }
* { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
body { color: #1A1A2E; font-size: 11pt; line-height: 1.6; }
.cover { background: linear-gradient(135deg,#1B6B6B,#134F4F); color: white; padding: 60px 40px; border-radius: 8px; margin-bottom: 30px; }
.cover h1 { font-size: 32pt; font-weight: 900; }
.cover h2 { font-size: 16pt; font-weight: 400; margin-top: 8px; opacity: 0.9; }
.cover p { font-size: 10pt; margin-top: 20px; opacity: 0.75; }
h2 { color: #1B6B6B; font-size: 15pt; margin: 28px 0 10px; border-bottom: 2px solid #E8F5F5; padding-bottom: 6px; }
h3 { color: #134F4F; font-size: 12pt; margin: 16px 0 6px; }
h4 { color: #1B6B6B; font-size: 11pt; margin: 12px 0 4px; }
p { margin-bottom: 8px; font-size: 10.5pt; }
.step { display: flex; gap: 16px; margin-bottom: 16px; align-items: flex-start; }
.step-num { background: #1B6B6B; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13pt; flex-shrink: 0; }
.step-body h4 { margin-top: 2px; }
.tip { background: #E8F5F5; border-left: 4px solid #1B6B6B; padding: 10px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; font-size: 10pt; }
.warn { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; font-size: 10pt; }
.screen-box { background: #F8FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; margin: 10px 0; }
.screen-box .label { font-size: 9pt; color: #9CA3AF; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
ul, ol { padding-left: 20px; margin: 8px 0; }
li { margin-bottom: 5px; font-size: 10.5pt; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th { background: #1B6B6B; color: white; padding: 8px 12px; text-align: left; font-size: 10pt; }
td { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 10pt; }
tr:nth-child(even) td { background: #F8FAFB; }
.toc-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #E5E7EB; font-size: 10.5pt; }
.toc-item span { color: #1B6B6B; font-weight: bold; }
.footer { margin-top: 40px; text-align: center; color: #9CA3AF; font-size: 9pt; border-top: 1px solid #E5E7EB; padding-top: 14px; }
.divider { height: 1px; background: #E5E7EB; margin: 20px 0; }
.icon { font-size: 18pt; margin-right: 6px; }
""")

html = """<html><body>

<div class="cover">
  <h1>GRIYAKU</h1>
  <h2>Buku Panduan Pengguna (User Manual)</h2>
  <p>Versi 1.0 &nbsp;|&nbsp; April 2026 &nbsp;|&nbsp; griyaku.app</p>
</div>

<h2>Daftar Isi</h2>
<div class="toc-item"><div>1. Pendaftaran Akun</div><span>hal. 1</span></div>
<div class="toc-item"><div>2. Login &amp; Keamanan Akun</div><span>hal. 1</span></div>
<div class="toc-item"><div>3. Beranda (Home Dashboard)</div><span>hal. 2</span></div>
<div class="toc-item"><div>4. Menjelajahi Properti (Marketplace)</div><span>hal. 2</span></div>
<div class="toc-item"><div>5. Detail Properti &amp; Cara Investasi</div><span>hal. 3</span></div>
<div class="toc-item"><div>6. Melihat Portofolio Aset</div><span>hal. 3</span></div>
<div class="toc-item"><div>7. Laporan Hasil Sewa (Yield Reports)</div><span>hal. 4</span></div>
<div class="toc-item"><div>8. Jual &amp; Tukar Token (Sell &amp; Swap)</div><span>hal. 4</span></div>
<div class="toc-item"><div>9. Penarikan Dana (Withdrawal)</div><span>hal. 5</span></div>
<div class="toc-item"><div>10. Program Referral</div><span>hal. 5</span></div>
<div class="toc-item"><div>11. Riwayat Transaksi</div><span>hal. 6</span></div>
<div class="toc-item"><div>12. Pengaturan Profil &amp; Akun</div><span>hal. 6</span></div>
<div class="toc-item"><div>13. Blockchain &amp; Wallet</div><span>hal. 7</span></div>
<div class="toc-item"><div>14. FAQ &amp; Troubleshooting</div><span>hal. 7</span></div>

<div class="divider"></div>

<h2>1. Pendaftaran Akun</h2>
<p>Buat akun GRIYAKU gratis untuk mulai berinvestasi properti.</p>

<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><h4>Buka Aplikasi GRIYAKU</h4><p>Tap tombol <strong>Register Now</strong> di halaman Welcome.</p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><h4>Isi Data Diri</h4>
    <ul>
      <li><strong>Username</strong> — minimal 3 karakter, unik</li>
      <li><strong>Email</strong> — alamat email aktif</li>
      <li><strong>Password</strong> — minimal 8 karakter</li>
      <li><strong>Konfirmasi Password</strong></li>
      <li><strong>Kode Referral</strong> (opsional) — masukkan kode teman jika ada</li>
    </ul>
  </div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-body"><h4>Setujui Syarat &amp; Ketentuan</h4><p>Baca dan scroll hingga bawah halaman Terms of Service, lalu tap <strong>I Agree</strong>.</p></div>
</div>
<div class="step">
  <div class="step-num">4</div>
  <div class="step-body"><h4>Verifikasi Email</h4><p>Cek inbox email kamu dan masukkan kode OTP 6 digit untuk mengaktifkan akun.</p></div>
</div>

<div class="tip">✅ <strong>Info:</strong> Saat pendaftaran, GRIYAKU otomatis membuat Polygon wallet untukmu. Alamat wallet ini digunakan untuk mencatat kepemilikan token properti di blockchain.</div>

<h2>2. Login &amp; Keamanan Akun</h2>
<h3>Login dengan Email</h3>
<ol>
  <li>Buka app, tap <strong>Login</strong> di halaman Welcome</li>
  <li>Masukkan <strong>Email</strong> dan <strong>Password</strong></li>
  <li>Tap <strong>Login</strong></li>
</ol>

<h3>Login Sosial (Google / Facebook / Apple)</h3>
<p>Tap icon Google, Facebook, atau Apple di halaman Welcome untuk login tanpa password.</p>

<div class="warn">⚠️ <strong>Keamanan:</strong> Jangan bagikan password atau kode OTP kepada siapapun, termasuk tim GRIYAKU. GRIYAKU tidak pernah meminta password melalui WhatsApp atau telepon.</div>

<h2>3. Beranda (Home Dashboard)</h2>
<div class="screen-box">
  <div class="label">Tampilan Utama</div>
  <ul>
    <li><strong>Saldo Saya</strong> — saldo IDR yang tersedia untuk investasi. Tap ikon mata untuk sembunyikan.</li>
    <li><strong>Nilai Properti</strong> — total nilai token yang kamu miliki saat ini</li>
    <li><strong>Total Pendapatan</strong> — akumulasi hasil sewa yang sudah diterima</li>
    <li><strong>Nilai Akun</strong> — saldo + nilai properti + pendapatan</li>
  </ul>
</div>

<h3>Quick Actions</h3>
<table>
  <tr><th>Tombol</th><th>Fungsi</th></tr>
  <tr><td>Asset Overview</td><td>Lihat semua properti yang kamu miliki</td></tr>
  <tr><td>Yield Reports</td><td>Riwayat penerimaan hasil sewa bulanan</td></tr>
  <tr><td>Referral Code</td><td>Bagikan kode referral &amp; cek komisi</td></tr>
  <tr><td>Balance Withdrawal</td><td>Tarik saldo ke rekening bank</td></tr>
</table>

<p>Scroll ke bawah untuk melihat <strong>Running Out Soon</strong> (properti hampir habis token-nya) dan <strong>Featured Property</strong>.</p>

<h2>4. Menjelajahi Properti (Marketplace)</h2>
<p>Tap tab <strong>Marketplace</strong> (ikon tengah, sedikit lebih tinggi) untuk melihat semua properti yang tersedia.</p>

<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><h4>Cari Properti</h4><p>Gunakan <strong>Search Bar</strong> di bagian atas untuk cari berdasarkan nama properti atau kota.</p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><h4>Baca Informasi Properti</h4>
    <ul>
      <li><strong>ERY (Expected Rental Yield)</strong> — estimasi imbal hasil sewa per tahun (%)</li>
      <li><strong>ARY (Actual Rental Yield)</strong> — imbal hasil sewa aktual yang sudah terjadi (%)</li>
      <li><strong>Progress Bar</strong> — menunjukkan berapa token yang sudah terjual</li>
      <li>Badge <strong>Running Out Soon</strong> — tersisa kurang dari 100 token</li>
    </ul>
  </div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-body"><h4>Tap Properti</h4><p>Tap kartu properti atau tombol <strong>Invest Now</strong> untuk lihat detail lengkap.</p></div>
</div>

<h2>5. Detail Properti &amp; Cara Investasi</h2>
<h3>Informasi di Halaman Detail</h3>
<ul>
  <li>Galeri foto properti (swipe untuk lihat semua foto)</li>
  <li>Spesifikasi: kamar tidur, kamar mandi, luas (m²), tipe properti</li>
  <li>Progress token: tersisa X dari Y token</li>
  <li><strong>ERY</strong> &amp; <strong>ECA</strong> (Expected Capital Appreciation) tahunan</li>
  <li>Simulator investasi: estimasi pendapatan jika beli N token</li>
  <li>Top Token Holders (10 investor terbesar)</li>
  <li>Grafik Yield bulanan</li>
  <li>Sections: Details | Financials | Documents | Market | Timeline | Blockchain</li>
</ul>

<h3>Cara Membeli Token</h3>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><h4>Tap tombol Invest</h4><p>Tap tombol <strong>Invest</strong> (hijau) di bagian bawah halaman detail properti.</p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><h4>Tentukan Jumlah Token</h4><p>Gunakan tombol <strong>+</strong> / <strong>−</strong> atau ketik langsung jumlah token yang ingin dibeli. Total biaya akan dihitung otomatis.</p></div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-body"><h4>Konfirmasi Pembelian</h4><p>Periksa total biaya dan tap <strong>Confirm Investment</strong>. Dana akan dipotong dari saldo IDR kamu.</p></div>
</div>
<div class="step">
  <div class="step-num">4</div>
  <div class="step-body"><h4>Pembelian Berhasil</h4><p>Token langsung muncul di portofolio. Transaksi tercatat di blockchain Polygon.</p></div>
</div>

<div class="tip">💡 <strong>Tips:</strong> Gunakan simulator investasi sebelum membeli untuk memperkirakan hasil sewa bulanan yang akan kamu terima.</div>

<h2>6. Melihat Portofolio Aset (Asset Overview)</h2>
<p>Tap <strong>Asset Overview</strong> dari Quick Actions di beranda untuk melihat semua token yang kamu miliki.</p>

<div class="screen-box">
  <div class="label">Info setiap properti</div>
  <ul>
    <li><strong>Total Token</strong> yang dimiliki + persentase kepemilikan</li>
    <li><strong>Locked Tokens</strong> — token yang sedang dalam proses transaksi (tidak bisa dijual)</li>
    <li><strong>Token Tersedia</strong> — token yang bisa dijual atau di-swap</li>
    <li><strong>Nilai Saat Ini (IDR)</strong> — estimasi nilai total token berdasarkan harga terkini</li>
    <li><strong>Last Rent Earned</strong> — hasil sewa bulan terakhir (annualized %)</li>
    <li><strong>Total Rent Earned</strong> — akumulasi semua hasil sewa yang diterima</li>
  </ul>
</div>

<p>Gunakan <strong>Search Bar</strong> di atas untuk mencari properti tertentu dari portofolio kamu.</p>

<h2>7. Laporan Hasil Sewa (Yield Reports)</h2>
<p>Tap <strong>Yield Reports</strong> dari Quick Actions untuk melihat riwayat penerimaan hasil sewa.</p>

<h3>Filter Laporan</h3>
<ul>
  <li><strong>Filter Properti</strong> — pilih "All" atau properti tertentu</li>
  <li><strong>Filter Bulan</strong> — pilih bulan (1–12)</li>
  <li><strong>Filter Tahun</strong> — pilih tahun</li>
</ul>

<div class="screen-box">
  <div class="label">Info setiap entri yield</div>
  <ul>
    <li>Nama properti + badge "Received" (hijau)</li>
    <li>Transaction ID on-chain</li>
    <li>Jumlah yang diterima (IDR)</li>
    <li>Bulan distribusi</li>
  </ul>
</div>

<h2>8. Jual &amp; Tukar Token (Sell &amp; Swap)</h2>
<h3>Jual Token (Sell)</h3>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><h4>Buka Asset Overview</h4><p>Tap <strong>Asset Overview</strong> → pilih properti yang ingin dijual.</p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><h4>Tap Sell</h4><p>Tap tombol <strong>Sell</strong> pada kartu properti. Masukkan jumlah token yang ingin dijual.</p></div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-body"><h4>Konfirmasi</h4><p>Dana penjualan akan masuk ke saldo IDR kamu dalam beberapa detik.</p></div>
</div>

<h3>Tukar Token (Swap)</h3>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><h4>Tap Swap</h4><p>Tap tombol <strong>Swap</strong> pada kartu properti di Asset Overview.</p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><h4>Pilih Properti Tujuan</h4><p>Pilih properti tujuan yang ingin kamu tukar tokennya.</p></div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-body"><h4>Tentukan Jumlah</h4><p>Masukkan jumlah token yang ingin ditukar, lalu konfirmasi.</p></div>
</div>

<div class="warn">⚠️ <strong>Perhatian:</strong> Token yang sedang dalam status "Locked" tidak dapat dijual atau di-swap. Tunggu hingga proses selesai.</div>

<h2>9. Penarikan Dana (Withdrawal)</h2>
<p>Tarik saldo IDR dari GRIYAKU ke rekening bank kamu.</p>

<h3>Tambah Rekening Bank</h3>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><p>Dari Quick Actions → <strong>Balance Withdrawal</strong></p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><p>Tap <strong>+ Add Bank Account</strong> → isi Nama Bank, Nomor Rekening, Nama Pemilik.</p></div>
</div>

<h3>Buat Penarikan</h3>
<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><p>Tap tombol <strong>Create Withdrawal</strong> di halaman Withdrawals.</p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><p>Pilih rekening tujuan, masukkan nominal (minimum IDR 10.000).</p></div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-body"><p>Konfirmasi penarikan. Status akan berubah: <em>Pending → Processing → Completed</em>.</p></div>
</div>

<div class="tip">💡 Proses transfer bank umumnya 1–2 hari kerja setelah status berubah menjadi <em>Processing</em>.</div>

<h2>10. Program Referral</h2>
<p>Undang teman dan dapatkan komisi 1% dari setiap pembelian token pertama mereka.</p>

<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><h4>Buka Halaman Referral</h4><p>Dari Quick Actions di beranda → tap <strong>Referral Code</strong>.</p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><h4>Salin Link Referral</h4><p>Tap <strong>Copy</strong> di samping link referral kamu.</p></div>
</div>
<div class="step">
  <div class="step-num">3</div>
  <div class="step-body"><h4>Bagikan via Media Sosial</h4><p>Tap icon WhatsApp, Facebook, X, atau Share untuk bagikan langsung.</p></div>
</div>
<div class="step">
  <div class="step-num">4</div>
  <div class="step-body"><h4>Pantau Komisi</h4><p>Stats referral (total undangan &amp; cashback) ditampilkan di bagian atas halaman.</p></div>
</div>

<div class="screen-box">
  <div class="label">Top Referrers Leaderboard</div>
  <p>Tap <strong>Top Referrers</strong> di pojok kanan atas untuk melihat peringkat referrer terbaik mingguan, bulanan, atau sepanjang masa. Podium menampilkan 3 besar.</p>
</div>

<h2>11. Riwayat Transaksi</h2>
<p>Tap tab <strong>Transactions</strong> (ikon daftar) untuk melihat semua aktivitas keuangan kamu.</p>

<h3>Filter Transaksi</h3>
<table>
  <tr><th>Filter</th><th>Menampilkan</th></tr>
  <tr><td>All</td><td>Semua jenis transaksi</td></tr>
  <tr><td>Buy</td><td>Pembelian token properti</td></tr>
  <tr><td>Sell</td><td>Penjualan token properti</td></tr>
  <tr><td>Swap</td><td>Tukar token antar properti</td></tr>
  <tr><td>Rental Distribution</td><td>Penerimaan hasil sewa bulanan</td></tr>
</table>

<p>Setiap transaksi menampilkan: tipe, foto properti, jumlah IDR, status, dan Transaction ID.</p>

<h2>12. Pengaturan Profil &amp; Akun</h2>
<p>Tap tab <strong>More (···)</strong> di kanan bawah untuk mengakses pengaturan akun.</p>

<h3>Edit Profil</h3>
<ul>
  <li>Tap kartu profil di bagian atas → halaman <strong>My Profile</strong></li>
  <li>Edit username, nama lengkap, nomor telepon, tanggal lahir</li>
  <li>Tap Edit untuk ubah foto profil</li>
</ul>

<h3>Preferensi</h3>
<table>
  <tr><th>Pengaturan</th><th>Fungsi</th></tr>
  <tr><td>Language</td><td>Ganti bahasa app: Bahasa Indonesia / English</td></tr>
  <tr><td>Hide Balance</td><td>Toggle untuk sembunyikan saldo di beranda</td></tr>
  <tr><td>Security</td><td>Pengaturan keamanan akun (PIN/biometrik)</td></tr>
  <tr><td>Currency</td><td>Pilihan tampilan mata uang</td></tr>
</table>

<h3>Logout</h3>
<p>Scroll ke bawah halaman My Profile → tap tombol merah <strong>Logout</strong>.</p>

<div class="warn">⚠️ <strong>Hapus Akun:</strong> Tap link <strong>Delete Account</strong> di bagian bawah My Profile. Tindakan ini permanen dan tidak dapat dibatalkan. Pastikan semua token sudah dijual dan saldo sudah ditarik terlebih dahulu.</div>

<h2>13. Blockchain &amp; Wallet</h2>
<p>GRIYAKU otomatis membuat Polygon wallet untukmu saat pendaftaran. Kepemilikan token properti kamu tercatat on-chain di wallet ini.</p>

<div class="step">
  <div class="step-num">1</div>
  <div class="step-body"><h4>Lihat Wallet Address</h4><p>My Profile → scroll ke bawah → section <strong>Blockchain</strong> → tap untuk expand.</p></div>
</div>
<div class="step">
  <div class="step-num">2</div>
  <div class="step-body"><h4>Verifikasi di Polygonscan</h4><p>Tap alamat wallet untuk membuka <strong>Polygonscan</strong> — explorer blockchain Polygon — dan verifikasi kepemilikan token kamu secara independen.</p></div>
</div>

<div class="warn">⚠️ <strong>PERINGATAN PENTING:</strong>
  <ul style="margin-top:6px;">
    <li>JANGAN kirim cryptocurrency (MATIC, USDT, dll.) langsung ke alamat wallet GRIYAKU-mu</li>
    <li>JANGAN bagikan alamat wallet atau private key kepada siapapun</li>
    <li>Transaksi blockchain bersifat irreversible — tidak dapat dibatalkan</li>
  </ul>
</div>

<p>Untuk melihat alamat smart contract properti, buka <strong>Detail Properti</strong> → section <strong>Blockchain</strong>.</p>

<h2>14. FAQ &amp; Troubleshooting</h2>
<table>
  <tr><th>Pertanyaan</th><th>Jawaban</th></tr>
  <tr><td>Berapa minimum investasi?</td><td>IDR 10.000 per token (1 token)</td></tr>
  <tr><td>Kapan hasil sewa dibayarkan?</td><td>Setiap bulan, otomatis masuk ke saldo IDR kamu</td></tr>
  <tr><td>Apakah investasi saya aman?</td><td>Kepemilikan tercatat di blockchain — transparan &amp; tidak bisa dimanipulasi</td></tr>
  <tr><td>Bagaimana cara top up saldo IDR?</td><td>Melalui transfer bank ke rekening virtual GRIYAKU (fitur segera hadir)</td></tr>
  <tr><td>Token saya locked, kenapa?</td><td>Token terkunci sementara saat ada proses transaksi. Tunggu beberapa menit.</td></tr>
  <tr><td>Lupa password?</td><td>Tap "Forgot Password" di halaman Login → cek email untuk reset link</td></tr>
  <tr><td>Tidak menerima OTP?</td><td>Cek folder Spam/Junk email. Tap "Kirim Ulang OTP" setelah 60 detik.</td></tr>
  <tr><td>Apakah ada biaya transaksi?</td><td>Platform fee 0.5% hanya untuk transaksi di secondary market (jual ke sesama user)</td></tr>
  <tr><td>Bagaimana menghubungi support?</td><td>My Profile → bagian bawah → CS WhatsApp atau email support</td></tr>
</table>

<div class="tip">💡 <strong>Butuh Bantuan Lebih?</strong> Kunjungi seksi FAQs di app (More → FAQs) atau hubungi Customer Service GRIYAKU melalui WhatsApp yang tercantum di halaman My Profile.</div>

<div class="footer">
  <p><strong>GRIYAKU — Buku Panduan Pengguna v1.0</strong></p>
  <p>griyaku.app &nbsp;|&nbsp; &copy; 2026 GRIYAKU &nbsp;|&nbsp; Dokumen ini dapat berubah sesuai pembaruan aplikasi</p>
</div>

</body></html>"""

HTML(string=html).write_pdf("/home/user/jumaniwu/docs/GRIYAKU_Manual_Book.pdf", stylesheets=[css])
print("Manual Book PDF created!")
