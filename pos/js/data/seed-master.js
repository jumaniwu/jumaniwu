/* =============================================================
   SajiPOS — Data Master Contoh (Cafe & Restoran)
   ============================================================= */
window.App = window.App || {};
App.SeedMaster = (function () {
  const U = App.U, DB = App.DB;

  /* ---------------- Bagan Akun (COA) ---------------- */
  const COA = [
    ['1-00000','ASET','asset',1],
    ['1-10001','Kas Kasir (Outlet)','asset',0,{isCash:1}],
    ['1-10002','Kas Besar','asset',0,{isCash:1}],
    ['1-10100','Bank BCA — Operasional','asset',0,{isCash:1}],
    ['1-10110','Saldo E-Wallet & QRIS','asset',0,{isCash:1}],
    ['1-10200','Piutang Usaha','asset'],
    ['1-10300','Persediaan Bahan Baku','asset'],
    ['1-10310','Persediaan Barang Jadi','asset'],
    ['1-10400','Uang Muka & Biaya Dibayar Dimuka','asset'],
    ['1-20000','Peralatan & Mesin','asset'],
    ['1-20100','Akumulasi Penyusutan','asset'],
    ['2-00000','LIABILITAS','liability',1],
    ['2-10000','Hutang Usaha (Supplier)','liability'],
    ['2-10100','Hutang Gaji & Komisi','liability'],
    ['2-10110','Hutang BPJS & Potongan Karyawan','liability'],
    ['2-10200','Hutang Pajak (PB1/PPN)','liability'],
    ['2-10300','Deposit Pelanggan','liability'],
    ['2-20000','Hutang Bank','liability'],
    ['3-00000','EKUITAS','equity',1],
    ['3-10000','Modal Pemilik','equity'],
    ['3-20000','Laba Ditahan','equity'],
    ['3-30000','Prive / Pengambilan Pemilik','equity'],
    ['4-00000','PENDAPATAN','revenue',1],
    ['4-10000','Penjualan Makanan','revenue'],
    ['4-10100','Penjualan Minuman','revenue'],
    ['4-10200','Penjualan Lainnya','revenue'],
    ['4-10300','Pendapatan Service Charge','revenue'],
    ['4-20000','Diskon & Potongan Penjualan','revenue'],
    ['4-30000','Pendapatan Lain-lain','revenue'],
    ['5-00000','HARGA POKOK PENJUALAN','expense',1],
    ['5-10000','Harga Pokok Penjualan (HPP)','expense'],
    ['6-00000','BEBAN OPERASIONAL','expense',1],
    ['6-10000','Beban Gaji & Tunjangan','expense'],
    ['6-10010','Beban Komisi Karyawan','expense'],
    ['6-10100','Beban Sewa Tempat','expense'],
    ['6-10200','Beban Listrik, Air & Internet','expense'],
    ['6-10300','Beban Pemasaran & Promosi','expense'],
    ['6-10400','Beban Perlengkapan Outlet','expense'],
    ['6-10500','Beban Perbaikan & Pemeliharaan','expense'],
    ['6-10600','Beban Administrasi Bank & MDR','expense'],
    ['6-10700','Beban Penyusutan','expense'],
    ['6-10800','Beban Kerugian Persediaan','expense'],
    ['6-10900','Beban Lain-lain','expense']
  ];

  /* ---------------- Bahan baku ---------------- */
  /* [nama, satuan, hargaModal per satuan, minStok, stokAwal] */
  const MATERIALS = [
    ['Biji Kopi Arabica','gr',220,2000,9000],
    ['Biji Kopi Robusta','gr',95,2000,7500],
    ['Susu UHT Full Cream','ml',18,10000,42000],
    ['Susu Oat','ml',45,3000,9500],
    ['Gula Aren Cair','ml',35,2000,7200],
    ['Gula Pasir','gr',16,3000,11000],
    ['Es Batu','gr',4,20000,80000],
    ['Coklat Bubuk Premium','gr',120,1000,3600],
    ['Matcha Bubuk','gr',420,500,1650],
    ['Teh Hitam Celup','pcs',900,100,340],
    ['Sirup Vanilla','ml',60,1000,2800],
    ['Sirup Caramel','ml',60,1000,2450],
    ['Whipped Cream','gr',80,800,2100],
    ['Cup Plastik 16oz','pcs',850,400,1450],
    ['Cup Plastik 22oz','pcs',1100,300,980],
    ['Tutup Cup','pcs',320,700,2300],
    ['Sedotan','pcs',150,700,2800],
    ['Paper Bag','pcs',900,200,720],
    ['Kotak Makan','pcs',1800,200,640],
    ['Beras Premium','gr',14,20000,68000],
    ['Ayam Fillet','gr',48,5000,17500],
    ['Daging Sapi','gr',135,3000,8600],
    ['Telur Ayam','butir',2400,100,320],
    ['Kentang Beku','gr',28,4000,14500],
    ['Mie Telur','gr',22,3000,9200],
    ['Minyak Goreng','ml',19,5000,17000],
    ['Bumbu Rendang','gr',55,1000,3400],
    ['Sayur Campur','gr',17,3000,8800],
    ['Keju Mozarella','gr',145,1000,3300],
    ['Roti Burger','pcs',3500,60,180],
    ['Roti Tawar','pcs',1200,80,260],
    ['Tepung Terigu','gr',12,3000,9500],
    ['Butter','gr',95,1000,2900],
    ['Cabai Rawit','gr',75,1000,2600],
    ['Bawang Merah & Putih','gr',38,1500,4900],
    ['Santan Kelapa','ml',22,2000,6300],
    ['Kecap Manis','ml',26,1500,4200],
    ['Saus Sambal','ml',21,1500,5100],
    ['Es Krim Vanilla','gr',85,800,2400],
    ['Pisang','gr',21,2000,5600],
    ['Spaghetti','gr',31,2000,6100],
    ['Saus Bolognese','ml',48,1500,4300],
    ['Air Mineral Botol 600ml','pcs',3000,80,300],
  ];

  /* ---------------- Menu ---------------- */
  /* [nama, kategori, harga, emoji, resep{bahan:qty}, opsi] */
  const MENU = [
    // ——— Kopi ———
    ['Espresso','Kopi',18000,'☕',{'Biji Kopi Arabica':18,'Cup Plastik 16oz':1,'Tutup Cup':1},{fav:1}],
    ['Americano','Kopi',22000,'☕',{'Biji Kopi Arabica':18,'Cup Plastik 16oz':1,'Tutup Cup':1,'Es Batu':80},{}],
    ['Cappuccino','Kopi',28000,'☕',{'Biji Kopi Arabica':18,'Susu UHT Full Cream':150,'Cup Plastik 16oz':1,'Tutup Cup':1},{}],
    ['Caffè Latte','Kopi',30000,'☕',{'Biji Kopi Arabica':18,'Susu UHT Full Cream':180,'Cup Plastik 16oz':1,'Tutup Cup':1},{fav:1}],
    ['Kopi Susu Gula Aren','Kopi',24000,'🥤',{'Biji Kopi Robusta':20,'Susu UHT Full Cream':150,'Gula Aren Cair':25,'Es Batu':120,'Cup Plastik 22oz':1,'Tutup Cup':1,'Sedotan':1},{fav:1,best:1}],
    ['Caramel Macchiato','Kopi',34000,'🥤',{'Biji Kopi Arabica':18,'Susu UHT Full Cream':180,'Sirup Caramel':20,'Whipped Cream':15,'Cup Plastik 22oz':1,'Tutup Cup':1,'Sedotan':1},{}],
    ['Cold Brew','Kopi',32000,'🧋',{'Biji Kopi Arabica':25,'Es Batu':150,'Cup Plastik 22oz':1,'Tutup Cup':1,'Sedotan':1},{}],
    ['Affogato','Kopi',36000,'🍨',{'Biji Kopi Arabica':18,'Es Krim Vanilla':80,'Cup Plastik 16oz':1},{}],
    // ——— Non-Kopi ———
    ['Matcha Latte','Non-Kopi',32000,'🍵',{'Matcha Bubuk':8,'Susu UHT Full Cream':180,'Gula Pasir':12,'Es Batu':100,'Cup Plastik 22oz':1,'Tutup Cup':1,'Sedotan':1},{fav:1}],
    ['Chocolate Signature','Non-Kopi',30000,'🍫',{'Coklat Bubuk Premium':25,'Susu UHT Full Cream':180,'Whipped Cream':15,'Cup Plastik 22oz':1,'Tutup Cup':1,'Sedotan':1},{}],
    ['Teh Tarik','Non-Kopi',20000,'🫖',{'Teh Hitam Celup':1,'Susu UHT Full Cream':120,'Gula Pasir':15,'Cup Plastik 16oz':1,'Tutup Cup':1},{}],
    ['Lemon Tea','Non-Kopi',18000,'🍋',{'Teh Hitam Celup':1,'Gula Pasir':18,'Es Batu':120,'Cup Plastik 16oz':1,'Tutup Cup':1,'Sedotan':1},{}],
    ['Es Teh Manis','Non-Kopi',10000,'🥤',{'Teh Hitam Celup':1,'Gula Pasir':20,'Es Batu':150,'Cup Plastik 16oz':1,'Tutup Cup':1,'Sedotan':1},{best:1}],
    ['Air Mineral','Non-Kopi',8000,'💧',{'Air Mineral Botol 600ml':1},{}],
    // ——— Makanan Berat ———
    ['Nasi Goreng Spesial','Makanan Berat',38000,'🍛',{'Beras Premium':180,'Telur Ayam':1,'Ayam Fillet':60,'Minyak Goreng':20,'Bawang Merah & Putih':15,'Kecap Manis':15,'Sayur Campur':30},{fav:1,best:1}],
    ['Ayam Geprek Sambal Matah','Makanan Berat',36000,'🍗',{'Beras Premium':180,'Ayam Fillet':140,'Tepung Terigu':50,'Minyak Goreng':40,'Cabai Rawit':20,'Bawang Merah & Putih':12},{fav:1}],
    ['Rendang Daging + Nasi','Makanan Berat',62000,'🥘',{'Beras Premium':180,'Daging Sapi':130,'Bumbu Rendang':35,'Santan Kelapa':80},{}],
    ['Mie Goreng Jawa','Makanan Berat',32000,'🍜',{'Mie Telur':120,'Telur Ayam':1,'Sayur Campur':40,'Minyak Goreng':20,'Kecap Manis':18},{}],
    ['Chicken Steak','Makanan Berat',52000,'🥩',{'Ayam Fillet':180,'Kentang Beku':100,'Sayur Campur':50,'Butter':15},{}],
    ['Beef Burger','Makanan Berat',56000,'🍔',{'Roti Burger':1,'Daging Sapi':100,'Keju Mozarella':30,'Sayur Campur':30,'Saus Sambal':15},{}],
    ['Spaghetti Bolognese','Makanan Berat',45000,'🍝',{'Spaghetti':120,'Saus Bolognese':120,'Keju Mozarella':25,'Butter':10},{}],
    ['Nasi Ayam Bakar Madu','Makanan Berat',42000,'🍖',{'Beras Premium':180,'Ayam Fillet':160,'Kecap Manis':20,'Cabai Rawit':10},{}],
    // ——— Snack ———
    ['Kentang Goreng','Snack & Pastry',25000,'🍟',{'Kentang Beku':180,'Minyak Goreng':40,'Saus Sambal':20},{best:1}],
    ['Chicken Wings (6pcs)','Snack & Pastry',38000,'🍗',{'Ayam Fillet':220,'Tepung Terigu':60,'Minyak Goreng':50,'Saus Sambal':25},{}],
    ['Pisang Goreng Keju','Snack & Pastry',26000,'🍌',{'Pisang':200,'Tepung Terigu':60,'Keju Mozarella':25,'Minyak Goreng':35},{}],
    ['Roti Bakar Coklat Keju','Snack & Pastry',24000,'🍞',{'Roti Tawar':4,'Coklat Bubuk Premium':20,'Keju Mozarella':25,'Butter':20},{}],
    ['Croissant Butter','Snack & Pastry',22000,'🥐',{'Tepung Terigu':80,'Butter':40},{}],
    // ——— Dessert ———
    ['Cheesecake Slice','Dessert',35000,'🍰',{'Keju Mozarella':60,'Tepung Terigu':40,'Butter':25,'Gula Pasir':30},{}],
    ['Brownies Ice Cream','Dessert',38000,'🍫',{'Coklat Bubuk Premium':40,'Tepung Terigu':50,'Es Krim Vanilla':70,'Butter':25},{fav:1}],
    ['Puding Coklat','Dessert',20000,'🍮',{'Coklat Bubuk Premium':25,'Susu UHT Full Cream':120,'Gula Pasir':25},{}],
    // ——— Paket ———
    ['Paket Hemat: Nasi Goreng + Es Teh','Paket & Bundling',42000,'🍱',{'Beras Premium':180,'Telur Ayam':1,'Ayam Fillet':60,'Minyak Goreng':20,'Kecap Manis':15,'Sayur Campur':30,'Teh Hitam Celup':1,'Gula Pasir':20,'Es Batu':150,'Cup Plastik 16oz':1},{bundle:1}],
    ['Paket Ngopi Berdua','Paket & Bundling',60000,'☕',{'Biji Kopi Robusta':40,'Susu UHT Full Cream':300,'Gula Aren Cair':50,'Es Batu':240,'Cup Plastik 22oz':2,'Tutup Cup':2,'Sedotan':2,'Kentang Beku':180,'Minyak Goreng':40},{bundle:1}]
  ];

  const MODIFIERS = [
    { name:'Extra Shot Espresso', price:8000, material:'Biji Kopi Arabica', qty:18, group:'Tambahan' },
    { name:'Ganti Susu Oat',      price:8000, material:'Susu Oat', qty:180, group:'Tambahan' },
    { name:'Extra Keju',          price:7000, material:'Keju Mozarella', qty:30, group:'Tambahan' },
    { name:'Extra Telur',         price:6000, material:'Telur Ayam', qty:1, group:'Tambahan' },
    { name:'Extra Whipped Cream', price:5000, material:'Whipped Cream', qty:20, group:'Tambahan' },
    { name:'Less Sugar',          price:0, group:'Preferensi' },
    { name:'Tanpa Es',            price:0, group:'Preferensi' },
    { name:'Pedas Level 1',       price:0, group:'Level Pedas' },
    { name:'Pedas Level 3',       price:0, group:'Level Pedas' },
    { name:'Pedas Level 5',       price:2000, material:'Cabai Rawit', qty:10, group:'Level Pedas' }
  ];

  const SUPPLIERS = [
    ['PT Kopi Nusantara Jaya','Bpk. Hendra','0812-1100-2201','sales@kopinusantara.co.id','Jl. Raya Bogor KM 24, Jakarta Timur',30],
    ['CV Segar Dairy Indonesia','Ibu Lastri','0813-2200-3312','order@segardairy.com','Jl. Industri Raya No. 8, Bekasi',14],
    ['Toko Bahan Kue Makmur','Bpk. Ali','0857-3300-4423','makmurbaking@gmail.com','Pasar Mayestik Blok C-12, Jakarta Selatan',7],
    ['PT Sumber Protein Prima','Ibu Wulan','0811-4400-5534','purchasing@sumberprotein.id','Jl. Pluit Raya No. 45, Jakarta Utara',30],
    ['UD Sayur Segar Pagi','Bpk. Rahmat','0822-5500-6645','-','Pasar Induk Kramat Jati, Jakarta Timur',0],
    ['PT Kemasan Prima Pack','Ibu Nina','0816-6600-7756','cs@primapack.co.id','Kawasan Industri Jatake, Tangerang',21]
  ];

  const TIERS = [
    { id:'tier_reg',  name:'Reguler',  minSpend:0,        discount:0, pointRate:1,   color:'#7d8f99', benefit:'Kumpulkan poin setiap transaksi' },
    { id:'tier_silv', name:'Silver',   minSpend:1000000,  discount:3, pointRate:1.25,color:'#8fa3ad', benefit:'Diskon 3% + poin 1,25×' },
    { id:'tier_gold', name:'Gold',     minSpend:5000000,  discount:5, pointRate:1.5, color:'#f5a524', benefit:'Diskon 5% + poin 1,5× + free upsize' },
    { id:'tier_plat', name:'Platinum', minSpend:15000000, discount:8, pointRate:2,   color:'#7c5cff', benefit:'Diskon 8% + poin 2× + priority reservasi' }
  ];

  const NAMA = ['Andi Wijaya','Siti Rahayu','Budi Hartono','Dewi Anggraini','Rizky Ramadhan','Putri Ayu','Fajar Nugroho','Maya Kusuma','Agus Setiawan','Nina Marlina','Bayu Pratama','Lestari Ningsih','Hendra Gunawan','Rina Oktaviani','Doni Kurniawan','Fitri Handayani','Yoga Saputra','Citra Dewi','Arif Rahman','Melati Sari','Galih Permana','Intan Permatasari','Reza Fahlevi','Sinta Bella','Tomi Wijayanto','Vina Amelia','Wahyu Hidayat','Yuni Astuti','Zaki Mubarok','Anisa Rahmawati','Bagas Prakoso','Clara Simanjuntak','Dimas Anggara','Eka Putra','Farah Nabila','Gilang Ramadhan','Hana Salsabila','Irfan Maulana','Jihan Aulia','Kevin Sanjaya'];

  const EMPLOYEES = [
    ['Andi Pratama','Kasir Senior',0,4200000,600000,1.5],
    ['Siti Nurhaliza','Kasir',0,3800000,500000,1.5],
    ['Joko Susilo','Head Barista',0,5000000,700000,1],
    ['Rina Wijaya','Store Manager',0,7500000,1500000,0.5],
    ['Dedi Kurnia','Barista',0,3900000,500000,1],
    ['Wulan Sari','Waitress',0,3600000,450000,2],
    ['Bambang Irawan','Chef',2,6500000,900000,0],
    ['Eko Prasetyo','Cook Helper',2,3500000,400000,0],
    ['Maya Sari','HRD & Admin',0,5500000,700000,0],
    ['Dewi Lestari','Akuntan',0,6000000,800000,0],
    ['Tono Suprapto','Barista',1,3800000,500000,1],
    ['Lilis Handayani','Kasir',1,3700000,450000,1.5],
    ['Fajar Sidik','Waiter',2,3500000,400000,2],
    ['Nur Aini','Kasir',2,3800000,500000,1.5]
  ];

  /* ============================================================= */
  function build() {
    /* --- Outlet --- */
    const outlets = [
      { id:'out_kemang',   code:'KMG', name:'Kopi Senja — Kemang',        type:'cafe',
        address:'Jl. Kemang Raya No. 42, Jakarta Selatan', phone:'021-7180-1122',
        taxRate:10, taxIncluded:false, serviceCharge:5, rounding:100, active:true, openHour:'07:00', closeHour:'23:00' },
      { id:'out_bintaro',  code:'BTR', name:'Kopi Senja — Bintaro',       type:'cafe',
        address:'Jl. Bintaro Utama Sektor 9, Tangerang Selatan', phone:'021-7451-3344',
        taxRate:10, taxIncluded:false, serviceCharge:5, rounding:100, active:true, openHour:'07:00', closeHour:'22:00' },
      { id:'out_senopati', code:'SNP', name:'Dapur Nusantara — Senopati', type:'restoran',
        address:'Jl. Senopati Raya No. 88, Jakarta Selatan', phone:'021-5296-7788',
        taxRate:10, taxIncluded:false, serviceCharge:7, rounding:100, active:true, openHour:'10:00', closeHour:'23:00' }
    ];
    DB.insertMany('outlets', outlets);

    /* --- Peran --- */
    Object.entries(App.Auth.ROLE_TEMPLATES).forEach(([key, r]) => {
      DB.insert('roles', { id:'role_' + key, key, name:r.name, permissions:[...r.permissions], system:true });
    });

    /* --- Pengguna --- */
    DB.insertMany('users', [
      { id:'usr_owner', name:'Budi Santoso',  role:'owner',      roleId:'role_owner',      pin:'1234', email:'budi@kopisenja.id',  outletIds:['ALL'], active:true },
      { id:'usr_mgr',   name:'Rina Wijaya',   role:'manager',    roleId:'role_manager',    pin:'2222', email:'rina@kopisenja.id',  outletIds:['ALL'], active:true },
      { id:'usr_spv',   name:'Joko Susilo',   role:'supervisor', roleId:'role_supervisor', pin:'3333', email:'joko@kopisenja.id',  outletIds:['out_kemang'], active:true },
      { id:'usr_kasir1',name:'Andi Pratama',  role:'kasir',      roleId:'role_kasir',      pin:'1111', email:'andi@kopisenja.id',  outletIds:['out_kemang'], active:true },
      { id:'usr_kasir2',name:'Siti Nurhaliza',role:'kasir',      roleId:'role_kasir',      pin:'1112', email:'siti@kopisenja.id',  outletIds:['out_bintaro'], active:true },
      { id:'usr_dapur', name:'Bambang Irawan',role:'dapur',      roleId:'role_dapur',      pin:'4444', email:'bambang@kopisenja.id',outletIds:['out_senopati'], active:true },
      { id:'usr_acc',   name:'Dewi Lestari',  role:'akuntan',    roleId:'role_akuntan',    pin:'5555', email:'dewi@kopisenja.id',  outletIds:['ALL'], active:true },
      { id:'usr_hrd',   name:'Maya Sari',     role:'hrd',        roleId:'role_hrd',        pin:'6666', email:'maya@kopisenja.id',  outletIds:['ALL'], active:true },
      { id:'usr_gudang',name:'Tono Suprapto', role:'gudang',     roleId:'role_gudang',     pin:'7777', email:'tono@kopisenja.id',  outletIds:['ALL'], active:true }
    ]);

    /* --- Bagan akun --- */
    COA.forEach(([code, name, type, isGroup, extra]) => {
      DB.insert('accounts', { id:'acc_' + code.replace(/-/g,''), code, name, type,
        isGroup: !!isGroup, isCash: !!(extra && extra.isCash), active:true, ...(extra||{}) });
    });

    /* --- Kategori --- */
    const cats = [
      ['Kopi','☕','#0d9c86','4-10100'],
      ['Non-Kopi','🍵','#7c5cff','4-10100'],
      ['Makanan Berat','🍛','#f5a524','4-10000'],
      ['Snack & Pastry','🍟','#0b93d5','4-10000'],
      ['Dessert','🍰','#e06a9c','4-10000'],
      ['Paket & Bundling','🍱','#3fa62a','4-10000'],
      ['Bahan Baku','📦','#5b6b8c','1-10300']
    ];
    const catId = {};
    cats.forEach(([name, icon, color, rev], i) => {
      const c = DB.insert('categories', { name, icon, color, revenueAccount:rev, sort:i, isMaterial:name==='Bahan Baku' });
      catId[name] = c.id;
    });

    /* --- Bahan baku --- */
    const matId = {};
    MATERIALS.forEach(([name, unit, cost, minStock, stok], i) => {
      const p = DB.insert('products', {
        sku:'BB-' + String(i + 1).padStart(3,'0'), name, type:'material', categoryId:catId['Bahan Baku'],
        unit, cost, price:0, trackStock:true, minStock, recipe:[], active:true, emoji:'📦',
        units:[{ name:unit, factor:1 }, ...(unit==='gr'?[{name:'kg',factor:1000}]:[]), ...(unit==='ml'?[{name:'liter',factor:1000}]:[]), ...(unit==='pcs'?[{name:'lusin',factor:12},{name:'karton',factor:100}]:[])]
      });
      matId[name] = p.id;
      outlets.forEach((o, oi) => {
        const faktor = oi === 0 ? 1 : oi === 1 ? 0.72 : 0.85;
        DB.insert('stock', { outletId:o.id, productId:p.id, qty:Math.round(stok * faktor), avgCost:cost, reserved:0 });
      });
    });

    /* --- Modifier / extra global --- */
    const modifiers = MODIFIERS.map(m => ({
      id: U.uid('mod'), name:m.name, price:m.price, group:m.group,
      materialId: m.material ? matId[m.material] : null, qty: m.qty || 0
    }));
    DB.setSetting('modifiers', modifiers);

    /* --- Menu --- */
    const varian = {
      Kopi: [{ name:'Ukuran', options:[{name:'Regular',priceDelta:0},{name:'Large',priceDelta:6000}] },
             { name:'Penyajian', options:[{name:'Panas',priceDelta:0},{name:'Dingin',priceDelta:2000}] }],
      'Non-Kopi': [{ name:'Ukuran', options:[{name:'Regular',priceDelta:0},{name:'Large',priceDelta:6000}] }],
      'Makanan Berat': [{ name:'Porsi', options:[{name:'Normal',priceDelta:0},{name:'Jumbo',priceDelta:12000}] }]
    };
    const prodId = {};
    MENU.forEach(([name, cat, price, emoji, resep, flags], i) => {
      const recipe = Object.entries(resep).map(([m, q]) => ({ materialId: matId[m], qty:q, unit: (DB.find('products', matId[m])||{}).unit }));
      const p = DB.insert('products', {
        sku:'MN-' + String(i + 1).padStart(3,'0'), name, type:'product', categoryId:catId[cat],
        unit:'porsi', price, cost:0, trackStock:false, minStock:0, recipe, active:true, emoji,
        variants: varian[cat] ? U.clone(varian[cat]) : [],
        modifierGroups: cat==='Kopi'||cat==='Non-Kopi' ? ['Tambahan','Preferensi'] : (cat==='Makanan Berat'||cat==='Snack & Pastry' ? ['Tambahan','Level Pedas'] : ['Tambahan']),
        favorite: !!(flags && flags.fav), bestSeller: !!(flags && flags.best), isBundle: !!(flags && flags.bundle),
        outletIds:['ALL'], station: (cat==='Kopi'||cat==='Non-Kopi') ? 'bar' : 'dapur',
        printKitchen:true, barcode:'899' + String(1000000 + i)
      });
      prodId[name] = p.id;
    });
    DB.setSetting('_matId', matId);
    DB.setSetting('_prodId', prodId);
    DB.setSetting('_catId', catId);

    /* --- Supplier --- */
    SUPPLIERS.forEach(([name, contact, phone, email, address, term], i) => {
      DB.insert('suppliers', { id:'sup_' + (i+1), code:'SUP-' + String(i+1).padStart(3,'0'),
        name, contact, phone, email, address, term, active:true, note:'' });
    });

    /* --- Tier membership --- */
    TIERS.forEach(t => DB.insert('tiers', t));

    /* --- Grup pelanggan --- */
    ['Pelanggan Umum','Karyawan Kantor Sekitar','Komunitas Kopi','Corporate / B2B'].forEach((n, i) =>
      DB.insert('customerGroups', { id:'grp_' + (i+1), name:n, note:'' }));

    /* --- Pelanggan --- */
    NAMA.forEach((name, i) => {
      const spend = U.randInt(0, 22) * 320000;
      const tier = spend >= 15000000 ? 'tier_plat' : spend >= 5000000 ? 'tier_gold' : spend >= 1000000 ? 'tier_silv' : 'tier_reg';
      DB.insert('customers', {
        id:'cus_' + String(i+1).padStart(3,'0'), code:'MBR-' + String(1001 + i),
        name, phone:'08' + U.randInt(11,89) + '-' + U.randInt(1000,9999) + '-' + U.randInt(1000,9999),
        email: U.slug(name.split(' ')[0]) + i + '@email.com',
        address:'Jakarta', birthday:`19${U.randInt(80,99)}-${String(U.randInt(1,12)).padStart(2,'0')}-${String(U.randInt(1,28)).padStart(2,'0')}`,
        groupId:'grp_' + U.randInt(1,4), tierId:tier,
        points: Math.floor(spend / 10000), stamps: U.randInt(0,9), deposit: i % 9 === 0 ? U.randInt(1,6) * 100000 : 0,
        totalSpend: spend, visits: Math.floor(spend / 85000), lastVisit: U.addDays(U.today(), -U.randInt(0,45)),
        joinDate: U.addDays(U.today(), -U.randInt(30,700)), active:true, note:''
      });
    });

    /* --- Karyawan --- */
    EMPLOYEES.forEach(([name, pos, oi, base, allow, comm], i) => {
      DB.insert('employees', {
        id:'emp_' + String(i+1).padStart(3,'0'), nik:'KS' + (2200 + i),
        name, position:pos, outletId:outlets[oi].id,
        joinDate: U.addDays(U.today(), -U.randInt(90, 1200)),
        phone:'08' + U.randInt(11,89) + U.randInt(10000000, 99999999),
        email: U.slug(name) + '@kopisenja.id',
        salaryBase: base,
        allowances:[{ name:'Tunjangan Transport', amount: Math.round(allow*0.5) },
                    { name:'Tunjangan Makan',     amount: Math.round(allow*0.5) }],
        deductions:[{ name:'BPJS Kesehatan (1%)', amount: Math.round(base*0.01) },
                    { name:'BPJS Ketenagakerjaan (2%)', amount: Math.round(base*0.02) }],
        commissionRate: comm, bankName:'BCA', bankAccount:'8' + U.randInt(100000000, 999999999),
        npwp: i % 3 === 0 ? '09.' + U.randInt(100,999) + '.' + U.randInt(100,999) + '.1-000.000' : '',
        status:'aktif', employmentType: i % 5 === 0 ? 'kontrak' : 'tetap',
        userId: ['usr_kasir1','usr_kasir2','usr_spv','usr_mgr',null,null,'usr_dapur',null,'usr_hrd','usr_acc','usr_gudang'][i] || null
      });
    });

    /* --- Area & Meja --- */
    const layout = [
      ['out_kemang',  [['Indoor', 8, 4], ['Outdoor', 6, 4]]],
      ['out_bintaro', [['Indoor', 6, 4], ['Teras', 4, 2]]],
      ['out_senopati',[['Lantai 1', 10, 4], ['Lantai 2', 6, 6], ['VIP Room', 3, 10]]]
    ];
    layout.forEach(([oid, areas]) => {
      areas.forEach(([area, count, cap], ai) => {
        DB.insert('areas', { id:`area_${oid}_${ai}`, outletId:oid, name:area, sort:ai });
        for (let i = 1; i <= count; i++) {
          DB.insert('tables', {
            id:`tbl_${oid}_${ai}_${i}`, outletId:oid, area, areaId:`area_${oid}_${ai}`,
            name: `${area.slice(0,1).toUpperCase()}${i}`, capacity: cap + (i % 3 === 0 ? 2 : 0),
            status:'free', orderId:null
          });
        }
      });
    });

    /* --- Promo --- */
    const t = U.today();
    DB.insertMany('promos', [
      { id:'pro_1', name:'Buy 1 Get 1 Kopi Susu (Senin)', type:'bogo', value:1, productIds:[prodId['Kopi Susu Gula Aren']],
        days:[1], startDate:U.addDays(t,-90), endDate:U.addDays(t,120), active:true, autoApply:false, minPurchase:0,
        outletIds:['ALL'], description:'Beli 1 gratis 1 Kopi Susu Gula Aren setiap hari Senin' },
      { id:'pro_2', name:'Happy Hour 15.00–17.00 — Diskon 20%', type:'percent', value:20, productIds:[],
        categoryIds:[catId['Kopi'], catId['Non-Kopi']], hourFrom:15, hourTo:17, days:[1,2,3,4,5],
        startDate:U.addDays(t,-60), endDate:U.addDays(t,180), active:true, autoApply:true, minPurchase:0,
        outletIds:['ALL'], description:'Diskon 20% semua minuman saat happy hour hari kerja' },
      { id:'pro_3', name:'Stamp Card — 10 Cup Gratis 1', type:'stamp', value:10, productIds:[],
        categoryIds:[catId['Kopi']], startDate:U.addDays(t,-200), endDate:U.addDays(t,365), active:true,
        autoApply:false, minPurchase:0, outletIds:['ALL'], description:'Kumpulkan 10 stamp, dapat 1 kopi gratis' },
      { id:'pro_4', name:'Diskon Member Gold & Platinum', type:'member', value:0, tierIds:['tier_gold','tier_plat'],
        startDate:U.addDays(t,-365), endDate:U.addDays(t,365), active:true, autoApply:true, minPurchase:0,
        outletIds:['ALL'], description:'Diskon otomatis sesuai tier membership' },
      { id:'pro_5', name:'Diskon Rp 15.000 Min. Belanja 150rb', type:'amount', value:15000, minPurchase:150000,
        startDate:U.addDays(t,-30), endDate:U.addDays(t,60), active:true, autoApply:true,
        outletIds:['ALL'], description:'Potongan langsung untuk transaksi minimal Rp 150.000' },
      { id:'pro_6', name:'Promo Gajian — Diskon 25% (25–31)', type:'percent', value:25, minPurchase:100000,
        startDate:U.addDays(t,-120), endDate:U.addDays(t,240), active:false, autoApply:false,
        outletIds:['ALL'], description:'Diskon 25% periode tanggal muda' }
    ]);

    /* --- Kampanye marketing --- */
    DB.insertMany('campaigns', [
      { id:'cmp_1', name:'Promo Weekend Kopi Susu', channel:'whatsapp', target:'tier_gold',
        template:'Halo {nama}! Weekend ini nikmati Kopi Susu Gula Aren favorit kamu dengan diskon 20%. Tunjukkan pesan ini di kasir ya ☕', 
        scheduledAt:U.addDays(t,-12), status:'terkirim', sent:128, opened:97, clicked:41, revenue:4820000 },
      { id:'cmp_2', name:'Reaktivasi Pelanggan 60 Hari', channel:'whatsapp', target:'churn',
        template:'Hai {nama}, kami rindu! Ada voucher Rp 25.000 menunggu kamu di Kopi Senja. Berlaku 14 hari 🎁',
        scheduledAt:U.addDays(t,-5), status:'terkirim', sent:64, opened:38, clicked:15, revenue:1740000 },
      { id:'cmp_3', name:'Ucapan Ulang Tahun Otomatis', channel:'email', target:'birthday',
        template:'Selamat ulang tahun {nama}! 🎂 Nikmati 1 dessert gratis di outlet Kopi Senja mana saja bulan ini.',
        scheduledAt:t, status:'terjadwal', sent:0, opened:0, clicked:0, revenue:0 },
      { id:'cmp_4', name:'Launching Menu Baru — Matcha Series', channel:'sms', target:'all',
        template:'BARU! Matcha Latte premium kini hadir di Kopi Senja. Diskon 15% minggu pertama.',
        scheduledAt:U.addDays(t,3), status:'draft', sent:0, opened:0, clicked:0, revenue:0 }
    ]);

    /* --- Pengaturan umum --- */
    DB.setSetting('business', {
      name:'Kopi Senja Group', legalName:'PT Senja Rasa Nusantara', npwp:'01.234.567.8-901.000',
      phone:'021-7180-1122', email:'halo@kopisenja.id', address:'Jl. Kemang Raya No. 42, Jakarta Selatan',
      logo:'☕', currency:'IDR', fiscalStart:'01-01'
    });
    DB.setSetting('receipt', {
      header:'KOPI SENJA', subheader:'Ngopi santai, rasa istimewa',
      footer:'Terima kasih atas kunjungan Anda 🙏\nIkuti kami @kopisenja.id',
      showLogo:true, showNpwp:true, showCashier:true, showQr:true, paperWidth:58, copies:1
    });
    DB.setSetting('pos', {
      autoSendKitchen:true, requireCustomer:false, allowNegativeStock:false, roundingMode:'nearest',
      quickCash:[20000,50000,100000,150000,200000,300000], defaultOrderType:'dinein',
      digitalReceipt:['whatsapp','email','sms'], mdrRates:{ qris:0.7, debit:0.5, credit:2, ewallet:1.5 }
    });
    DB.setSetting('paymentMethods', [
      { key:'cash',     label:'Tunai',        icon:'💵', active:true, group:'tunai' },
      { key:'qris',     label:'QRIS',         icon:'📱', active:true, group:'digital' },
      { key:'debit',    label:'Kartu Debit',  icon:'💳', active:true, group:'edc' },
      { key:'credit',   label:'Kartu Kredit', icon:'💳', active:true, group:'edc' },
      { key:'ewallet',  label:'E-Wallet',     icon:'👛', active:true, group:'digital' },
      { key:'transfer', label:'Transfer Bank',icon:'🏦', active:true, group:'digital' },
      { key:'deposit',  label:'Deposit Member',icon:'🎫', active:true, group:'member' },
      { key:'invoice',  label:'Invoice / Piutang', icon:'🧾', active:true, group:'kredit' }
    ]);
    DB.setSetting('channels', [
      { key:'kasir',    label:'Kasir (Offline)', icon:'🧾', color:'#0d9c86', commission:0 },
      { key:'gofood',   label:'GoFood',          icon:'🛵', color:'#00aa13', commission:20 },
      { key:'grabfood', label:'GrabFood',        icon:'🟢', color:'#00b14f', commission:20 },
      { key:'shopeefood',label:'ShopeeFood',     icon:'🛒', color:'#ee4d2d', commission:20 },
      { key:'webstore', label:'Toko Online',     icon:'🌐', color:'#0b93d5', commission:0 },
      { key:'emenu',    label:'E-Menu / QR',     icon:'📱', color:'#7c5cff', commission:0 }
    ]);
    DB.setSetting('payroll', {
      cutoffDay:25, payDay:1, overtimeRate:1.5, lateToleranceMin:10,
      pph21:true, bpjsKes:1, bpjsTk:2, thrMonth:4
    });
    DB.setSetting('seededAt', U.now());
  }

  return { build, COA, MATERIALS, MENU, TIERS };
})();
