import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, SortAsc, Building2, FileJson } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import Header from '@/components/layout/Header'
import ProjectCard from '@/components/shared/ProjectCard'
import { useFSStore } from '@/store/fsStore'
import { toast } from '@/hooks/use-toast'
import { importFromJSON } from '@/utils/export'
import type { SavedProject } from '@/types/fs.types'

type SortKey = 'date' | 'name' | 'status' | 'revenue'

export default function Dashboard() {
  const navigate = useNavigate()
  const projects     = useFSStore(s => s.projects)
  const createProject = useFSStore(s => s.createProject)
  const loadProject   = useFSStore(s => s.loadProject)
  const deleteProject = useFSStore(s => s.deleteProject)
  const duplicateProject = useFSStore(s => s.duplicateProject)

  const [search, setSearch]         = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>('date')
  const [showNewDialog, setNewDialog] = useState(false)

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return projects
      .filter(p =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.inputs.alamatLokasi.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        switch (sortKey) {
          case 'name':    return a.name.localeCompare(b.name)
          case 'date':    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          case 'status':  return (a.results?.statusKelayakan ?? 'z').localeCompare(b.results?.statusKelayakan ?? 'z')
          case 'revenue': return (b.results?.grossRevenue ?? 0) - (a.results?.grossRevenue ?? 0)
          default:        return 0
        }
      })
  }, [projects, search, sortKey])

  function handleNewProject(template: 'A' | 'B' | null) {
    setNewDialog(false)
    const id = createProject(template ?? undefined)
    navigate(`/input/${id}`)
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const project = await importFromJSON(file)
        // Add to store via a workaround
        useFSStore.setState(state => ({
          projects: [{ ...project, id: project.id } as SavedProject, ...state.projects.filter(p => p.id !== project.id)],
        }))
        toast({ title: 'Proyek berhasil diimport', variant: 'success' })
      } catch {
        toast({ title: 'Gagal mengimport file', variant: 'destructive' })
      }
    }
    input.click()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-navy dark:text-gold">
              Dashboard Proyek
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {projects.length} proyek tersimpan · PropFS oleh PT. Mettaland Batam Sukses
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleImport} className="gap-2">
              <FileJson className="h-4 w-4" />
              Import JSON
            </Button>
            <Button variant="gold" onClick={() => setNewDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Buat Proyek Baru
            </Button>
          </div>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama proyek atau lokasi…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
              <SortAsc className="h-4 w-4" /> Urutkan:
            </span>
            {([['date', 'Terbaru'], ['name', 'Nama'], ['revenue', 'Revenue'], ['status', 'Status']] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  sortKey === key
                    ? 'bg-navy text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Projects grid */}
        {filtered.length === 0 ? (
          <EmptyState onCreate={() => setNewDialog(true)} search={search} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={(id) => {
                  if (confirm(`Hapus proyek "${projects.find(p => p.id === id)?.name}"?`)) {
                    deleteProject(id)
                    toast({ title: 'Proyek dihapus' })
                  }
                }}
                onDuplicate={(id) => {
                  const newId = duplicateProject(id)
                  toast({ title: 'Proyek diduplikat', variant: 'success' })
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* New project dialog */}
      <Dialog open={showNewDialog} onOpenChange={setNewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Proyek Baru</DialogTitle>
            <DialogDescription>
              Pilih template untuk mengisi data awal, atau mulai dari kosong.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 mt-2">
            {/* Blank */}
            <button
              onClick={() => handleNewProject(null)}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-border hover:border-gold/60 hover:bg-gold/5 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold text-sm">Proyek Kosong</div>
                <div className="text-xs text-muted-foreground mt-0.5">Mulai dari awal, isi semua data manual</div>
              </div>
            </button>

            {/* Template A */}
            <button
              onClick={() => handleNewProject('A')}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-sm">Template A — Perumahan Landed</div>
                <div className="text-xs text-muted-foreground mt-0.5">King Square - Bodhi Dharma | 5 tipe | 130.000 m² | 3 fase</div>
              </div>
            </button>

            {/* Template B */}
            <button
              onClick={() => handleNewProject('B')}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="font-semibold text-sm">Template B — Ruko Komersial</div>
                <div className="text-xs text-muted-foreground mt-0.5">Ruko 2LT Batam Centre | 3 tipe | 5.500 m² | 1 fase</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState({ onCreate, search }: { onCreate: () => void; search: string }) {
  if (search) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Tidak ada proyek yang cocok dengan "<strong>{search}</strong>"</p>
      </div>
    )
  }
  return (
    <div className="py-24 text-center space-y-4">
      <div className="w-20 h-20 mx-auto bg-muted rounded-2xl flex items-center justify-center">
        <Building2 className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-serif font-semibold text-lg">Belum Ada Proyek</h3>
        <p className="text-muted-foreground text-sm mt-1">Buat proyek FS pertama Anda untuk memulai</p>
      </div>
      <Button variant="gold" onClick={onCreate} className="gap-2">
        <Plus className="h-4 w-4" />
        Buat Proyek Baru
      </Button>
    </div>
  )
}
