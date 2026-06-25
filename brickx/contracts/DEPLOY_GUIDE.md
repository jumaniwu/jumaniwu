# BRICKX Protocol — Panduan Deploy Smart Contract (dari Nol sampai Mainnet)

Panduan ini berdasarkan project Hardhat yang **sudah ada** di `brickx/contracts/`
(bukan rencana baru) — semua command di bawah sudah diverifikasi cocok dengan
`package.json`, `scripts/deploy.js`, `hardhat.config.js`, dan `.env.example` yang
sebenarnya ada di repo.

**Status saat ini:** kontrak belum pernah di-deploy ke mana pun. Platform yang
sedang live (register/KYC/buy/payment auto-detect) **tidak butuh kontrak ini**
untuk berjalan — ICO order & konfirmasi pembayaran sekarang 100% berbasis
database (Supabase) + deteksi transfer on-chain ke wallet Safe treasury, bukan
lewat smart contract. Jadi deploy kontrak ini **tidak akan mengubah platform
yang sedang berjalan** — ini menyiapkan infrastruktur on-chain untuk Token
Generation Event (TGE) dan fase BRICK/dividend nanti.

---

## 0. Yang akan di-deploy (5 kontrak, 1 file)

Semua di `src/BRICKXContracts.sol`:

| # | Kontrak | Fungsi |
|---|---------|--------|
| 1 | `BRXToken` | ERC-20 BRX. Supply 1,000,000,000 fixed, mint sekali ke deployer, lalu minting ditutup permanen. |
| 2 | `BRXVesting` | Vesting cliff + linear untuk alokasi seed/ICO/team/partner. |
| 3 | `BRXICOVault` | Vault penjualan ICO (USDC/USDT) + KYC whitelist + lock ke vesting. |
| 4 | `BRICKToken` | Token properti, harga **$10.00 fixed**. Marketplace + fee 0.5%. |
| 5 | `YieldDistributor` | Push dividend USDC tahunan ke holder BRICK (snapshot 31 Des, bayar Juni). |

Plus `src/mocks/MockERC20.sol` — token USDC/USDT palsu, **hanya untuk
testnet/local**, ada fungsi `mint()` terbuka supaya siapa saja bisa membuat
saldo test.

---

## 1. Prasyarat

- Node.js + npm terinstall.
- Wallet terpisah khusus deploy (jangan pakai wallet pribadi yang isinya aset
  asli). Untuk testnet, wallet baru kosong juga tidak masalah.
- Untuk testnet (Polygon Amoy): isi wallet dengan **test POL** gratis dari
  faucet — https://faucet.polygon.technology (pilih network "Amoy").
- Untuk mainnet (Polygon): wallet deployer butuh sedikit **POL asli** untuk gas
  (estimasi total deploy 5 kontrak ±$3-5, tapi siapkan lebih untuk jaga-jaga
  fluktuasi gas).
- (Opsional tapi disarankan) API key Polygonscan untuk verifikasi kontrak —
  daftar gratis di https://polygonscan.com/myapikey.

⚠️ **Jangan pernah commit file `.env` ke git** — sudah di-block lewat
`.gitignore` (`node_modules`, `.env`, `cache`, `artifacts`, dll), tapi tetap
hati-hati saat copy-paste.

---

## 2. Install dependencies

```bash
cd brickx/contracts
npm install
```

Ini install `hardhat`, `@nomicfoundation/hardhat-toolbox`, dan `dotenv`.

---

## 3. Konfigurasi `.env`

```bash
cp .env.example .env
```

Lalu isi `brickx/contracts/.env`:

