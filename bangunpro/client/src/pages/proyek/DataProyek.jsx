import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, MoreVertical, MapPin, User, Calendar, Trash2, Edit2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../../components/layout/Layout';
import { Modal, Button, ConfirmDialog, EmptyState, PageHeader, Badge } from '../../components/ui';
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
    try { const r = await api.get('/projects'); setProjects(r.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSetActive = async (id) => {
    await api.post(`/projects/${id}/set-active`);
    await fetchActive();
    toast.success('Workspace dibuka!');
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
      toast.success('Proyek berhasil dibuat!');
    }
    setShowForm(false); setEditProject(null); load();
  };

  return (
    <Layout title="Data Proyek">
      <PageHeader
        title="Data Proyek"
        sub="Kelola proyek konstruksi Anda di sini."
        actions={
          <Button onClick={() => { setEditProject(null); setShowForm(true); }}>
            <PlusCircle className="w-4 h-4" /> Proyek Baru
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-52 bg-white rounded-2xl animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState icon="📁" title="Belum ada proyek" desc="Tap '+ Proyek Baru' untuk memulai proyek pertama Anda."
          action={<Button onClick={() => setShowForm(true)}><PlusCircle className="w-4 h-4" /> Proyek Baru</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden">
              {/* Card top color strip */}
              <div className={`h-1.5 ${p.active ? 'bg-emerald-400' : 'bg-gray-200'}`} />

              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-sm">{p.type === 'gedung' ? '🏗️' : '🛣️'}</span>
                    </div>
                    <h3 className="font-bold text-[#1A1A2E] text-sm leading-tight line-clamp-2 flex-1">{p.name}</h3>
                  </div>
                  <div className="relative ml-2">
                    <button onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-all">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                    {openMenu === p.id && (
                      <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-2xl shadow-xl z-10 py-1.5 min-w-40 overflow-hidden">
                        <button onClick={() => { setEditProject(p); setShowForm(true); setOpenMenu(null); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700">
                          <Edit2 className="w-3.5 h-3.5" /> Edit Proyek
                        </button>
                        <button onClick={() => { setDeleteId(p.id); setOpenMenu(null); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500">
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 flex-1">
                  {p.lokasi && <div className="flex items-center gap-2 text-xs text-gray-500"><MapPin className="w-3 h-3 text-gray-400" />{p.lokasi}</div>}
                  {p.pemilik && <div className="flex items-center gap-2 text-xs text-gray-500"><User className="w-3 h-3 text-gray-400" />{p.pemilik}</div>}
                  {p.tanggal_mulai && <div className="flex items-center gap-2 text-xs text-gray-500"><Calendar className="w-3 h-3 text-gray-400" />{p.tanggal_mulai}</div>}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Estimasi Biaya</p>
                      <p className="font-black text-[#1A1A2E] text-sm mt-0.5">{formatRupiah(p.total_rab || 0)}</p>
                    </div>
                    {p.active === 1 && <Badge color="green"><CheckCircle className="w-3 h-3 mr-1" />AKTIF</Badge>}
                  </div>
                  <button onClick={() => handleSetActive(p.id)}
                    className="w-full btn btn-primary btn-md justify-center text-sm">
                    BUKA WORKSPACE →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditProject(null); }} title={editProject ? 'Edit Proyek' : 'Proyek Baru'}>
        <ProyekForm initial={editProject} onSave={handleSave} onCancel={() => { setShowForm(false); setEditProject(null); }} />
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => handleDelete(deleteId)}
        title="Hapus Proyek?" message="Semua data RAB dan laporan proyek ini akan dihapus permanen." />

      {openMenu && <div className="fixed inset-0 z-5" onClick={() => setOpenMenu(null)} />}
    </Layout>
  );
}
