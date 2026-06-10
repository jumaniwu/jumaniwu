# 🚀 TUTORIAL GO-LIVE BRICKX — Dari Nol Sampai Website Online

> Untuk pemilik proyek. Domain sudah dibeli ✓. Ikuti urutan ini — jangan loncat.
> Total biaya awal: ± $5/bulan (Railway) + domain. Supabase & Vercel gratis.

---

## GAMBARAN ARSITEKTUR — HOSTING DI MANA?

| Komponen | Hosting | Biaya | Alamat nanti |
|---|---|---|---|
| Database | **Supabase** | Gratis | (internal) |
| Backend API (`server.js`) | **Railway** | ± $5/bln | `api.domainanda.com` |
| Landing page | **Vercel** | Gratis | `domainanda.com` |
| Whitelist page | **Vercel** | Gratis | `whitelist.domainanda.com` |
| Admin panel | **Vercel** (project terpisah) | Gratis | `panel-xyz123.domainanda.com` (rahasia) |
| Aplikasi React (platform) | **Vercel** | Gratis | `app.domainanda.com` |

Urutan pengerjaan WAJIB: **Database → Backend → Frontend → Domain → Tes**.

---

## LANGKAH 1 — DATABASE (Supabase) · ±15 menit

1. Buka https://supabase.com → **Start your project** → daftar pakai GitHub.
2. **New project**:
   - Name: `brickx`
   - Database Password: buat yang kuat, **simpan di tempat aman**
   - Region: `Southeast Asia (Singapore)`
3. Tunggu ±2 menit sampai project siap.
4. Menu kiri → **SQL Editor** → **New query** → copy-paste SELURUH isi file
   `brickx/backend/database-schema.sql` → klik **Run**.
5. Cek menu **Table Editor**: harus ada 11 tabel, dan tabel `properties` berisi
   1 baris "Project Hotel Batam".
6. Cek ikon gembok/RLS aktif di semua tabel (sudah otomatis dari schema).
7. Menu **Settings → API**, catat 2 nilai ini (dipakai di Langkah 2):
   - `Project URL` → ini `SUPABASE_URL`
   - `service_role` key (klik Reveal) → ini `SUPABASE_SERVICE_KEY`
   ⚠️ **service_role key = kunci master. Jangan pernah ditaruh di frontend
   atau dibagikan ke siapa pun.**

---

## LANGKAH 2 — BACKEND API (Railway) · ±30 menit

1. Buka https://railway.app → daftar pakai GitHub.
2. **New Project → Deploy from GitHub repo** → pilih repo Anda
   (`jumaniwu/jumaniwu`).
3. Setelah service dibuat, klik service → **Settings**:
   - **Root Directory**: `brickx/backend`
   - **Start Command**: `node server.js`
4. `package.json` sudah disediakan di `brickx/backend/package.json` —
   Railway akan otomatis menjalankan `npm install`. Tidak perlu buat apa-apa.
5. Tab **Variables** → isi env (lihat `brickx/ENV_TEMPLATE.env`). Minimal WAJIB:
   ```
   NODE_ENV=production
   FRONTEND_URL=https://domainanda.com
   SUPABASE_URL=(dari Langkah 1)
   SUPABASE_SERVICE_KEY=(dari Langkah 1)
   JWT_SECRET=(string acak panjang — generate di https://generate-secret.vercel.app/32)
   ```
   Lalu isi juga saat sudah punya: `RESEND_API_KEY` (email — daftar gratis di
   resend.com), `SUMSUB_*` (KYC), `TREASURY_USDT_POLYGON` dan
   `TREASURY_USDC_POLYGON` (alamat dompet penerima dana — **gunakan multisig
   Gnosis Safe, bukan dompet pribadi!**).
   > Server sengaja MATI saat start jika JWT_SECRET / SUPABASE_URL /
   > SUPABASE_SERVICE_KEY kosong. Itu pengaman, bukan error.
6. Railway akan auto-deploy. Tab **Settings → Networking → Generate Domain**
   untuk dapat URL sementara, misal `brickx-api-production.up.railway.app`.
7. **TES**: buka `https://URL-railway-anda/api/health` di browser.
   Harus muncul `"status":"ok"` dan `"db":"ok"`. Kalau `db:error`, cek
   SUPABASE_URL/KEY.

---

## LANGKAH 3 — FRONTEND (Vercel) · ±30 menit

Daftar dulu di https://vercel.com pakai GitHub.

### 3a. Landing page (situs utama)
1. **Add New → Project** → import repo Anda.
2. **Root Directory**: `brickx/frontend` · Framework: **Other** · tanpa build command.
3. Sebelum deploy, edit `brickx/frontend/landing-page.html`: tambahkan tepat
   sebelum `</head>`:
   ```html
   <script>window.BRICKX_API_URL='https://URL-railway-anda';</script>
   ```
   (ganti dengan URL Railway dari Langkah 2 — nanti diganti `https://api.domainanda.com` setelah Langkah 4)
4. File `brickx/frontend/vercel.json` sudah disediakan: domain utama otomatis
   membuka landing page. **Edit satu hal**: ganti `whitelist.domainanda.com`
   di dalamnya dengan subdomain whitelist Anda yang sebenarnya.
