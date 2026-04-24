import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Building2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Email atau password salah');
    } finally { setLoading(false); }
  };

  const fillDemo = () => { setValue('email', 'demo@bangunpro.id'); setValue('password', 'demo123'); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 60%, #0f3460 100%)' }}>
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #F5A623, transparent)', transform: 'translate(30%, -30%)' }} />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', transform: 'translate(-30%, 30%)' }} />

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 relative">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: '#1A1A2E' }}>
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-[#1A1A2E]">Selamat Datang</h1>
          <p className="text-gray-400 text-sm mt-1">Masuk ke akun BangunPro Anda</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</label>
            <input type="email" className="input mt-1.5" placeholder="email@domain.com"
              {...register('email', { required: 'Email wajib diisi' })} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Password</label>
            <div className="relative mt-1.5">
              <input type={show ? 'text' : 'password'} className="input pr-11" placeholder="••••••••"
                {...register('password', { required: 'Password wajib diisi' })} />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading}
            className="btn btn-primary btn-lg w-full justify-center mt-2 text-base font-black">
            {loading ? 'Memproses...' : <><span>MASUK</span><ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        {/* Demo hint */}
        <button type="button" onClick={fillDemo}
          className="w-full mt-4 p-3 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-all cursor-pointer">
          <p className="text-xs text-amber-800 font-semibold text-center">
            🎯 Demo: <strong>demo@bangunpro.id</strong> / <strong>demo123</strong>
            <span className="text-amber-600 ml-1">(klik untuk isi otomatis)</span>
          </p>
        </button>

        <p className="text-center text-sm text-gray-400 mt-5">
          Belum punya akun?{' '}
          <Link to="/register" className="text-primary font-bold hover:underline">Daftar Gratis</Link>
        </p>
      </div>
    </div>
  );
}
