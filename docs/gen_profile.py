from weasyprint import HTML, CSS

css = CSS(string="""
@page { size: A4; margin: 2cm; }
* { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
body { color: #1A1A2E; font-size: 11pt; line-height: 1.6; }
.cover { background: #1B6B6B; color: white; padding: 60px 40px; min-height: 200px; border-radius: 8px; margin-bottom: 30px; }
.cover h1 { font-size: 36pt; font-weight: 900; letter-spacing: 2px; }
.cover p { font-size: 13pt; margin-top: 10px; opacity: 0.9; }
.cover .tagline { font-size: 11pt; margin-top: 20px; background: rgba(255,255,255,0.15); padding: 10px 16px; border-radius: 6px; display: inline-block; }
h2 { color: #1B6B6B; font-size: 16pt; margin: 24px 0 10px; border-left: 4px solid #1B6B6B; padding-left: 12px; }
h3 { color: #134F4F; font-size: 12pt; margin: 14px 0 6px; }
p { margin-bottom: 8px; }
.two-col { display: flex; gap: 20px; margin-bottom: 16px; }
.col { flex: 1; }
.card { background: #F8FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.card h3 { color: #1B6B6B; margin-top: 0; }
.stat-row { display: flex; gap: 12px; margin: 16px 0; }
.stat { background: #1B6B6B; color: white; border-radius: 8px; padding: 16px; flex: 1; text-align: center; }
.stat .num { font-size: 22pt; font-weight: 900; }
.stat .lbl { font-size: 9pt; opacity: 0.85; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th { background: #1B6B6B; color: white; padding: 8px 12px; text-align: left; font-size: 10pt; }
td { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 10pt; }
tr:nth-child(even) td { background: #F8FAFB; }
.badge { display: inline-block; background: #E8F5F5; color: #1B6B6B; border-radius: 4px; padding: 2px 8px; font-size: 9pt; font-weight: bold; margin: 2px; }
.footer { margin-top: 40px; text-align: center; color: #9CA3AF; font-size: 9pt; border-top: 1px solid #E5E7EB; padding-top: 14px; }
ul { padding-left: 20px; margin: 6px 0; }
li { margin-bottom: 4px; font-size: 10.5pt; }
""")