5. Deploy. Tes URL `.vercel.app`-nya: angka progress seed harus tampil
   (bukan "—") dan form email berfungsi.

### 3b. Whitelist page
Tidak perlu project terpisah — cukup tambahkan domain
`whitelist.domainanda.com` ke project yang sama (Langkah 4). `vercel.json`
sudah mengarahkan host whitelist ke `/whitelist-page.html` otomatis.

### 3c. Admin panel — RAHASIA
Project Vercel ke-3. **Jangan pakai nama subdomain yang mudah ditebak** —
gunakan mis. `panel-x7k2m9` (bukan `admin`). Rewrite `/` → `/admin-panel.html`.
Login hanya bisa dengan akun `is_admin = true`. Cara buat admin pertama:
1. Daftar akun biasa lewat situs/API.
2. Buka Supabase → Table Editor → `users` → cari email Anda → set
   `is_admin` = `true`.

### 3d. Aplikasi React (platform) — boleh belakangan
Perlu build Vite (bukan file statis). Di komputer Anda:
```bash
npm create vite@latest brickx-app -- --template react
cd brickx-app && npm install recharts
# copy brickx/frontend/platform-app.jsx → src/App.jsx
npm run build        # hasilnya folder dist/
```
Deploy folder itu sebagai project Vercel ke-4 (framework: Vite).
Untuk launch whitelist/seed, langkah 3a–3c sudah cukup; 3d menyusul
sebelum pembelian ICO dibuka.

---

## LANGKAH 4 — SAMBUNGKAN DOMAIN ANDA · ±20 menit (+ tunggu DNS)

### 4a. Domain utama → landing page
1. Di Vercel project landing → **Settings → Domains → Add** →
   ketik `domainanda.com` (dan `www.domainanda.com`).
2. Vercel menampilkan record DNS yang harus dibuat. Buka dashboard tempat
   Anda beli domain (Namecheap/GoDaddy/Niagahoster dll) → menu **DNS**:
   - Type `A`, Host `@`, Value `76.76.21.21`
   - Type `CNAME`, Host `www`, Value `cname.vercel-dns.com`
3. Subdomain whitelist: di project whitelist → Add Domain
   `whitelist.domainanda.com` → tambah `CNAME whitelist → cname.vercel-dns.com`.
4. Admin: Add Domain `panel-x7k2m9.domainanda.com` → CNAME serupa.

### 4b. Subdomain API → Railway
1. Railway → service backend → **Settings → Networking → Custom Domain** →
   masukkan `api.domainanda.com`.
2. Railway memberi target CNAME → tambahkan di DNS:
   `CNAME api → (nilai dari Railway)`.
3. Setelah aktif: ganti semua `window.BRICKX_API_URL` di halaman frontend
   menjadi `https://api.domainanda.com`, dan ubah env `FRONTEND_URL` di
   Railway menjadi `https://domainanda.com` (penting untuk CORS!).
4. DNS butuh 5 menit – 24 jam untuk menyebar. SSL/HTTPS otomatis dari
   Vercel & Railway — tidak perlu beli sertifikat.

---

## LANGKAH 5 — TES AKHIR SEBELUM PROMOSI

- [ ] `https://api.domainanda.com/api/health` → `db: ok`
- [ ] `https://domainanda.com` terbuka dengan HTTPS, angka seed tampil
- [ ] Form whitelist → muncul toast sukses → email konfirmasi masuk
- [ ] `https://whitelist.domainanda.com` → daftar → dapat kode referral asli
- [ ] Admin panel → login akun admin → dashboard menampilkan angka live
- [ ] Tidak ada nama hotel asli di halaman mana pun (hanya "Project Hotel
      Batam (Confidential)")
- [ ] Semua teks dividen = TAHUNAN (Juni, 70% NOI) — tidak ada "monthly"

---

## BIAYA BULANAN

| Layanan | Paket | Biaya |
|---|---|---|
| Supabase | Free (→ Pro $25 setelah >100 user aktif) | $0 |
| Railway | Hobby | ± $5 |
| Vercel | Hobby (4 project) | $0 |
| Resend (email) | Free 3.000 email/bln | $0 |
| **Total awal** | | **± $5/bulan** |

---

## ⚠️ JANGAN LAKUKAN INI

1. **Jangan deploy smart contract ke mainnet** sebelum dites di testnet Amoy
   dan **diaudit profesional** (CertiK/Hacken). Launch whitelist TIDAK butuh
   kontrak — itu Phase berikutnya.
2. **Jangan pakai dompet pribadi sebagai treasury** — wajib multisig
   (safe.global, 2-of-3 minimal).
3. **Jangan tempel `service_role` key Supabase di frontend** — hanya di
   Railway Variables.
4. **Jangan sebarkan URL admin panel** — dan jangan pakai subdomain `admin`.

---

## URUTAN LAUNCH YANG DISARANKAN

1. **Minggu ini**: Langkah 1–5 → landing + whitelist live → kumpulkan email.
2. **Sebelum seed sale dibuka**: aktifkan Sumsub (KYC), Resend (email),
   siapkan treasury multisig, build & deploy aplikasi React (3d).
3. **Phase 2 (setelah ICO)**: kontrak ke Amoy testnet → audit → mainnet.
