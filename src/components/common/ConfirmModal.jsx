import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText, type = 'danger' }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2 rounded-lg ${type === 'danger' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-slate-400">{message}</p>
        </div>
        <div className="p-4 bg-slate-900/50 flex gap-3 justify-end px-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${type === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