```env
# Private key wallet deployer (testnet wallet untuk Amoy; untuk mainnet
# sebaiknya wallet hardware/terpisah khusus deploy — bukan wallet harian).
PRIVATE_KEY=

# RPC — default sudah jalan, tapi RPC khusus (Alchemy/Infura) lebih stabil.
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_RPC_URL=https://polygon-rpc.com

# Treasury yang menerima USDC/USDT dari pembelian + hasil mint BRICK.
# Testnet: boleh dikosongkan → otomatis pakai address deployer.
# MAINNET: WAJIB diisi address Safe (multisig) — JANGAN EOA/wallet biasa.
TREASURY_ADDRESS=

# Address stablecoin asli. Testnet/local: KOSONGKAN → script otomatis
# deploy MockERC20 (USDC & USDT palsu, bisa di-mint bebas untuk testing).
# MAINNET: WAJIB diisi address asli (script akan menolak deploy tanpa ini):
#   USDC (native): 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
#   USDT:          0xc2132D05D31c914a87C6611C10748AEb04B58e8F
USDC_ADDRESS=
USDT_ADDRESS=

# Untuk verifikasi kontrak di Polygonscan (opsional tapi disarankan)
POLYGONSCAN_API_KEY=
```

---

## 4. Compile

```bash
npm run compile
```

Solidity 0.8.24, optimizer aktif (`runs: 200`), `viaIR: true` (perlu, supaya
`BRXICOVault` yang besar tidak kena error "stack too deep").

---

## 5. Jalankan test otomatis (gratis, di memory, tidak butuh testnet)

```bash
npm test
```

Test yang ada (`test/deploy.test.js`) memverifikasi: kelima kontrak deploy dan
saling terhubung dengan benar (vesting ↔ token ↔ vault ↔ brick ↔ yield), dan
total supply genesis tepat 1,000,000,000 BRX ke deployer.

---

## 6. (Opsional) Sanity check di local Hardhat node

Dua terminal terpisah:

```bash
# Terminal 1 — node lokal in-memory
npm run node

# Terminal 2 — deploy ke node lokal itu
npm run deploy:local
```

Berguna untuk coba-coba cepat sebelum pakai testnet asli (tidak butuh gas,
tidak butuh internet).

---

## 7. Deploy ke testnet — Polygon Amoy

Pastikan wallet di `PRIVATE_KEY` sudah ada test POL dari faucet, lalu:

```bash
npm run deploy:amoy
```

Script (`scripts/deploy.js`) akan, dalam satu kali jalan:

1. Karena `USDC_ADDRESS`/`USDT_ADDRESS` kosong di `.env`, otomatis deploy 2
   `MockERC20` (Mock USDC, Mock USDT, 6 desimal) sebagai pengganti stablecoin
   asli.
2. Menghitung lebih dulu address kontrak berikutnya dari nonce wallet (untuk
   menyelesaikan dependency melingkar: `BRXToken` butuh tahu address vesting +
   vault, padahal keduanya belum ada — jadi address-nya diprediksi dulu).
3. Deploy urut: `BRXToken` → `BRXVesting` → `BRXICOVault` → `BRICKToken` →
   `YieldDistributor`.
4. Menulis semua address ke `deployments/amoy.json`.
5. Print blok env siap-paste untuk Railway.

Contoh output yang akan muncul:

```
=== DEPLOYED ===
{ network: 'amoy', deployer: '0x...', treasury: '0x...', USDC: '0x...', ... }

--- Paste into Railway (backend) env ---
BRX_TOKEN_ADDRESS=0x...
BRICK_TOKEN_ADDRESS=0x...
ICO_VAULT_ADDRESS=0x...
YIELD_DISTRIBUTOR_ADDRESS=0x...
```

> Jika muncul error **"address mismatch — nonce prediction failed"**: artinya
> ada transaksi lain terkirim dari wallet deployer di antara saat nonce dibaca
> dan saat kontrak benar-benar deploy (mis. kamu kirim tx manual dari wallet
> yang sama saat script jalan). Tunggu nonce stabil, lalu jalankan ulang dari
> awal — bukan dilanjut dari tengah.

---

## 8. Test manual di testnet (checklist sebelum lanjut audit/mainnet)

Buka Hardhat console yang konek ke Amoy:

```bash
npx hardhat console --network amoy
```

Lalu (ganti `<...>` dengan address dari `deployments/amoy.json`):

