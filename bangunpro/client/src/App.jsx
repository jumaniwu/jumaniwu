import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Landing from './pages/saas/Landing';
import Pricing from './pages/saas/Pricing';
import Dashboard from './pages/dashboard/Dashboard';
import DataProyek from './pages/proyek/DataProyek';
import Rekapitulasi from './pages/rekapitulasi/Rekapitulasi';
import Invoice from './pages/invoice/Invoice';
import Logistik from './pages/logistik/Logistik';
import KurvaS from './pages/kurvas/KurvaS';
import Keuangan from './pages/keuangan/Keuangan';
import Progress from './pages/progress/Progress';
import MasterHarga from './pages/master/MasterHarga';
import MasterAnalisa from './pages/master/MasterAnalisa';
import PekerjaanPage from './pages/pekerjaan/PekerjaanPage';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/data-proyek" element={<RequireAuth><DataProyek /></RequireAuth>} />
      <Route path="/rekapitulasi" element={<RequireAuth><Rekapitulasi /></RequireAuth>} />
      <Route path="/invoice" element={<RequireAuth><Invoice /></RequireAuth>} />
      <Route path="/logistik" element={<RequireAuth><Logistik /></RequireAuth>} />
      <Route path="/kurva-s" element={<RequireAuth><KurvaS /></RequireAuth>} />
      <Route path="/keuangan" element={<RequireAuth><Keuangan /></RequireAuth>} />
      <Route path="/progress" element={<RequireAuth><Progress /></RequireAuth>} />
      <Route path="/master-harga" element={<RequireAuth><MasterHarga /></RequireAuth>} />
      <Route path="/master-analisa" element={<RequireAuth><MasterAnalisa /></RequireAuth>} />
      <Route path="/pekerjaan/:jenis" element={<RequireAuth><PekerjaanPage /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{ className: 'text-sm font-medium', duration: 3000 }} />
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
