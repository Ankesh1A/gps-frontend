import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Plus, Filter, Eye, Trash2 } from 'lucide-react';
import deviceService from '../services/deviceService';
import { formatDate } from '../utils/formatDate';
import toast from 'react-hot-toast';

export default function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await deviceService.getAll();
      setDevices(res.data?.data || []);
    } catch (err) {
      toast.error('Failed to fetch devices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, [location.key]);

  const filtered = devices.filter(d => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (d.device_name || '').toLowerCase().includes(s) ||
      (d.imei || '').toString().includes(searchTerm) ||
      (d.vehicle_id || '').toLowerCase().includes(s) ||
      (d.mobile_num || '').includes(searchTerm)
    );
  });

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this device?')) return;
    try {
      await deviceService.delete(id);
      setDevices(prev => prev.filter(d => d._id !== id));
      toast.success('Device deleted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const getStatusClass = (status) => status === 'Active'
    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">GPS Devices</h2>
          <p className="text-slate-400 text-sm">Manage and monitor all your tracking units</p>
        </div>
        <Link to="/devices/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 font-medium">
          <Plus className="w-4 h-4" /> Add Device
        </Link>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input type="text" placeholder="Search by name, IMEI or vehicle ID..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 text-slate-200 transition-all"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          </div>
          <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Device Name</th>
                <th className="px-6 py-4">IMEI / Mobile</th>
                <th className="px-6 py-4">Vehicle ID</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Plan Validity</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-500">
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                    Loading devices...
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                  {searchTerm ? `No devices matching "${searchTerm}"` : 'No devices found. Add your first device!'}
                </td></tr>
              ) : filtered.map(device => (
                <tr key={device._id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200">{device.device_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">ID: {device.device_id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-mono text-slate-300">{device.imei}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{device.mobile_num || '—'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300 font-mono">{device.vehicle_id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusClass(device.status)}`}>
                      {device.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {formatDate(device.plan_validity, 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center gap-1">
                      <Link to={`/devices/${device._id}`}
                        className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors" title="View Details">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDelete(device._id)}
                        className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-700 text-xs text-slate-500">
            Showing {filtered.length} of {devices.length} devices
          </div>
        )}
      </div>
    </div>
  );
}