```js
const [deployer] = await ethers.getSigners();
const vault = await ethers.getContractAt("BRXICOVault", "<ICO_VAULT_ADDRESS>");
const token = await ethers.getContractAt("BRXToken", "<BRX_TOKEN_ADDRESS>");
const usdc  = await ethers.getContractAt("MockERC20", "<USDC address dari deployments/amoy.json>");
const vesting = await ethers.getContractAt("BRXVesting", "<BRX_VESTING_ADDRESS>");

// 1) Buat & aktifkan seed round (angka sesuai tokenomics CLAUDE.md:
//    $0.008/BRX, target $640,000, min $100, max $50,000 per wallet)
const now = Math.floor(Date.now() / 1000);
await vault.createRound(
  8000,                              // $0.008 (USDC 6 desimal)
  ethers.parseEther("80000000"),     // 80M BRX untuk round ini
  640_000_000000n,                   // target $640,000
  100_000000n,                       // min $100
  50_000_000000n,                    // max $50,000/wallet
  now,
  now + 30 * 24 * 3600                // buka 30 hari
);
await vault.activateRound(1);

// 2) Test buyWithUSDC — mint dulu saldo test ke diri sendiri (hanya bisa di Mock)
await usdc.mint(deployer.address, ethers.parseUnits("1000", 6));
await usdc.approve(vault.target, ethers.parseUnits("1000", 6));
await vault.setKYCRequired(false);      // atau: await vault.approveKYC([deployer.address]);
await vault.buyWithUSDC(ethers.parseUnits("1000", 6));
await vault.getBuyerPurchases(deployer.address);   // harus muncul 1 purchase, ~125,000 BRX

// 3) Test distributeBatch (vault harus PUNYA saldo BRX dulu)
await token.transfer(vault.target, ethers.parseEther("200000")); // funding vault
const ids = await vault.getBuyerPurchases(deployer.address);
await vault.distributeBatch(ids);
await token.balanceOf(deployer.address); // saldo BRX bertambah sesuai alokasi

// 4) Test vesting cliff + release
await token.approve(vesting.target, ethers.parseEther("100000"));
const scheduleTx = await vesting.createSchedule(
  deployer.address, ethers.parseEther("100000"),
  1,   // cliff 1 bulan (pakai angka kecil untuk testing)
  6,   // vesting 6 bulan setelah cliff
  true, "test"
);
// sebelum cliff lewat: vesting.releasable(scheduleId) harus 0
// setelah waktu di-fast-forward (atau ditunggu di testnet asli) baru release() berhasil

// 5) Test emergency pause
await vault.pause();
// buyWithUSDC sekarang harus revert dengan "Contract paused"
await vault.unpause();
```

Checklist yang wajib lulus sebelum lanjut ke audit (sesuai
`DEPLOY_CHECKLIST.md` & catatan keamanan di `BRICKXContracts.sol`):

- [ ] `buyWithUSDC` / `buyWithUSDT` jalan, alokasi BRX terhitung benar
- [ ] Vesting: 0 sebelum cliff, linear setelah cliff, full setelah cliff+durasi
- [ ] `distributeAnnual` (YieldDistributor) — bayar holder sesuai daftar
- [ ] `pause()` / `unpause()` — pembelian benar-benar terblokir saat paused
- [ ] KYC whitelist (`approveKYC` / `kycRequired`) bekerja sesuai harapan

---

## 9. Verifikasi kontrak di Polygonscan

Ambil semua address dari `deployments/amoy.json`, lalu (urutan constructor
argument harus PERSIS seperti saat deploy):

```bash
# BRXToken(vestingAddr, vaultAddr)
npx hardhat verify --network amoy <BRX_TOKEN_ADDRESS> <BRX_VESTING_ADDRESS> <ICO_VAULT_ADDRESS>

# BRXVesting(tokenAddr)
npx hardhat verify --network amoy <BRX_VESTING_ADDRESS> <BRX_TOKEN_ADDRESS>

# BRXICOVault(treasury, usdc, usdt, tokenAddr, vestingAddr)
npx hardhat verify --network amoy <ICO_VAULT_ADDRESS> <TREASURY> <USDC> <USDT> <BRX_TOKEN_ADDRESS> <BRX_VESTING_ADDRESS>

# BRICKToken(usdc, treasury)
npx hardhat verify --network amoy <BRICK_TOKEN_ADDRESS> <USDC> <TREASURY>

# YieldDistributor(usdc, brickAddr, treasury)
npx hardhat verify --network amoy <YIELD_DISTRIBUTOR_ADDRESS> <USDC> <BRICK_TOKEN_ADDRESS> <TREASURY>
```

