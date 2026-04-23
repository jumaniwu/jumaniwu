import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const { register: regUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await regUser(data.name, data.email, data.password);
      toast.success('Akun berhasil dibuat! Selamat datang.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-navy rounded-xl mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-navy">BANGUNPRO</h1>
          <p className="text-gray-500 text-sm mt-1">Daftar & coba gratis 8 jam</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase">Nama Lengkap</label>
            <input className="input-field mt-1" placeholder="John Doe" {...register('name', { required: 'Nama wajib diisi' })} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase">Email</label>
            <input type="email" className="input-field mt-1" placeholder="email@domain.com" {...register('email', { required: 'Email wajib diisi' })} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase">Password</label>
            <input type="password" className="input-field mt-1" placeholder="Min. 6 karakter" {...register('password', { required: 'Password wajib', minLength: { value: 6, message: 'Min. 6 karakter' } })} />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase">Konfirmasi Password</label>
            <input type="password" className="input-field mt-1" placeholder="Ulangi password" {...register('confirm', { validate: v => v === watch('password') || 'Password tidak cocok' })} />
            {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm.message}</p>}
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary-dark transition-all disabled:opacity-60 mt-2">
            {loading ? 'Mendaftar...' : 'DAFTAR GRATIS — Coba 8 Jam'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
