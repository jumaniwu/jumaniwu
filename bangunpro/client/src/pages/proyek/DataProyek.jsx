import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, MoreVertical, MapPin, User, Calendar, Trash2, Edit2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Modal, Button, ConfirmDialog, EmptyState } from '../../components/ui';
import { formatRupiah } from '../../lib/rupiah';
import api from '../../lib/api';
import { useProject } from '../../context/ProjectContext';
import ProyekForm from './ProyekForm';

export default function DataProyek() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const { fetchActive } = useProject();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/projects');
      setProjects(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSetActive = async (id) => {
    await api.post(`/projects/${id}/set-active`);
    await fetchActive();
    toast.success('Proyek aktif berubah');
    navigate('/dashboard');
  };

  const handleDelete = async (id) => {
    await api.delete(`/projects/${id}`);
    toast.success('Proyek dihapus');
    load();
  };

  const handleSave = async (data) => {
    if (editProject) {
      await api.put(`/projects/${editProject.id}`, data);
      toast.success('Proyek diperbarui');
    } else {
      await api.post('/projects', data);
      toast.success('Proyek berhasil dibuat');
    }
    setShowForm(false);
    setEditProject(null);
    load();
  };

  return (
    <Layout title="Data Proyek">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-navy">Data Proyek</h2>
          <p className="text-sm text-gray-500">Kelola proyek konstruksi dan akses RAB Anda di sini.</p>
        </div>
        <Button onClick={() => { setEditProject(null); setShowForm(true); }}>
          <PlusCircle className="w-4 h-4" /> Proyek Baru
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-52 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState icon="📁" title="Belum ada proyek" desc="Klik '+ Proyek Baru' untuk mulai." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-navy text-sm leading-tight flex-1 pr-2">{p.name}</h3>
                <div className="relative">
                  <button onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)} className="p-1 hover:bg-gray-100 rounded">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                  {openMenu === p.id && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1 min-w-36">
                      <button onClick={() => { setEditProject(p); setShowForm(true); setOpenMenu(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => { setDeleteId(p.id); setOpenMenu(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 text-red-500">
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 flex-1">
                {p.lokasi && <div className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin className="w-3 h-3" />{p.lokasi}</div>}
                {p.pemilik && <div className="flex items-center gap-1.5 text-xs text-gray-500"><User className="w-3 h-3" />{p.pemilik}</div>}
                {p.tanggal_mulai && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Calendar className="w-3 h-3" />{p.tanggal_mulai}</div>}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Estimasi Biaya</p>
                    <p className="font-bold text-navy text-sm">{formatRupiah(p.total_rab || 0)}</p>
                  </div>
                  {p.active === 1 && (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">AKTIF</span>
                  )}
                </div>
                <Button onClick={() => handleSetActive(p.id)} className="w-full justify-center" size="sm">
                  BUKA WORKSPACE
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditProject(null); }} title={editProject ? 'Edit Proyek' : 'Proyek Baru'}>
        <ProyekForm initial={editProject} onSave={handleSave} onCancel={() => { setShowForm(false); setEditProject(null); }} />
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => handleDelete(deleteId)} title="Hapus Proyek?" message="Data RAB dan semua data terkait akan ikut terhapus. Tindakan ini tidak bisa dibatalkan." />

      {openMenu && <div className="fixed inset-0 z-5" onClick={() => setOpenMenu(null)} />}
    </Layout>
  );
}