(Ganti `--network amoy` jadi `--network polygon` setelah mainnet deploy di
langkah 12.)

---

## 10. GATE WAJIB sebelum mainnet — Audit profesional

**Jangan deploy ke mainnet sebelum ini selesai.** Kontrak ini memegang dana
asli investor. Audit minimal dari CertiK atau Hacken. Ini bukan saran — ini
syarat go-live yang sudah tercatat di `DEPLOY_CHECKLIST.md` dan komentar
keamanan di kode kontrak itu sendiri.

---

## 11. ⚠️ Catatan penting — celah ownership 3 dari 5 kontrak

Saat membaca kode untuk panduan ini, ditemukan: **hanya `BRXICOVault`** yang
punya mekanisme pindah kepemilikan setelah deploy (`proposeOwner` +
`acceptOwnership`, two-step). `BRXToken`, `BRICKToken`, dan `YieldDistributor`
**tidak punya fungsi transfer ownership sama sekali** — `owner` mereka
terkunci permanen ke address yang melakukan deploy (dibaca dari `msg.sender`
di constructor).

Dampaknya: kalau deploy mainnet dijalankan dari private key biasa (EOA) lewat
Hardhat seperti panduan di atas, maka **3 kontrak itu owner-nya akan selamanya
EOA tersebut** — tidak bisa dipindah ke Safe multisig setelah deploy. Ini
bertentangan dengan syarat di `DEPLOY_CHECKLIST.md` & README: *"Owner of every
contract must be a Gnosis Safe multisig."*

Dua pilihan sebelum deploy mainnet (pilih salah satu, jangan diabaikan):

1. **(Disarankan)** Tambah fungsi transfer ownership (two-step, sama seperti
   yang sudah ada di `BRXICOVault`) ke `BRXToken`, `BRICKToken`, dan
   `YieldDistributor` sebelum audit — supaya semua kontrak konsisten bisa
   dipindah ke Safe setelah deploy. Ini perubahan kode kecil, bisa saya
   kerjakan kalau diminta.
2. Deploy langsung dari Safe (lewat Safe Transaction Builder / Safe SDK,
   bukan `PRIVATE_KEY` biasa di Hardhat) supaya `msg.sender` saat deploy
   sudah Safe itu sendiri sejak awal. Lebih rumit secara teknis dan di luar
   alur `scripts/deploy.js` yang sudah ada.

Beri tahu saya kalau mau opsi 1 dikerjakan — sebaiknya selesai **sebelum**
masuk audit supaya tidak audit dua kali.

---

## 12. Deploy ke Polygon Mainnet

Hanya setelah: testnet lulus semua test manual (langkah 8) **dan** audit
profesional selesai **dan** celah ownership (langkah 11) sudah diputuskan.

1. Buat Safe multisig di https://app.safe.global (network **Polygon**,
   minimal 3-of-5 pemilik) — ini wallet yang akan jadi `TREASURY_ADDRESS`
   sekaligus owner kontrak.
2. Update `.env`:
   ```env
   PRIVATE_KEY=<wallet deployer mainnet — bukan harian>
   TREASURY_ADDRESS=<address Safe Polygon kamu>
   USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
   USDT_ADDRESS=0xc2132D05D31c914a87C6611C10748AEb04B58e8F
   POLYGONSCAN_API_KEY=<key kamu>
   ```
   (Script akan **menolak** deploy ke mainnet kalau `USDC_ADDRESS`/
   `USDT_ADDRESS` kosong — tidak akan diam-diam pakai mock di mainnet.)