html_content = """
<html><body>

<div class="cover">
  <h1>GRIYAKU</h1>
  <p><strong>Platform Investasi Properti Fraksional Berbasis Blockchain</strong></p>
  <p style="margin-top:8px;font-size:10pt;">Powered by Polygon PoS &nbsp;|&nbsp; React Native &nbsp;|&nbsp; Node.js + PostgreSQL</p>
  <div class="tagline">Investasi properti mulai IDR 10.000 — Milik kamu, tercatat di blockchain.</div>
</div>

<h2>Tentang GRIYAKU</h2>
<p>GRIYAKU adalah platform investasi properti fraksional digital yang memungkinkan siapa saja berinvestasi di properti premium Indonesia mulai dari IDR 10.000. Kepemilikan dicatat sebagai token ERC-20 di blockchain Polygon, memastikan transparansi, keamanan, dan likuiditas tinggi.</p>
<p>Setiap bulan, pendapatan sewa dari properti didistribusikan secara proporsional kepada seluruh pemegang token — otomatis, transparan, dan terverifikasi on-chain.</p>

<h2>Visi &amp; Misi</h2>
<div class="two-col">
  <div class="card col">
    <h3>Visi</h3>
    <p>Menjadi platform investasi properti fraksional terpercaya di Asia Tenggara, membuka akses kepemilikan properti bagi semua kalangan masyarakat.</p>
  </div>
  <div class="card col">
    <h3>Misi</h3>
    <ul>
      <li>Demokratisasi investasi properti dengan modal minimum</li>
      <li>Transparansi penuh via teknologi blockchain</li>
      <li>Distribusi hasil sewa otomatis &amp; tepat waktu</li>
      <li>Ekosistem investasi yang aman dan terdaftar</li>
    </ul>
  </div>
</div>

<h2>Keunggulan Platform</h2>
<div class="stat-row">
  <div class="stat"><div class="num">IDR 10rb</div><div class="lbl">Modal Minimum</div></div>
  <div class="stat"><div class="num">ERC-20</div><div class="lbl">Token Blockchain</div></div>
  <div class="stat"><div class="num">9%</div><div class="lbl">ERY Tahunan</div></div>
  <div class="stat"><div class="num">Polygon</div><div class="lbl">Network</div></div>
</div>

<h2>Properti Perdana</h2>
<table>
  <tr><th>Nama Properti</th><th>Lokasi</th><th>Total Token</th><th>Harga/Token</th><th>ERY</th><th>ECA</th></tr>
  <tr><td>Villa Griyaku Canggu</td><td>Canggu, Bali</td><td>1.474.515</td><td>IDR 10.000</td><td>9%</td><td>2%</td></tr>
  <tr><td>Casa Nusantara</td><td>Seminyak, Bali</td><td>706.912</td><td>IDR 10.000</td><td>9%</td><td>1.5%</td></tr>
  <tr><td>Griya Lestari</td><td>Ubud, Bali</td><td>500.000</td><td>IDR 10.000</td><td>8.5%</td><td>2%</td></tr>
</table>
<p style="font-size:9pt;color:#6B7280;">ERY = Expected Rental Yield &nbsp;|&nbsp; ECA = Expected Capital Appreciation</p>

<h2>Fitur Utama Aplikasi</h2>
<div class="two-col">
  <div class="col">
    <div class="card">
      <h3>Investasi Fraksional</h3>
      <p>Beli token properti sesuai kemampuan. Tidak perlu modal ratusan juta — cukup IDR 10.000 per token.</p>
    </div>
    <div class="card">
      <h3>Distribusi Hasil Sewa</h3>
      <p>Setiap bulan hasil sewa dibagi proporsional ke semua pemegang token, otomatis via smart contract.</p>
    </div>
    <div class="card">
      <h3>Secondary Market</h3>
      <p>Jual atau swap token antar properti kapan saja melalui marketplace peer-to-peer.</p>
    </div>
  </div>
  <div class="col">
    <div class="card">
      <h3>Transparansi Blockchain</h3>
      <p>Semua transaksi tercatat permanen di Polygon PoS. Verifikasi langsung di Polygonscan.</p>
    </div>
    <div class="card">
      <h3>Program Referral</h3>
      <p>Ajak teman dan dapatkan 1% cashback dari setiap pembelian pertama mereka.</p>
    </div>
    <div class="card">
      <h3>Laporan Yield</h3>
      <p>Pantau riwayat penerimaan sewa bulanan per properti lengkap dengan Transaction ID.</p>
    </div>
  </div>
</div>

<h2>Tech Stack</h2>
<div class="two-col">
  <div class="col">
    <h3>Mobile App</h3>
    <span class="badge">React Native</span><span class="badge">Expo SDK 51</span><span class="badge">Expo Router v3</span><span class="badge">Zustand</span><span class="badge">TanStack Query</span><span class="badge">ethers.js v6</span><span class="badge">Socket.io</span>
    <h3 style="margin-top:14px;">Backend</h3>
    <span class="badge">Node.js</span><span class="badge">Express</span><span class="badge">TypeScript</span><span class="badge">Prisma ORM</span><span class="badge">PostgreSQL</span><span class="badge">JWT Auth</span>
  </div>
  <div class="col">
    <h3>Smart Contracts</h3>
    <span class="badge">Solidity 0.8.24</span><span class="badge">Hardhat</span><span class="badge">OpenZeppelin v5</span><span class="badge">ERC-20</span><span class="badge">Polygon PoS</span>
    <h3 style="margin-top:14px;">Smart Contract Modules</h3>
    <ul>
      <li><strong>PropertyToken</strong> — ERC-20 per properti</li>
      <li><strong>PropertyFactory</strong> — Deploy token baru</li>
      <li><strong>YieldDistributor</strong> — Distribusi sewa batch</li>
      <li><strong>Marketplace</strong> — P2P secondary market (fee 0.5%)</li>
    </ul>
  </div>
</div>

<h2>Model Bisnis</h2>
<table>
  <tr><th>Sumber Pendapatan</th><th>Mekanisme</th></tr>
  <tr><td>Platform Fee Marketplace</td><td>0.5% dari setiap transaksi secondary market</td></tr>
  <tr><td>Management Fee</td><td>Fee pengelolaan properti dari pendapatan sewa</td></tr>
  <tr><td>Listing Fee</td><td>Biaya onboarding properti baru ke platform</td></tr>
  <tr><td>Cashback Program</td><td>1% cashback untuk referrer dari first purchase</td></tr>
</table>

<h2>Arsitektur Sistem</h2>
<div class="card">
  <p><strong>Mobile App (React Native)</strong> → berkomunikasi dengan <strong>Backend API (Node.js/Express)</strong> via HTTPS REST + WebSocket (Socket.io untuk real-time activity feed)</p>
  <p style="margin-top:8px;"><strong>Backend</strong> → menyimpan data di <strong>PostgreSQL</strong> via Prisma ORM, dan berinteraksi dengan <strong>Polygon Blockchain</strong> via ethers.js + Alchemy RPC</p>
  <p style="margin-top:8px;"><strong>Smart Contracts</strong> → deployed di Polygon PoS mainnet, mengelola token kepemilikan &amp; distribusi yield secara on-chain dan trustless</p>
</div>

<h2>Roadmap</h2>
<table>
  <tr><th>Phase</th><th>Target</th><th>Fitur</th></tr>
  <tr><td>Phase 1</td><td>Q2 2026</td><td>MVP Launch — 3 properti Bali, Auth, Invest, Yield</td></tr>
  <tr><td>Phase 2</td><td>Q3 2026</td><td>KYC Integration, Secondary Market, Notifikasi Push</td></tr>
  <tr><td>Phase 3</td><td>Q4 2026</td><td>Ekspansi properti Jakarta &amp; Surabaya, Oracle IDR/MATIC</td></tr>
  <tr><td>Phase 4</td><td>Q1 2027</td><td>Ekspansi ke Malaysia &amp; Singapura, Governance Token</td></tr>
</table>

<div class="footer">
  <p><strong>GRIYAKU</strong> — Platform Investasi Properti Fraksional</p>
  <p>griyaku.app &nbsp;|&nbsp; Powered by Polygon Blockchain &nbsp;|&nbsp; &copy; 2026 GRIYAKU</p>
</div>

</body></html>
"""

HTML(string=html_content).write_pdf("/home/user/jumaniwu/docs/GRIYAKU_App_Profile.pdf", stylesheets=[css])
print("App Profile PDF created!")
