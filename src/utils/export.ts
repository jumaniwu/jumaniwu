// ============================================================
// PropFS — Export Utilities (PDF & JSON)
// ============================================================

import type { SavedProject } from '../types/fs.types'

/**
 * Export project data ke JSON file
 */
export function exportToJSON(project: SavedProject): void {
  const data = JSON.stringify(project, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${sanitizeFilename(project.name)}_${formatDateForFile()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Import project dari JSON file
 */
export async function importFromJSON(file: File): Promise<SavedProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as SavedProject
        resolve(data)
      } catch {
        reject(new Error('File JSON tidak valid'))
      }
    }
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsText(file)
  })
}

/**
 * Export halaman report ke PDF menggunakan jsPDF + html2canvas
 */
export async function exportToPDF(
  elementId = 'report-content',
  filename = 'propfs-report',
): Promise<void> {
  // Dynamic import untuk code splitting
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const element = document.getElementById(elementId)
  if (!element) {
    console.error(`Element #${elementId} tidak ditemukan`)
    return
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth  = 210  // A4 mm
    const pageHeight = 297
    const margin     = 10
    const imgWidth   = pageWidth - margin * 2
    const imgHeight  = (canvas.height / canvas.width) * imgWidth

    let yPos = margin
    let heightLeft = imgHeight

    pdf.addImage(imgData, 'JPEG', margin, yPos, imgWidth, imgHeight)
    heightLeft -= pageHeight - margin * 2

    while (heightLeft > 0) {
      yPos = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', margin, yPos, imgWidth, imgHeight)
      heightLeft -= pageHeight - margin * 2
    }

    pdf.save(`${sanitizeFilename(filename)}_${formatDateForFile()}.pdf`)
  } catch (err) {
    console.error('Gagal export PDF:', err)
    throw new Error('Gagal mengekspor PDF. Coba lagi.')
  }
}

/**
 * Print halaman report langsung dari browser
 */
export function printReport(): void {
  window.print()
}

// ── HELPERS ───────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50)
}

function formatDateForFile(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