3. Pastikan wallet deployer ada POL asli untuk gas.
4. Deploy:
   ```bash
   npm run deploy:polygon
   ```
5. Verifikasi (langkah 9, ganti `amoy` → `polygon`).
6. Pindahkan ownership ke Safe sesuai keputusan di langkah 11 (minimal untuk
   `BRXICOVault`: `proposeOwner(<Safe address>)` dari deployer, lalu
   `acceptOwnership()` dipanggil dari Safe).

---

## 13. Setelah deploy (semua network)

1. **Funding BRX**: deployer memegang seluruh 1,000,000,000 BRX setelah
   deploy. Transfer ke `BRXVesting` (untuk alokasi cliff/vesting) dan ke
   `BRXICOVault` (supaya `distributeBatch` punya saldo untuk di-airdrop ke
   pembeli) sesuai tokenomics — **jangan kirim semua ke satu kontrak**.
2. **Buka round ICO**: `vault.createRound(...)` lalu `vault.activateRound(id)`
   — contoh angka di langkah 8.
3. **KYC**: isi whitelist (`vault.approveKYC([...])`) atau set
   `vault.setKYCRequired(false)` kalau KYC mau ditunda dulu (sama seperti
   alur off-chain yang sudah ada via `migration-005-kyc-toggle.sql`).
4. **Set 4 address di Railway** (`BRX_TOKEN_ADDRESS`, `BRICK_TOKEN_ADDRESS`,
   `ICO_VAULT_ADDRESS`, `YIELD_DISTRIBUTOR_ADDRESS`) + di Admin Panel →
   Settings. Catatan: backend (`server.js`) saat ini hanya **menyimpan**
   address ini (`CONTRACTS` object) — belum ada kode yang memanggil kontrak
   on-chain ini secara otomatis. Jadi mengisi env var ini aman, tidak
   mengubah perilaku platform yang sedang berjalan; ini menyiapkan address
   untuk fitur on-chain (TGE/distribusi) yang akan dibangun berikutnya.
5. Simpan `deployments/<network>.json` baik-baik (isinya address publik,
   bukan private key — aman untuk disimpan, tidak diblokir `.gitignore`).

---

## 14. Troubleshooting cepat

| Gejala | Sebab umum | Solusi |
|---|---|---|
| `address mismatch — nonce prediction failed` | Ada tx lain terkirim dari wallet deployer saat script jalan | Tunggu nonce stabil, ulang dari awal |
| `insufficient funds for gas` | Wallet deployer belum ada POL/test-POL | Isi dari faucet (testnet) atau transfer POL asli (mainnet) |
| `USDC_ADDRESS and USDT_ADDRESS are required on mainnet` | Lupa isi `.env` sebelum `deploy:polygon` | Isi address asli, jangan dikosongkan di mainnet |
| RPC timeout / `could not detect network` | RPC publik lagi sibuk/rate-limited | Pakai RPC khusus (Alchemy/Infura) di `AMOY_RPC_URL`/`POLYGON_RPC_URL` |
| Verifikasi Polygonscan gagal "constructor arguments mismatch" | Urutan/value argumen di command verify tidak sama persis dengan saat deploy | Cek lagi `deployments/<network>.json`, samakan urutan argumen seperti di langkah 9 |

---

## Ringkasan checklist keamanan (jangan skip)

- [ ] Semua kontrak lulus test di Amoy testnet (langkah 8)
- [ ] Audit profesional (CertiK/Hacken) — **wajib sebelum mainnet**
- [ ] Celah ownership transfer (langkah 11) sudah diputuskan & dieksekusi
- [ ] Owner setiap kontrak = Gnosis Safe multisig (bukan EOA)
- [ ] Treasury (`TREASURY_ADDRESS`) = Safe, bukan wallet pribadi
- [ ] Emergency pause sudah dites jalan
- [ ] KYC whitelist terisi sebelum round diaktifkan (kalau KYC tidak ditunda)
- [ ] Bug bounty (opsional tapi disarankan) aktif sebelum volume besar masuk
