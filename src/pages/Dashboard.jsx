import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, Shield, AlertTriangle, Clock, TrendingUp,
  MapPin, Battery, Signal, Navigation, Eye,
  Activity, Zap, ChevronRight, RefreshCw
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import StatusBadge from '../components/common/StatusBadge';
import { formatDate } from '../utils/formatDate';
import deviceService from '../services/deviceService';
import locationService from '../services/locationService';
import toast from 'react-hot-toast';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const truckIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
});

const ACTIVITY_STYLE = {
  success: 'bg-green-500/20 text-green-400 border border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  danger:  'bg-red-500/20 text-red-400 border border-red-500/30',
  info:    'bg-blue-500/20 text-blue-400 border border-blue-500/30',
};
const ACTIVITY_ICON = { success: '✓', warning: '!', danger: '!!', info: '→' };

const DEMO_ACTIVITY = [
  { time: new Date(Date.now() - 30*60000).toISOString(), device: 'Truck A-1', action: 'Route completed', type: 'success', address: 'Mandideep Entry', speed: 20 },
  { time: new Date(Date.now() - 90*60000).toISOString(), device: 'Delivery Van 03', action: 'Signal lost', type: 'warning', address: 'MP Nagar', speed: 0 },
  { time: new Date(Date.now() - 120*60000).toISOString(), device: 'Cargo Truck 02', action: 'Speed alert 83 km/h', type: 'danger', address: 'Hoshangabad Road', speed: 83 },
  { time: new Date(Date.now() - 180*60000).toISOString(), device: 'Project Car', action: 'Trip started', type: 'info', address: 'Depot, Bhopal', speed: 0 },
];

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({ total:0, active:0, inactive:0, lowBattery:0, expiringSoon:0 });
  const [selectedId, setSelectedId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [devRes, statsRes, liveRes] = await Promise.all([
        deviceService.getAll({ limit: 20 }),
        deviceService.getStats(),
        locationService.getAllLive(),
      ]);

      // Merge live location data into devices
      const liveMap = {};
      (liveRes.data?.data || []).forEach(d => { liveMap[d._id] = d; });

      const devs = (devRes.data?.data || []).map(d => ({
        ...d,
        id: d._id,
        device_name: d.device_name || d.name || 'Unknown',
        lat: liveMap[d._id]?.lat ?? d.lat ?? 23.2599,
        lng: liveMap[d._id]?.lng ?? d.lng ?? 77.4126,
        speed: liveMap[d._id]?.speed ?? d.speed ?? 0,
        battery: d.battery ?? 80,
        signal: d.signal || 'Good',
        lastSeen: d.last_seen ? formatDate(d.last_seen, 'HH:mm') : 'Recently',
        address: d.address || 'Bhopal Area',
        distance_today: `${Math.round(d.distance_today || 0)} km`,
      }));

      setDevices(devs);
      if (devs.length && !selectedId) setSelectedId(devs[0]._id || devs[0].id);
      setStats(statsRes.data?.data || {});
    } catch (err) {
      console.error(err);
      // silent fail - keep existing state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setLastRefresh(new Date());
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const selected = devices.find(d => (d._id || d.id) === selectedId) || devices[0];
  const activeDevices = devices.filter(d => d.status === 'Active');
  const inactiveDevices = devices.filter(d => d.status !== 'Active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Fleet Overview</h2>
          <p className="text-slate-400 text-sm">
            {devices.length} devices · Updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Devices',    value: stats.total     || devices.length, icon: Truck,         color: 'blue',   sub: `${stats.active || activeDevices.length} active`,    grad: 'from-blue-600/20 to-blue-900/10' },
          { label: 'Active & Moving',  value: stats.active    || activeDevices.length, icon: Zap, color: 'green',  sub: 'Live tracking',                                        grad: 'from-green-600/20 to-green-900/10' },
          { label: 'Offline Units',    value: stats.inactive  || inactiveDevices.length, icon: AlertTriangle, color: 'orange', sub: (stats.inactive || inactiveDevices.length) > 0 ? 'Needs attention' : 'All OK', grad: 'from-orange-600/20 to-orange-900/10' },
          { label: 'Low Battery',      value: stats.lowBattery || 0, icon: Battery, color: 'red', sub: stats.expiringSoon > 0 ? `${stats.expiringSoon} plan expiring` : 'Plans OK', grad: 'from-red-600/20 to-red-900/10' },
        ].map((s, i) => (
          <div key={i} className={`bg-gradient-to-br ${s.grad} border border-slate-700/80 p-5 rounded-2xl shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{s.label}</p>
                <p className="text-4xl font-black mt-1.5 text-white">{loading ? '–' : s.value}</p>
                <p className={`text-xs mt-1 font-medium text-${s.color}-400`}>{s.sub}</p>
              </div>
              <div className={`p-2.5 bg-${s.color}-500/20 rounded-xl text-${s.color}-400 group-hover:scale-110 transition-transform shrink-0`}>
                <s.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: Map + Selected */}
        <div className="xl:col-span-2 space-y-4">
          {/* Device tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {devices.map(d => (
              <button key={d._id || d.id} onClick={() => setSelectedId(d._id || d.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  selectedId === (d._id || d.id)
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${d.status === 'Active' ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                {d.device_name}
              </button>
            ))}
          </div>

          {/* Map */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl h-[360px] relative">
            <MapContainer
              center={selected ? [selected.lat, selected.lng] : [23.2599, 77.4126]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              key={selectedId}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              {devices.filter(d => d.lat && d.lng).map(d => (
                <Marker key={d._id || d.id} position={[d.lat, d.lng]} icon={truckIcon}
                  eventHandlers={{ click: () => setSelectedId(d._id || d.id) }}>
                  <Popup>
                    <div className="min-w-[140px] text-sm">
                      <p className="font-bold border-b pb-1 mb-1">{d.device_name}</p>
                      <p className="text-xs text-gray-600">🚗 {d.vehicle_id}</p>
                      <p className="text-xs text-gray-600">📍 {d.address}</p>
                      <p className="text-xs text-gray-600">⚡ {d.speed} km/h</p>
                      <p className="text-xs text-gray-600">🔋 {d.battery}%</p>
                      <Link to={`/devices/${d._id || d.id}`} onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-blue-500 font-bold mt-1 block hover:underline">View Details →</span>
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Legend */}
            <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-2.5 rounded-xl border border-slate-700 text-[10px] space-y-1.5 shadow-lg">
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><span className="text-slate-300 font-medium">{activeDevices.length} Moving</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 bg-slate-500 rounded-full" /><span className="text-slate-400">{inactiveDevices.length} Parked</span></div>
            </div>
            <Link to="/live" className="absolute bottom-3 right-3 z-[1000]">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all">
                <Navigation className="w-3 h-3" /> Full Live View
              </button>
            </Link>
          </div>

          {/* Selected Device Card */}
          {selected && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-black text-lg shrink-0">
                    {selected.device_name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white leading-tight">{selected.device_name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{selected.vehicle_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <Link to={`/devices/${selected._id || selected.id}`}>
                    <button className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Speed</p>
                  <p className="text-2xl font-black text-white leading-none">{selected.speed}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">km/h</p>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Battery</p>
                  <div className="flex items-center gap-1.5">
                    <Battery className={`w-4 h-4 shrink-0 ${(selected.battery ?? 100) > 25 ? 'text-green-500' : 'text-red-500'}`} />
                    <p className="text-2xl font-black text-white leading-none">{selected.battery ?? '–'}</p>
                    <p className="text-[10px] text-slate-400 self-end mb-0.5">%</p>
                  </div>
                  <div className="mt-1.5 bg-slate-700 h-1 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${(selected.battery ?? 0) > 25 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${selected.battery ?? 0}%` }} />
                  </div>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Signal</p>
                  <div className="flex items-center gap-1.5">
                    <Signal className={`w-4 h-4 shrink-0 ${selected.signal === 'Strong' ? 'text-green-500' : selected.signal === 'Good' ? 'text-blue-400' : 'text-yellow-500'}`} />
                    <p className="text-sm font-bold text-white">{selected.signal}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 truncate">{selected.mobile_num}</p>
                </div>
                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/50">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Today</p>
                  <p className="text-2xl font-black text-white leading-none">{selected.distance_today?.replace(' km','') || 0}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">km driven</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400 border-t border-slate-700 pt-3">
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-blue-400" />{selected.address}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-400" />Last: {selected.lastSeen}</span>
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-slate-500" />Plan: {formatDate(selected.plan_validity, 'dd MMM yyyy')}</span>
                <Link to={`/devices/${selected._id || selected.id}`} className="ml-auto text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
                  Full details <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Device list + Activity + Performance */}
        <div className="space-y-5">
          {/* Device List */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" /> All Devices
              </h3>
              <Link to="/devices" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 font-medium">
                Manage <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-slate-700/50 max-h-[280px] overflow-y-auto">
              {loading ? (
                <div className="py-8 text-center text-slate-500 text-xs">Loading devices...</div>
              ) : devices.map(d => (
                <div key={d._id || d.id} onClick={() => setSelectedId(d._id || d.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${selectedId === (d._id || d.id) ? 'bg-blue-600/10 border-l-2 border-blue-500' : 'hover:bg-slate-700/40 border-l-2 border-transparent'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${d.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                    {d.device_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-xs text-slate-200 truncate">{d.device_name}</p>
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-mono truncate">{d.vehicle_id}</span>
                      <span className="text-[10px] text-blue-400 font-bold shrink-0">{d.speed} km/h</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-0.5">
                      <Battery className={`w-3 h-3 ${(d.battery ?? 100) > 25 ? 'text-green-400' : 'text-red-400'}`} />
                      <span className={`text-[10px] font-bold ${(d.battery ?? 100) > 25 ? 'text-green-400' : 'text-red-400'}`}>{d.battery}%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{d.lastSeen}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Activity Log
              </h3>
              <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full font-bold">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Live
              </span>
            </div>
            <div className="divide-y divide-slate-700/50">
              {DEMO_ACTIVITY.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5 ${ACTIVITY_STYLE[item.type]}`}>
                    {ACTIVITY_ICON[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{item.device}</p>
                    <p className="text-[11px] text-slate-400 truncate">{item.action}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500 truncate">{item.address}</span>
                      {item.speed > 0 && <span className="text-[10px] text-blue-400 font-bold shrink-0">{item.speed} km/h</span>}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 whitespace-nowrap shrink-0">
                    {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Fleet Performance */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="absolute -top-2 -right-2 opacity-10 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-24 h-24" />
            </div>
            <h4 className="font-bold text-white text-sm mb-3">Fleet Performance</h4>
            <div className="flex items-end gap-1.5 mb-2">
              <span className="text-3xl font-black text-white">94%</span>
              <span className="text-xs text-blue-100 mb-1">uptime this month</span>
            </div>
            <div className="bg-white/20 h-1.5 rounded-full overflow-hidden mb-4">
              <div className="bg-white h-full rounded-full" style={{ width: '94%' }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['257 km', 'Avg/day'],
                [activeDevices.length, 'Online now'],
                [`${devices.length > 0 ? Math.round((activeDevices.length / devices.length) * 100) : 0}%`, 'Active rate'],
              ].map(([val, lbl]) => (
                <div key={lbl} className="bg-white/15 rounded-xl py-2 px-1">
                  <p className="text-white font-bold text-sm">{val}</p>
                  <p className="text-blue-200 text-[9px] font-medium mt-0.5">{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
