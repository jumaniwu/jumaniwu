import { useEffect, useState } from 'react';
import { Search, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Badge } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';

const WILAYAH = ['Standar DKI Jakarta', 'Standar Jawa Barat', 'Standar Jawa Timur', 'Standar Sumatera Utara', 'Standar Kepulauan Riau', 'Standar Kalimantan', 'Standar Sulawesi'];

const KATEGORI_ICONS = {
  'Sipil & Struktur': '🏗️',
  'Besi Beton': '⚙️',
  'Konstruksi Baja': '🔩',
  'Arsitektur & Finishing': '🏠',
  'Cat & Pelapis': '🎨',
  'MEP (Listrik & Plumbing)': '⚡',
  'Upah Tenaga': '👷',
};

export default function MasterHarga() {
  const [items, setItems] = useState([]);
  const [edited, setEdited] = useState({});
  const [search, setSearch] = useState('');
  const [wilayah, setWilayah] = useState(WILAYAH[0]);
  const [timpa, setTimpa] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const r = await api.get('/master-harga');
    setItems(r.data);
    setEdited({});
  };

  useEffect(() => { load(); }, []);

  const categories = [...new Set(items.map(i => i.kategori))].filter(Boolean);
  const filtered = items.filter(i => !search || i.nama.toLowerCase().includes(search.toLowerCase()));

  const handleApplyWilayah = async () => {
    setLoading(true);
    try {
      await api.post('/master-harga/apply-wilayah', { wilayah, timpa });
      toast.success(`Harga standar ${wilayah} diterapkan`);
      load();
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    const toUpdate = Object.entries(edited).map(([id, harga]) => ({ id: Number(id), harga: Number(harga) }));
    if (toUpdate.length === 0) return toast('Tidak ada perubahan');
    await api.put('/master-harga/bulk', { items: toUpdate });
    toast.success(`${toUpdate.length} item harga disimpan`);
    setEdited({});
    load();
  };

  return (
    <Layout title="Master Harga & Wilayah">
      {/* Wilayah Setting */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Badge color="blue">PENGATURAN REGIONAL</Badge>
        </div>
        <h3 className="font-bold text-navy mb-1">Set Harga Per Wilayah</h3>
        <p className="text-xs text-gray-500 mb-4">Pilih wilayah untuk memuat standar harga material & upah regional.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <select className="input-field w-56" value={wilayah} onChange={e => setWilayah(e.target.value)}>
            {WILAYAH.map(w => <option key={w}>{w}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={timpa} onChange={e => setTimpa(e.target.checked)} className="rounded" />
            Timpa harga lama
          </label>
          <Button onClick={handleApplyWilayah} loading={loading} variant="primary" size="sm">
            <RotateCcw className="w-4 h-4" /> Terapkan
          </Button>
        </div>
      </div>

      {/* Search + Save */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Cari material (Semen, Pasir, Besi)..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={load}><RotateCcw className="w-4 h-4" /> Reset</Button>
        <Button size="sm" onClick={handleSave}><Save className="w-4 h-4" /> Simpan Data</Button>
      </div>

      {/* Material Cards by Category */}
      {categories.map(cat => {
        const catItems = filtered.filter(i => i.kategori === cat);
        if (catItems.length === 0) return null;
        return (
          <div key={cat} className="mb-6">
            <h3 className="font-bold text-navy mb-3 flex items-center gap-2">
              {KATEGORI_ICONS[cat] || '📦'} {cat}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {catItems.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-bold text-navy uppercase leading-tight flex-1">{item.nama}</p>
                    <div className="text-right ml-2">
                      <p className="text-[10px] text-gray-400">STD</p>
                      <p className="text-xs text-gray-500">{formatRupiah(item.std_wilayah)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mb-1">Satuan: {item.satuan}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs text-gray-500">Rp</span>
                    <input
                      type="number"
                      className={`input-field text-xs flex-1 ${edited[item.id] !== undefined ? 'border-primary font-bold' : ''}`}
                      value={edited[item.id] !== undefined ? edited[item.id] : item.harga}
                      onChange={e => setEdited({ ...edited, [item.id]: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Layout>
  );
}
