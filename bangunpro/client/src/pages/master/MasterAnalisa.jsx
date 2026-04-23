import { useEffect, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import Layout from '../../components/layout/Layout';
import { Button, Modal, Badge, Input, Select } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export default function MasterAnalisa() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ kode: '', nama: '', satuan: '', kategori: '', sumber: 'SNI', harga_satuan: 0, koefisien_json: '{}' });

  const load = async () => {
    const r = await api.get('/master-analisa');
    setItems(r.data);
  };

  useEffect(() => { load(); }, []);

  const categories = [...new Set(items.map(i => i.kategori))].filter(Boolean);
  const filtered = items.filter(i =>
    (!search || i.nama.toLowerCase().includes(search.toLowerCase()) || (i.kode && i.kode.includes(search))) &&
    (!kategori || i.kategori === kategori)
  );

  const handleAdd = async () => {
    if (!form.nama) return toast.error('Nama wajib diisi');
    await api.post('/master-analisa', form);
    toast.success('Analisa ditambahkan');
    setShowAdd(false);
    load();
  };

  return (
    <Layout title="Master Analisa">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-bold text-navy">Master Analisa (AHSP)</h2>
          <p className="text-xs text-gray-500">Library Analisa Harga Satuan Pekerjaan SNI/PUPR 2024</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="w-4 h-4" /> Tambah Analisa</Button>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Cari analisa pekerjaan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-48" value={kategori} onChange={e => setKategori(e.target.value)}>
          <option value="">Semua Kategori</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">KODE</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">NAMA ANALISA</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">SATUAN</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">KATEGORI</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">SUMBER</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">HARGA SATUAN</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-12 text-gray-400 text-sm">Tidak ada data</td></tr>
            ) : filtered.map(item => {
              let koef = null;
              try { koef = JSON.parse(item.koefisien_json); } catch {}
              return [
                <tr key={item.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{item.kode}</td>
                  <td className="px-4 py-3 text-sm font-medium">{item.nama}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{item.satuan}</td>
                  <td className="px-4 py-3"><Badge color="blue">{item.kategori}</Badge></td>
                  <td className="px-4 py-3"><Badge color="green">{item.sumber}</Badge></td>
                  <td className="px-4 py-3 text-sm font-bold text-right">{formatRupiah(item.harga_satuan)}</td>
                </tr>,
                expanded === item.id && koef && (
                  <tr key={`exp-${item.id}`} className="bg-blue-50 border-b">
                    <td colSpan="6" className="px-8 py-3">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {koef.material?.length > 0 && (
                          <div>
                            <p className="font-bold text-gray-700 mb-1">Material:</p>
                            {koef.material.map((m, i) => <p key={i} className="text-gray-600">{m.nama} × {m.koef} {m.satuan}</p>)}
                          </div>
                        )}
                        {koef.tenaga?.length > 0 && (
                          <div>
                            <p className="font-bold text-gray-700 mb-1">Tenaga:</p>
                            {koef.tenaga.map((t, i) => <p key={i} className="text-gray-600">{t.posisi} × {t.koef} {t.satuan}</p>)}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              ];
            })}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Analisa AHSP">
        <div className="space-y-3">
          <Input label="Kode" value={form.kode} onChange={e => setForm({ ...form, kode: e.target.value })} placeholder="Cth: A.4.1.3" />
          <Input label="Nama Analisa *" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama pekerjaan" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Satuan" value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} />
            <Input label="Kategori" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} />
          </div>
          <Input label="Harga Satuan (Rp)" type="number" value={form.harga_satuan} onChange={e => setForm({ ...form, harga_satuan: e.target.value })} />
          <Button onClick={handleAdd} className="w-full justify-center">SIMPAN</Button>
        </div>
      </Modal>
    </Layout>
  );
}
