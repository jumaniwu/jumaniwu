# BRICKX — Action Items (hal yang HARUS dilakukan manual)

Semua pekerjaan kode sudah selesai & ter-push ke branch `BrickX-protocol`.
Daftar ini hanya berisi aksi config/dashboard/DNS yang tidak bisa dikerjakan dari kode.

Verifikasi cepat backend kapan saja: buka `https://api.brickxprotocol.io/api/health`
→ harus `{"status":"ok","db":"ok","email":"configured|console-only"}`.

---

## A. SEKARANG — biar registrasi + email jalan penuh

1. **Pastikan semua service ter-redeploy** (auto dari branch `BrickX-protocol`):
   - Railway (backend) · Vercel: landing, app, whitelist, docs. Cek timestamp deploy
     terbaru ada SETELAH push terakhir. Kalau tidak auto, klik Redeploy.

2. **Email (Resend)** — supaya OTP/welcome/payment email terkirim beneran:
   - Daftar di resend.com → buat API key.
   - Resend → Domains → add `brickxprotocol.io` → tambahkan record **TXT (SPF)** +
     **CNAME (DKIM)** yang diberikan ke Namecheap (Advanced DNS) → klik **Verify**.
   - Railway (backend) → Variables: `RESEND_API_KEY=re_xxx`,
     `EMAIL_FROM=noreply@brickxprotocol.io` → redeploy.
   - Verifikasi: `/api/health` → `"email":"configured"`.
   - Sebelum diset: kode OTP muncul di **log Railway** (`[OTP][dev] code is ...`).

3. **Treasury wallet** (Railway env) — supaya auto-deteksi pembayaran kredit ke alamat benar:
   `TREASURY_USDT_POLYGON`, `TREASURY_USDC_POLYGON`, `TREASURY_ETH`, `TREASURY_BNB`
   (disarankan multisig Gnosis Safe, bukan wallet pribadi).

---

## B. SEBELUM SALE DIBUKA (TGE)

4. **Smart contracts → deploy testnet** (jalankan di komputermu, bukan dari sini):
   ```bash
   cd brickx/contracts
   npm install
   cp .env.example .env          # isi PRIVATE_KEY (wallet testnet) + RPC
   npm test                      # cek wiring (harus hijau)
   npm run deploy:amoy           # deploy ke Polygon Amoy
   ```
   - Salin 4 alamat hasil deploy ke **Railway env** + **Admin Panel → Settings**:
     `BRX_TOKEN_ADDRESS`, `BRICK_TOKEN_ADDRESS`, `ICO_VAULT_ADDRESS`, `YIELD_DISTRIBUTOR_ADDRESS`.
   - Test di Amoy: buyWithUSDC/USDT, vesting release after cliff, distributeAnnual, emergency pause.

5. **KYC (Sumsub)** — Railway env: `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`,
   `SUMSUB_WEBHOOK_SECRET`. Di dashboard Sumsub set webhook URL ke
   `https://api.brickxprotocol.io/api/kyc/webhook`. Sebelum ini, halaman KYC tampil
   "not available yet".

6. **Telegram bot → deploy** (kode siap):
   - Railway service baru, **Root Directory: `brickx/bot`**.
   - Env: `TELEGRAM_BOT_TOKEN` (dari @BotFather), `TELEGRAM_CHANNEL_ID=@BRICKXProtocol`,
     `ADMIN_TELEGRAM_IDS` (id numerik, dari @userinfobot), `BRICKX_API_URL`.
   - Tambahkan bot sebagai **admin** channel agar post otomatis jalan. (detail: `bot/README.md`)

7. **Smoke test alur penuh** di staging: register → OTP (dari email/log) → login →
   set wallet → KYC (Sumsub sandbox) → buy BRX → kirim USDT/USDC test di Polygon →
   order auto-confirm (~6 mnt) → admin confirm + cek dashboard.

8. **(Opsional) Jalankan test backend**: `cd brickx/backend && npm install && npm test`.

---

## C. SEBELUM MAINNET / PHASE 2

9. **Audit smart contract profesional (CertiK/Hacken)** — WAJIB sebelum mainnet.
10. **Owner setiap kontrak = Gnosis Safe multisig** (bukan EOA). Treasury juga multisig.
11. Set alamat kontrak **mainnet** + USDC/USDT asli (`USDC_ADDRESS`/`USDT_ADDRESS`) di `.env`
    contracts, lalu `npm run deploy:polygon`.
12. Phase 2: uji marketplace BRICK, snapshot Des 31, distribusi dividend USDC otomatis
    (butuh kontrak ter-deploy).

---

## Catatan
- Supabase: registrasi sudah jalan ✅. Pastikan `migration-001-dynamic-rounds.sql` juga
  sudah dijalankan (dibutuhkan fitur sale schedule/rounds & countdown).
- "DNS Change Recommended" di Vercel (docs/panel) = opsional; record lama tetap jalan.
