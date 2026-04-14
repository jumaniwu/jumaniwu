import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useFSStore } from './store/fsStore'
import { Toaster } from './components/ui/toaster'

// Code-split routes
const Dashboard  = lazy(() => import('./pages/Dashboard'))
const InputPage  = lazy(() => import('./pages/InputPage'))
const ResultPage = lazy(() => import('./pages/ResultPage'))
const ReportPage = lazy(() => import('./pages/ReportPage'))

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto">
          <svg viewBox="0 0 64 64" className="w-full h-full animate-spin" fill="none">
            <circle cx="32" cy="32" r="28" stroke="#C9A84C" strokeWidth="4" strokeOpacity="0.2"/>
            <path d="M32 4 A28 28 0 0 1 60 32" stroke="#C9A84C" strokeWidth="4" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-muted-foreground font-sans text-sm">Memuat PropFS…</p>
      </div>
    </div>
  )
}

export default function App() {
  const isDarkMode = useFSStore(s => s.isDarkMode)

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/input/:id?" element={<InputPage />} />
          <Route path="/result/:id" element={<ResultPage />} />
          <Route path="/report/:id" element={<ReportPage />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  )
}
