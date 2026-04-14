// ============================================================
// PropFS — Zustand Global State Store
// ============================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { FSInputs, FSResults, SavedProject } from '../types/fs.types'
import { DEFAULT_INPUTS, TEMPLATE_A, TEMPLATE_B } from '../types/fs.types'
import { calculateFS } from '../engine/calculator'

const APP_VERSION = '1.0.0'

// ── STORE TYPES ────────────────────────────────────────────

interface FSStore {
  // Saved projects list
  projects: SavedProject[]

  // Current working project
  currentProjectId: string | null
  currentInputs: FSInputs
  currentResults: FSResults | null
  currentStep: number  // 1–7

  // UI state
  isDarkMode: boolean
  isSaving: boolean

  // ── PROJECT ACTIONS ──────────────────────────────────────
  createProject: (template?: 'A' | 'B' | null) => string
  loadProject: (id: string) => void
  saveCurrentProject: () => void
  deleteProject: (id: string) => void
  duplicateProject: (id: string) => string

  // ── INPUT ACTIONS ─────────────────────────────────────────
  updateInputs: (partial: Partial<FSInputs>) => void
  setCurrentStep: (step: number) => void

  // ── CALCULATION ──────────────────────────────────────────
  calculate: () => FSResults

  // ── UI ACTIONS ────────────────────────────────────────────
  toggleDarkMode: () => void
  reset: () => void
}

// ── HELPERS ───────────────────────────────────────────────

function mergeTemplate(template?: 'A' | 'B' | null): FSInputs {
  if (template === 'A') {
    return { ...DEFAULT_INPUTS, ...TEMPLATE_A } as FSInputs
  }
  if (template === 'B') {
    return { ...DEFAULT_INPUTS, ...TEMPLATE_B } as FSInputs
  }
  return { ...DEFAULT_INPUTS }
}

// ── STORE ─────────────────────────────────────────────────

export const useFSStore = create<FSStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      currentInputs: { ...DEFAULT_INPUTS },
      currentResults: null,
      currentStep: 1,
      isDarkMode: false,
      isSaving: false,

      // ── CREATE PROJECT ────────────────────────────────────
      createProject: (template) => {
        const id = uuidv4()
        const inputs = mergeTemplate(template)
        const now = new Date().toISOString()

        const project: SavedProject = {
          id,
          createdAt: now,
          updatedAt: now,
          name: inputs.namaProyek || 'Proyek Baru',
          inputs,
          results: null,
          version: APP_VERSION,
        }

        set(state => ({
          projects: [project, ...state.projects],
          currentProjectId: id,
          currentInputs: inputs,
          currentResults: null,
          currentStep: 1,
        }))

        return id
      },

      // ── LOAD PROJECT ──────────────────────────────────────
      loadProject: (id) => {
        const project = get().projects.find(p => p.id === id)
        if (!project) return

        set({
          currentProjectId: id,
          currentInputs: project.inputs,
          currentResults: project.results,
          currentStep: project.results ? 1 : 1,
        })
      },

      // ── SAVE PROJECT ──────────────────────────────────────
      saveCurrentProject: () => {
        const { currentProjectId, currentInputs, currentResults, projects } = get()
        if (!currentProjectId) return

        const now = new Date().toISOString()
        const updated = projects.map(p =>
          p.id === currentProjectId
            ? {
                ...p,
                name: currentInputs.namaProyek || p.name,
                inputs: currentInputs,
                results: currentResults,
                updatedAt: now,
              }
            : p
        )

        set({ projects: updated })
      },

      // ── DELETE PROJECT ────────────────────────────────────
      deleteProject: (id) => {
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          currentProjectId:
            state.currentProjectId === id ? null : state.currentProjectId,
        }))
      },

      // ── DUPLICATE PROJECT ─────────────────────────────────
      duplicateProject: (id) => {
        const original = get().projects.find(p => p.id === id)
        if (!original) return id

        const newId = uuidv4()
        const now = new Date().toISOString()
        const copy: SavedProject = {
          ...original,
          id: newId,
          name: `${original.name} (Salinan)`,
          inputs: {
            ...original.inputs,
            namaProyek: `${original.inputs.namaProyek} (Salinan)`,
          },
          createdAt: now,
          updatedAt: now,
        }

        set(state => ({ projects: [copy, ...state.projects] }))
        return newId
      },

      // ── UPDATE INPUTS ─────────────────────────────────────
      updateInputs: (partial) => {
        set(state => ({
          currentInputs: { ...state.currentInputs, ...partial },
          currentResults: null,  // invalidate results when inputs change
        }))

        // Auto-save after small delay
        setTimeout(() => get().saveCurrentProject(), 500)
      },

      setCurrentStep: (step) => set({ currentStep: step }),

      // ── CALCULATE ─────────────────────────────────────────
      calculate: () => {
        const { currentInputs } = get()
        const results = calculateFS(currentInputs)

        set({ currentResults: results })

        // Save with results
        setTimeout(() => get().saveCurrentProject(), 100)

        return results
      },

      // ── UI ACTIONS ────────────────────────────────────────
      toggleDarkMode: () => set(state => ({ isDarkMode: !state.isDarkMode })),

      reset: () => set({
        currentProjectId: null,
        currentInputs: { ...DEFAULT_INPUTS },
        currentResults: null,
        currentStep: 1,
      }),
    }),
    {
      name: 'propfs-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist projects list and dark mode preference
      partialize: (state) => ({
        projects: state.projects,
        isDarkMode: state.isDarkMode,
      }),
    }
  )
)
