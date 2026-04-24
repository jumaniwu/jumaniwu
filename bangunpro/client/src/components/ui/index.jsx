import { X, Loader2, AlertTriangle } from 'lucide-react';

export function Button({ children, variant = 'primary', size = 'md', className = '', loading, type = 'button', ...props }) {
  const v = { primary: 'btn-primary', outline: 'btn-outline', danger: 'btn-danger', ghost: 'btn-ghost', dark: 'btn-dark' };
  const s = { sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' };
  return (
    <button type={type} className={`btn ${v[variant] || v.primary} ${s[size] || s.md} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({ children, color = 'gray', className = '' }) {
  const c = {
    gray: 'bg-gray-100 text-gray-600', green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    red: 'bg-red-50 text-red-600 border border-red-200', yellow: 'bg-amber-50 text-amber-700 border border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200', orange: 'bg-orange-50 text-orange-700 border border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
  };
  return <span className={`badge ${c[color] || c.gray} ${className}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, size = 'md', noPad = false }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-full h-full' };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white w-full ${sizes[size]} rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-base text-[#1A1A2E]">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm rounded-xl p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <div className={`overflow-y-auto flex-1 ${noPad ? '' : 'p-5'}`}>{children}</div>
      </div>
    </div>
  );
}

export function Input({ label, error, hint, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>}
      <input className={`input ${error ? 'input-error' : ''} ${className}`} {...props} />
      {hint && !error && <span className="text-xs text-gray-400">{hint}</span>}
      {error && <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</span>}
    </div>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>}
      <select className={`input bg-white ${error ? 'input-error' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function StatCard({ title, value, sub, bg = 'white', icon, accent = false }) {
  const isDark = bg === 'dark' || bg === 'orange';
  return (
    <div className={`rounded-2xl p-5 shadow-sm relative overflow-hidden ${bg === 'dark' ? 'bg-[#1A1A2E]' : bg === 'orange' ? 'bg-primary' : 'bg-white border border-gray-100'}`}>
      {accent && !isDark && <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-t-2xl" />}
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-white/50' : 'text-gray-400'}`}>{title}</p>
          <p className={`text-xl sm:text-2xl font-black mt-1 ${isDark ? 'text-white' : 'text-[#1A1A2E]'}`}>{value}</p>
          {sub && <p className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{sub}</p>}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-xl ${isDark ? 'bg-white/10' : 'bg-gray-50'}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, desc, icon, action }) {
  return (
    <div className="text-center py-16 px-4">
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      <p className="font-bold text-gray-700 text-base">{title}</p>
      {desc && <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Batal</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }} className="flex-1">Ya, Hapus</Button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, actions }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export function SectionCard({ title, children, action, className = '' }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          {title && <h3 className="font-bold text-[#1A1A2E] text-sm">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
