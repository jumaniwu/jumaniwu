import { useEffect, useState, useRef } from 'react';
import { Printer, FileSpreadsheet, Plus, Trash2, ChevronUp, ChevronDown, Edit2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Button, Modal, Input, Select, Badge, EmptyState } from '../../components/ui';
import { formatRupiah, terbilang } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';

const MARGIN_DEFAULT = 10;
const PPN_DEFAULT = 11;

function RabItemRow({ item, onUpdate, onDelete, onMove }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ uraian: item.uraian, volume: item.volume, satuan: item.satuan, harga_satuan: item.harga_satuan });

  const save = async () => {
    await onUpdate(item.id, form);
    setEditing(false);
  };

  if (editing) return (
    <tr className="bg-blue-50">
      <td className="px-3 py-2 text-xs text-gray-400">{item.no}</td>
      <td className="px-3 py-2"><input className="input-field text-xs" value={form.uraian} onChange={e => setForm({ ...form, uraian: e.target.value })} /></td>
      <td className="px-3 py-2"><input type="number" className="input-field text-xs w-20" value={form.volume} onChange={e => setForm({ ...form, volume: e.target.value })} /></td>
      <td className="px-3 py-2"><input className="input-field text-xs w-16" value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} /></td>
      <td className="px-3 py-2"><input type="number" className="input-field text-xs w-28" value={form.harga_satuan} onChange={e => setForm({ ...form, harga_satuan: e.target.value })} /></td>
      <td className="px-3 py-2 font-bold text-xs">{formatRupiah(form.volume * form.harga_satuan)}</td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={save} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:bg-gray-50 rounded"><X className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  );

  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-3 py-2.5 text-xs text-gray-400">{item.no}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800">{item.uraian}</span>
          {item.analisa_source === 'ahsp_sni' && <Badge color="blue">SNI</Badge>}
          <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all">
            <Edit2 className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </td>
      <td className="px-3 py-2.5 text-sm font-bold text-green-600">{item.volume}</td>
      <td className="px-3 py-2.5 text-sm text-gray-500">{item.satuan}</td>
      <td className="px-3 py-2.5 text-sm">{formatRupiah(item.harga_satuan)}</td>
      <td className="px-3 py-2.5 text-sm font-semibold">{formatRupiah(item.subtotal)}</td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={() => onMove(item.id, 'up')} className="p-1 hover:bg-gray-100 rounded"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onMove(item.id, 'down')} className="p-1 hover:bg-gray-100 rounded"><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(item.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

export default function Rekapitulasi() {
  const { activeProject } = useProject();
  const [divisions, setDivisions] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [margin, setMargin] = useState(MARGIN_DEFAULT);
  const [ppn, setPpn] = useState(PPN_DEFAULT);
  const [ppnEnabled, setPpnEnabled] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddDiv, setShowAddDiv] = useState(false);
  const [addItemDivId, setAddItemDivId] = useState(null);
  const [masterAnalisa, setMasterAnalisa] = useState([]);
  const [newItem, setNewItem] = useState({ uraian: '', volume: 1, satuan: 'm²', harga_satuan: 0, analisa_source: 'manual', division_id: '' });
  const [newDivName, setNewDivName] = useState('');

  const load = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const [rabRes, analisaRes] = await Promise.all([
        api.get(`/rab/${activeProject.id}`),
        api.get('/master-analisa')
      ]);
      setDivisions(rabRes.data.divisions);
      setItems(rabRes.data.items);
      setMasterAnalisa(analisaRes.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeProject]);

  const totalModal = items.reduce((s, i) => s + i.subtotal, 0);
  const totalRab = totalModal * (1 + margin / 100);
  const ppnNominal = ppnEnabled ? totalRab * (ppn / 100) : 0;
  const grandTotal = Math.round((totalRab + ppnNominal) / 1000) * 1000;

  const handleUpdateItem = async (id, form) => {
    await api.put(`/rab/items/${id}`, { ...form, volume: parseFloat(form.volume), harga_satuan: parseFloat(form.harga_satuan) });
    toast.success('Item diperbarui');
    load();
  };

  const handleDeleteItem = async (id) => {
    await api.delete(`/rab/items/${id}`);
    toast.success('Item dihapus');
    load();
  };

  const handleAddItem = async () => {
    if (!newItem.uraian) return toast.error('Uraian wajib diisi');
    await api.post(`/rab/${activeProject.id}/items`, { ...newItem, division_id: addItemDivId || newItem.division_id });
    toast.success('Item ditambahkan');
    setShowAddItem(false);
    setNewItem({ uraian: '', volume: 1, satuan: 'm²', harga_satuan: 0, analisa_source: 'manual', division_id: '' });
    load();
  };

  const handleAddDiv = async () => {
    if (!newDivName) return;
    await api.post(`/rab/${activeProject.id}/divisions`, { name: newDivName });
    setShowAddDiv(false);
    setNewDivName('');
    load();
  };

  const handleSelectAnalisa = (analisa) => {
    setNewItem(prev => ({
      ...prev,
      uraian: `${analisa.nama} (AHSP SNI ${analisa.kode})`,
      satuan: analisa.satuan,
      harga_satuan: analisa.harga_satuan,
      analisa_source: 'ahsp_sni'
    }));
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const rows = divisions.map(div => {
      const divItems = items.filter(i => i.division_id === div.id);
      const divTotal = divItems.reduce((s, i) => s + i.subtotal, 0);
      return `
        <tr style="background:#fffde7"><td colspan="6" style="padding:8px;font-weight:bold">${div.roman_number}. ${div.name}</td></tr>
        ${divItems.map(item => `
          <tr>
            <td style="padding:6px">${item.no}</td>
            <td style="padding:6px">${item.uraian}</td>
            <td style="padding:6px;text-align:center">${item.volume}</td>
            <td style="padding:6px;text-align:center">${item.satuan}</td>
            <td style="padding:6px;text-align:right">${formatRupiah(item.harga_satuan)}</td>
            <td style="padding:6px;text-align:right">${formatRupiah(item.subtotal)}</td>
          </tr>
        `).join('')}
        <tr style="background:#f5f5f5"><td colspan="5" style="padding:6px;text-align:right;font-weight:bold">Sub Total ${div.name}</td><td style="padding:6px;text-align:right;font-weight:bold">${formatRupiah(divTotal)}</td></tr>
      `;
    }).join('');
    w.document.write(`
      <html><head><title>RAB - ${activeProject?.name}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd}th{background:#f0f0f0}</style>
      </head><body>
      <h2 style="text-align:center">RENCANA ANGGARAN BIAYA (RAB)</h2>
      <p style="text-align:center">${activeProject?.name}</p>
      <table><thead><tr><th>No</th><th>Uraian Pekerjaan</th><th>Vol</th><th>Sat</th><th>Harga Satuan</th><th>Jumlah Harga</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <table style="margin-top:16px;margin-left:auto;width:400px">
        <tr><td style="padding:6px">Sub Total</td><td style="padding:6px;text-align:right">${formatRupiah(totalModal)}</td></tr>
        <tr><td style="padding:6px">Margin (${margin}%)</td><td style="padding:6px;text-align:right">${formatRupiah(totalRab - totalModal)}</td></tr>
        <tr style="background:#fffde7"><td style="padding:6px;font-weight:bold">TOTAL RAB</td><td style="padding:6px;text-align:right;font-weight:bold">${formatRupiah(totalRab)}</td></tr>
        ${ppnEnabled ? `<tr><td style="padding:6px">PPN ${ppn}%</td><td style="padding:6px;text-align:right">${formatRupiah(ppnNominal)}</td></tr>` : ''}
        <tr style="background:#fffde7"><td style="padding:6px;font-weight:bold">GRAND TOTAL</td><td style="padding:6px;text-align:right;font-weight:bold">${formatRupiah(grandTotal)}</td></tr>
      </table>
      <p style="margin-top:12px">Terbilang: ~ ${terbilang(grandTotal)} RUPIAH ~</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (!activeProject) return <Layout title="Rekapitulasi RAB"><EmptyState icon="📋" title="Pilih proyek aktif terlebih dahulu" /></Layout>;

  return (
    <Layout title="Rekapitulasi RAB">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-navy">Rekapitulasi RAB</h2>
          <p className="text-xs text-gray-500">{activeProject.name} · {items.length} item · Total RAP: {formatRupiah(totalModal)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4" /> Cetak PDF</Button>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Main Table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-10">NO</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">URAIAN PEKERJAAN</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-16">VOL</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-14">SAT</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-32">HARGA SATUAN</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-32">JUMLAH HARGA</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-20">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {divisions.map(div => {
                  const divItems = items.filter(i => i.division_id === div.id);
                  const divTotal = divItems.reduce((s, i) => s + i.subtotal, 0);
                  return [
                    <tr key={`div-${div.id}`} style={{ background: '#FFFDE7' }}>
                      <td className="px-3 py-2.5 font-bold text-sm text-gray-700">{div.roman_number}</td>
                      <td colSpan="5" className="px-3 py-2.5 font-bold text-sm text-gray-800">{div.name}</td>
                      <td className="px-3 py-2.5"></td>
                    </tr>,
                    ...divItems.map(item => (
                      <RabItemRow key={item.id} item={item} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} onMove={() => {}} />
                    )),
                    <tr key={`div-add-${div.id}`}>
                      <td colSpan="7" className="px-3 py-2">
                        <button
                          onClick={() => { setAddItemDivId(div.id); setNewItem(p => ({ ...p, division_id: div.id })); setShowAddItem(true); }}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Tambah Item
                        </button>
                      </td>
                    </tr>,
                    divItems.length > 0 && <tr key={`div-total-${div.id}`} className="bg-gray-50">
                      <td colSpan="5" className="px-3 py-2 text-xs font-semibold text-right text-gray-600">Sub Total {div.name}</td>
                      <td className="px-3 py-2 text-xs font-bold">{formatRupiah(divTotal)}</td>
                      <td></td>
                    </tr>
                  ];
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-gray-600">SUB TOTAL</span><span className="font-semibold">{formatRupiah(totalModal)}</span></div>
              <div className="flex justify-between text-sm bg-yellow-50 px-2 py-1 rounded"><span className="font-bold">TOTAL RAB (Modal × {1 + margin / 100})</span><span className="font-bold">{formatRupiah(totalRab)}</span></div>
              {ppnEnabled && <div className="flex justify-between text-sm"><span className="text-gray-600">PPN {ppn}%</span><span>{formatRupiah(ppnNominal)}</span></div>}
              <div className="flex justify-between text-sm bg-yellow-50 px-2 py-1.5 rounded"><span className="font-bold">GRAND TOTAL</span><span className="font-bold text-base">{formatRupiah(grandTotal)}</span></div>
              <div className="text-xs text-gray-500 italic mt-2">Terbilang: ~ {terbilang(grandTotal)} RUPIAH ~</div>
            </div>

            {/* Add Division Button */}
            <div className="border-t border-gray-100 p-3">
              <button onClick={() => setShowAddDiv(true)} className="text-sm text-primary hover:underline flex items-center gap-1">
                <Plus className="w-4 h-4" /> Tambah Divisi
              </button>
            </div>
          </div>
        </div>

        {/* Profit Panel */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sticky top-20">
            <h4 className="font-bold text-navy mb-4 flex items-center gap-2 text-sm">📈 Analisis Profit</h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">MODAL (RAP)</span><span className="font-bold">{formatRupiah(totalModal)}</span></div>
              <div className="flex justify-between bg-yellow-50 px-2 py-1 rounded"><span className="font-bold">TOTAL RAB</span><span className="font-bold">{formatRupiah(totalRab)}</span></div>

              <div className="border-t pt-3">
                <p className="text-gray-500 font-semibold mb-1.5">⚙️ SETTING MARGIN (%)</p>
                <div className="flex gap-1.5">
                  <input type="number" min={0} max={100} value={margin} onChange={e => setMargin(Number(e.target.value))} className="input-field text-xs" />
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={ppnEnabled} onChange={e => setPpnEnabled(e.target.checked)} className="rounded" />
                  <span>PPN (%)</span>
                  <input type="number" min={0} max={100} value={ppn} onChange={e => setPpn(Number(e.target.value))} className="input-field text-xs w-12 ml-auto" />
                </label>
              </div>

              <div className="border-t pt-3 space-y-1">
                {ppnEnabled && <div className="flex justify-between"><span>PPN {ppn}%</span><span>{formatRupiah(ppnNominal)}</span></div>}
                <div className="flex justify-between font-bold"><span>Grand Total</span><span>{formatRupiah(grandTotal)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal open={showAddItem} onClose={() => setShowAddItem(false)} title="Tambah Item RAB" size="lg">
        <div className="space-y-4">
          {masterAnalisa.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">Pilih dari AHSP Library</label>
              <select className="input-field mt-1" onChange={e => { const a = masterAnalisa.find(x => x.id === Number(e.target.value)); if (a) handleSelectAnalisa(a); }}>
                <option value="">-- Input Manual --</option>
                {masterAnalisa.map(a => <option key={a.id} value={a.id}>{a.kode} - {a.nama} ({a.satuan})</option>)}
              </select>
            </div>
          )}
          <Input label="Uraian Pekerjaan *" value={newItem.uraian} onChange={e => setNewItem({ ...newItem, uraian: e.target.value })} placeholder="Nama pekerjaan" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Volume" type="number" value={newItem.volume} onChange={e => setNewItem({ ...newItem, volume: e.target.value })} />
            <Input label="Satuan" value={newItem.satuan} onChange={e => setNewItem({ ...newItem, satuan: e.target.value })} />
            <Input label="Harga Satuan (Rp)" type="number" value={newItem.harga_satuan} onChange={e => setNewItem({ ...newItem, harga_satuan: e.target.value })} />
          </div>
          <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
            <span className="text-sm font-semibold">Subtotal:</span>
            <span className="font-bold">{formatRupiah(newItem.volume * newItem.harga_satuan)}</span>
          </div>
          <Select label="Divisi" value={newItem.division_id} onChange={e => setNewItem({ ...newItem, division_id: e.target.value })}>
            <option value="">-- Pilih Divisi --</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.roman_number}. {d.name}</option>)}
          </Select>
          <Button onClick={handleAddItem} className="w-full justify-center">TAMBAH ITEM</Button>
        </div>
      </Modal>

      {/* Add Division Modal */}
      <Modal open={showAddDiv} onClose={() => setShowAddDiv(false)} title="Tambah Divisi Baru">
        <div className="space-y-4">
          <Input label="Nama Divisi" value={newDivName} onChange={e => setNewDivName(e.target.value)} placeholder="Cth: MEKANIKAL & ELEKTRIKAL" />
          <Button onClick={handleAddDiv} className="w-full justify-center">TAMBAH DIVISI</Button>
        </div>
      </Modal>
    </Layout>
  );
}
