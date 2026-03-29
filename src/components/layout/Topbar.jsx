import { Menu, X, Bell } from 'lucide-react';

export default function Topbar({ sidebarOpen, setSidebarOpen }) {
  return (
    <div className="bg-slate-900 border-b border-slate-700/60 px-4 lg:px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 lg:gap-4 overflow-hidden">
          <button onClick={() => setSidebarOpen(o => !o)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors shrink-0 text-slate-300">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="truncate">
            <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent truncate">
              GPS Fleet Tracker
            </h1>
            <p className="hidden sm:block text-xs text-slate-400 truncate">Vehicle Management Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          <button className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-300">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 lg:px-4 py-2 rounded-lg border border-slate-700">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs lg:text-sm text-slate-300">System Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
