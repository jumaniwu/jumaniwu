import { X, Loader2 } from 'lucide-react';

export function Button({ children, variant = 'primary', size = 'md', className = '', loading, ...props }) {
  const base = 'inline-flex items-center gap-2 font-semibold rounded-lg transition-all disabled:opacity-60 cursor-pointer';
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    danger: 'bg-danger text-white hover:opacity-90',
    ghost: 'text-gray-600 hover:bg-gray-100',
    dark: 'bg-navy text-white hover:opacity-90',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700', green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700', yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-blue-100 text-blue-700', orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors[color]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg text-navy">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>}
      <input className={`input-field ${error ? 'border-red-400' : ''} ${className}`} {...props} />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>}
      <select className={`input-field bg-white ${error ? 'border-red-400' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>{children}</div>;
}

export function StatCard({ title, value, sub, bg = 'white', textColor = 'text-navy', icon }) {
  const bgMap = { white: 'bg-white', dark: 'bg-navy', orange: 'bg-primary' };
  const titleColor = bg === 'white' ? 'text-gray-500' : 'text-white/70';
  const valueColor = bg === 'white' ? textColor : 'text-white';
  const subColor = bg === 'white' ? 'text-gray-400' : 'text-white/60';
  return (
    <div className={`${bgMap[bg]} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${titleColor}`}>{title}</p>
          <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
          {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
        </div>
        {icon && <div className={`p-2 rounded-lg ${bg === 'white' ? 'bg-gray-50' : 'bg-white/10'}`}>{icon}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, desc, icon }) {
  return (
    <div className="text-center py-16">
      {icon && <div className="text-5xl mb-3">{icon}</div>}
      <p className="font-semibold text-gray-700">{title}</p>
      {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Batal</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }} className="flex-1">Hapus</Button>
        </div>
      </div>
    </div>
  );
}
