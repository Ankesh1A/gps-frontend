import { NavLink } from 'react-router-dom';
import { Home, Layout, PlusCircle, LogOut, Navigation, Monitor, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const menuItems = [
  { id: 'dashboard', icon: Home, label: 'Dashboard', path: '/' },
  { id: 'devices', icon: Layout, label: 'Device List', path: '/devices' },
  { id: 'add-device', icon: PlusCircle, label: 'Add Device', path: '/devices/add' },
  { id: 'live', icon: Navigation, label: 'Live Tracking', path: '/live' },
];

export default function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed lg:relative z-50 h-screen ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'} bg-slate-900 border-r border-slate-700/60 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-5 border-b border-slate-700/60 flex items-center gap-3 min-h-[73px] relative">
          <button onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shrink-0 shadow-lg shadow-blue-900/30">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <h2 className="font-bold text-lg text-white leading-tight">GPS Tracker</h2>
              <p className="text-xs text-slate-400">Fleet Management</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map(item => (
            <NavLink key={item.id} to={item.path} end
              onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
              className={({ isActive }) => `relative w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${isActive ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <item.icon className="w-5 h-5 shrink-0" />
              <span className={`font-medium transition-all ${!sidebarOpen ? 'lg:hidden' : ''}`}>{item.label}</span>
              {!sidebarOpen && (
                <span className="hidden lg:block pointer-events-none absolute left-full ml-3 z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-slate-800 text-white border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-150">
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        {sidebarOpen && (
          <div className="p-3 border-t border-slate-700/60">
            <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
              <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-blue-400 to-teal-500 rounded-full flex items-center justify-center font-bold text-sm text-white">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">{user?.name || 'Admin'}</div>
                <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors p-1" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
