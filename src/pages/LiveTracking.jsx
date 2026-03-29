import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Search, Shield, Truck, Plus, Trash2, Navigation,
  MapPin, Play, RotateCcw, ChevronDown, ChevronUp,
  Map as RouteIcon, StopCircle, Wifi
} from 'lucide-react';
import MapErrorBoundary from '../components/common/MapErrorBoundary';
import deviceService from '../services/deviceService';
import locationService from '../services/locationService';
import toast from 'react-hot-toast';

// ── Leaflet icon fix ──────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const truckIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
  iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -38],
});
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// Pulsing green live marker
const liveIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:44px;height:44px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(34,197,94,0.3);animation:lp 1.4s ease-out infinite;"></div>
      <div style="position:absolute;inset:6px;border-radius:50%;background:rgba(34,197,94,0.5);animation:lp 1.4s ease-out infinite;animation-delay:.3s;"></div>
      <img src="https://cdn-icons-png.flaticon.com/512/3063/3063822.png"
           style="position:absolute;inset:6px;width:32px;height:32px;filter:drop-shadow(0 0 8px #22c55e);" />
    </div>
    <style>@keyframes lp{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}</style>
  `,
  iconSize: [44, 44], iconAnchor: [22, 44], popupAnchor: [0, -44],
});

const createDotIcon = (color, label) => L.divIcon({
  className: '',
  html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:white;">${label}</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14],
});

// ── Safe coord validator ──────────────────────────────
const isValid = (lat, lng) =>
  lat != null && lng != null &&
  !isNaN(lat) && !isNaN(lng) &&
  isFinite(lat) && isFinite(lng) &&
  lat >= -90 && lat <= 90 &&
  lng >= -180 && lng <= 180;

// ── Map sub-components ────────────────────────────────
function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions || positions.length < 2) return;
    try {
      const valid = positions.filter(p => Array.isArray(p) && isValid(p[0], p[1]));
      if (valid.length >= 2) map.fitBounds(L.latLngBounds(valid), { padding: [50, 50] });
    } catch (e) { console.warn('FitBounds error', e); }
  }, [positions, map]);
  return null;
}

function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (isValid(lat, lng)) map.flyTo([lat, lng], 15, { duration: 1.0 });
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onMapClick, active }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const handler = (e) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    map.getContainer().style.cursor = 'crosshair';
    return () => { map.off('click', handler); map.getContainer().style.cursor = ''; };
  }, [active, onMapClick, map]);
  return null;
}

// ── OSRM route ────────────────────────────────────────
async function fetchOSRMRoute(wps) {
  const valid = (wps || []).filter(w => isValid(w.lat, w.lng));
  if (valid.length < 2) return null;
  const coords = valid.map(w => `${w.lng},${w.lat}`).join(';');
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.length > 0) {
      return {
        path: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distance: (data.routes[0].distance / 1000).toFixed(1),
        duration: Math.round(data.routes[0].duration / 60),
      };
    }
  } catch {}
  return null;
}

// ── Bhopal simulation path ────────────────────────────
const SIM_PATH = [
  { lat: 23.2200, lng: 77.3800 }, { lat: 23.2280, lng: 77.3880 },
  { lat: 23.2350, lng: 77.3950 }, { lat: 23.2420, lng: 77.4010 },
  { lat: 23.2500, lng: 77.4050 }, { lat: 23.2560, lng: 77.4090 },
  { lat: 23.2599, lng: 77.4126 }, { lat: 23.2640, lng: 77.4180 },
  { lat: 23.2700, lng: 77.4260 }, { lat: 23.2750, lng: 77.4350 },
  { lat: 23.2780, lng: 77.4450 }, { lat: 23.2810, lng: 77.4530 },
  { lat: 23.2820, lng: 77.4600 }, { lat: 23.2790, lng: 77.4520 },
  { lat: 23.2750, lng: 77.4420 }, { lat: 23.2700, lng: 77.4300 },
  { lat: 23.2640, lng: 77.4200 }, { lat: 23.2599, lng: 77.4126 },
];

const ROUTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const DEFAULT_CENTER = [23.2599, 77.4126];

// ── Main Component ────────────────────────────────────
export default function LiveTracking() {
  const [devices, setDevices]               = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [searchTerm, setSearchTerm]         = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Route planner
  const [routeMode, setRouteMode]           = useState(false);
  const [waypoints, setWaypoints]           = useState([{ lat: '', lng: '', name: '' }, { lat: '', lng: '', name: '' }]);
  const [isAddingWP, setIsAddingWP]         = useState(false);
  const [wpTargetIdx, setWpTargetIdx]       = useState(null);
  const [routeResult, setRouteResult]       = useState(null);
  const [loadingRoute, setLoadingRoute]     = useState(false);
  const [routeError, setRouteError]         = useState('');

  // History
  const [showHistory, setShowHistory]       = useState(false);
  const [historyRoute, setHistoryRoute]     = useState(null);

  // Live
  const [isLive, setIsLive]                 = useState(false);
  const [liveCoords, setLiveCoords]         = useState(null);
  const [livePath, setLivePath]             = useState([]);
  const [liveSpeed, setLiveSpeed]           = useState(0);
  const [flyTrigger, setFlyTrigger]         = useState(null);

  const [panelOpen, setPanelOpen]           = useState(true);
  const mapRef      = useRef(null);
  const simIdxRef   = useRef(0);
  const simBaseRef  = useRef({ lat: 23.2599, lng: 77.4126 });
  const selectedRef = useRef(null);

  useEffect(() => { selectedRef.current = selectedDevice; }, [selectedDevice]);

  // ── Load devices ──────────────────────────────────
  const loadDevices = async () => {
    try {
      const res = await locationService.getAllLive();
      const raw = res.data?.data || [];
      if (raw.length > 0) {
        setDevices(raw.map(normalizeDevice));
        setLoadingDevices(false);
        return;
      }
    } catch {}
    try {
      const res = await deviceService.getAll();
      setDevices((res.data?.data || []).map(normalizeDevice));
    } catch {}
    setLoadingDevices(false);
  };

  useEffect(() => {
    loadDevices();
    const t = setInterval(loadDevices, 15000);
    return () => clearInterval(t);
  }, []);

  const normalizeDevice = (d, i = 0) => {
    const lat = parseFloat(d.lat);
    const lng = parseFloat(d.lng);
    return {
      ...d,
      id: String(d._id || d.id || i),
      name: d.device_name || d.name || 'Unknown',
      lat: isValid(lat, 0) ? lat : 23.2599 + i * 0.02,
      lng: isValid(0, lng) ? lng : 77.4126 + i * 0.02,
      speed: d.speed ?? 0,
      status: d.status === 'Active' ? 'Moving' : 'Parked',
    };
  };

  // ── Live simulation ───────────────────────────────
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const base = simBaseRef.current;
      const idx  = simIdxRef.current;
      const pt   = SIM_PATH[idx % SIM_PATH.length];

      const lat = parseFloat((base.lat + (pt.lat - SIM_PATH[0].lat) + (Math.random() - .5) * .0004).toFixed(6));
      const lng = parseFloat((base.lng + (pt.lng - SIM_PATH[0].lng) + (Math.random() - .5) * .0004).toFixed(6));
      const spd = Math.floor(15 + Math.random() * 65);

      simIdxRef.current = (idx + 1) % SIM_PATH.length;

      if (!isValid(lat, lng)) return; // safety

      setLiveCoords({ lat, lng });
      setLiveSpeed(spd);
      setLivePath(prev => [...prev.slice(-40), [lat, lng]]);
      setFlyTrigger({ lat, lng, ts: Date.now() });

      // push to backend silently
      const dev = selectedRef.current;
      if (dev) {
        locationService.pushLocation(dev._id || dev.id, {
          lat, lng, speed: spd, address: 'Bhopal, MP', battery: 82, signal: 'Strong',
        }).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  // ── Handlers ──────────────────────────────────────
  const handleShowHistory = async (device) => {
    stopLive();
    setSelectedDevice(device);
    setShowHistory(true);
    setHistoryRoute(null);

    const tid = toast.loading('Loading route history...');
    try {
      const res = await locationService.getHistoryWithStats(device._id || device.id);
      const { data, stats } = res.data || {};
      toast.dismiss(tid);

      const pts = (data || []).filter(h => isValid(h.lat, h.lng));
      if (pts.length >= 2) {
        //  Use raw GPS points directly - NOT OSRM (OSRM smooths/changes the route)
        setHistoryRoute({
          path: pts.map(h => [h.lat, h.lng]), //  Raw points = exact GPS data
          distance: stats?.distance ?? '–',
          duration: stats?.duration ?? '–',
          start: pts[0],
          end: pts[pts.length - 1],
        });
        toast.success(`Route: ${stats?.distance ?? '?'} km · ${stats?.duration ?? '?'} min (${pts.length} points)`);
      } else {
        // Koi history nahi — null rakho, map pe kuch mat dikhao
        setShowHistory(false);
        setHistoryRoute(null);
        toast.error(`${device.name} ki koi location history nahi hai`, { duration: 3000 });
      }
    } catch (e) {
      toast.dismiss(tid);
      toast.error('Failed to load history');
    }
  };

  const startLive = (device) => {
    setShowHistory(false);
    setHistoryRoute(null);
    setSelectedDevice(device);
    selectedRef.current = device;

    const base = {
      lat: isValid(device.lat, 0) ? device.lat : 23.2599,
      lng: isValid(0, device.lng) ? device.lng : 77.4126,
    };
    simBaseRef.current = base;
    simIdxRef.current  = 0;

    setLiveCoords(base);
    setLivePath([[base.lat, base.lng]]);
    setLiveSpeed(device.speed || 0);
    setFlyTrigger({ ...base, ts: Date.now() });
    setIsLive(true);

    toast.success(`🟢 Live tracking — ${device.name}`, { duration: 2500 });
  };

  const stopLive = () => {
    setIsLive(false);
    setLiveCoords(null);
    setLivePath([]);
    setFlyTrigger(null);
  };

  const handleStopLive = () => {
    stopLive();
    toast('Tracking stopped', { icon: '⏹️' });
  };

  const updateWP = (i, field, val) => {
    setWaypoints(prev => prev.map((w, idx) => idx === i ? { ...w, [field]: val } : w));
    setRouteResult(null);
  };

  const handleMapClick = useCallback((lat, lng) => {
    if (wpTargetIdx === null) return;
    updateWP(wpTargetIdx, 'lat', lat.toFixed(5));
    updateWP(wpTargetIdx, 'lng', lng.toFixed(5));
    setIsAddingWP(false);
    setWpTargetIdx(null);
  }, [wpTargetIdx]);

  const drawRoute = async () => {
    const valid = waypoints.filter(w => w.lat && w.lng && !isNaN(+w.lat) && !isNaN(+w.lng));
    if (valid.length < 2) { setRouteError('At least 2 valid coordinates required.'); return; }
    setRouteError('');
    setLoadingRoute(true);
    try {
      const wps = valid.map(w => ({ lat: +w.lat, lng: +w.lng }));
      const [osrm, hvRes] = await Promise.all([
        fetchOSRMRoute(wps),
        locationService.calculateRouteDistance(wps).catch(() => null),
      ]);
      setLoadingRoute(false);
      if (osrm) {
        setRouteResult({
          ...osrm,
          haversine: hvRes?.data?.data?.total_distance_km,
          waypoints: valid.map(w => ({ lat: +w.lat, lng: +w.lng, name: w.name })),
        });
      } else {
        setRouteError('Could not fetch route. Check coordinates or try again.');
      }
    } catch {
      setLoadingRoute(false);
      setRouteError('Route calculation failed.');
    }
  };

  const filtered = devices.filter(d => {
    const t = searchTerm.toLowerCase();
    return (d.name || '').toLowerCase().includes(t) || (d.vehicle_id || '').toLowerCase().includes(t);
  });

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-3 relative z-0 mt-2 md:mt-0">

      {/* ── Tabs ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => { setRouteMode(false); setShowHistory(false); if (isLive) handleStopLive(); }}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${!routeMode ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
          <Truck className="w-4 h-4" /> Live Fleet
        </button>
        <button onClick={() => { setRouteMode(true); if (isLive) handleStopLive(); }}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${routeMode ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
          <RouteIcon className="w-4 h-4" /> Route Planner
        </button>

        {isLive && selectedDevice && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/40 rounded-lg">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-bold">{selectedDevice.name} — LIVE</span>
            <span className="text-green-300 text-xs">{liveSpeed} km/h</span>
            <button onClick={handleStopLive} className="ml-1 text-red-400 hover:text-red-300 transition-colors">
              <StopCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isAddingWP && (
          <span className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-bold animate-pulse flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Click map — Point {(wpTargetIdx ?? 0) + 1}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden">

        {/* ── Side Panel ── */}
        <div className="w-full md:w-80 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden order-2 md:order-1 h-[50%] md:h-full">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              {routeMode
                ? <><RouteIcon className="w-4 h-4 text-blue-500" /> Route Planner</>
                : <><Truck className="w-4 h-4 text-blue-500" /> Live Fleet ({devices.length})</>}
            </h3>
            <button className="md:hidden p-1 text-slate-400" onClick={() => setPanelOpen(o => !o)}>
              {panelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto ${!panelOpen ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>

            {/* Fleet List */}
            {!routeMode && (
              <>
                <div className="p-3 border-b border-slate-700/50">
                  <div className="relative">
                    <input type="text" placeholder="Search vehicle..."
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-200"
                      value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {loadingDevices ? (
                    <div className="py-8 text-center">
                      <div className="w-5 h-5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-slate-500 text-xs">Loading devices…</p>
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-center text-slate-500 text-xs py-6">No devices found</p>
                  ) : filtered.map(device => {
                    const deviceIsLive = isLive && selectedDevice?.id === device.id;
                    const isSelected   = selectedDevice?.id === device.id;
                    return (
                      <div key={device.id}
                        className={`rounded-xl border transition-all ${isSelected ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-800/40 border-slate-700/50'}`}>
                        <button onClick={() => setSelectedDevice(device)} className="w-full text-left p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                                {deviceIsLive && <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />}
                                {device.name}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{device.vehicle_id || '—'}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${deviceIsLive ? 'bg-green-500/20 text-green-400' : device.status === 'Moving' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-500'}`}>
                              {deviceIsLive ? 'LIVE' : device.status}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {device.signal || 'Online'}</span>
                            <span className="font-bold text-blue-400">{deviceIsLive ? liveSpeed : device.speed} km/h</span>
                          </div>
                        </button>

                        <div className="px-3 pb-3 space-y-1">
                          <button onClick={() => handleShowHistory(device)}
                            className="w-full py-1.5 text-[10px] font-bold rounded-lg bg-slate-700 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 transition-all flex items-center justify-center gap-1">
                            <RouteIcon className="w-3 h-3" /> Show Route History
                          </button>
                          {deviceIsLive ? (
                            <button onClick={handleStopLive}
                              className="w-full py-1.5 text-[10px] font-bold rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all flex items-center justify-center gap-1">
                              <StopCircle className="w-3 h-3" /> Stop Live
                            </button>
                          ) : (
                            <button onClick={() => startLive(device)}
                              className="w-full py-1.5 text-[10px] font-bold rounded-lg bg-slate-700 hover:bg-green-600/30 text-slate-300 hover:text-green-300 transition-all flex items-center justify-center gap-1">
                              <Wifi className="w-3 h-3" /> Live Location
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Route Planner */}
            {routeMode && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <p className="text-xs text-slate-400">Add coordinates or click 📍 to pick from map.</p>

                {waypoints.map((wp, i) => (
                  <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }}>{i + 1}</div>
                        <span className="text-xs font-bold text-slate-300">
                          {i === 0 ? 'Start' : i === waypoints.length - 1 ? 'End' : `Via ${i}`}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setWpTargetIdx(i); setIsAddingWP(true); }}
                          className={`p-1.5 rounded-lg transition-all ${wpTargetIdx === i ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-400 hover:text-blue-400'}`}>
                          <MapPin className="w-3 h-3" />
                        </button>
                        {waypoints.length > 2 && (
                          <button onClick={() => { setWaypoints(p => p.filter((_, idx) => idx !== i)); setRouteResult(null); }}
                            className="p-1.5 rounded-lg bg-slate-700 text-red-400 hover:bg-red-500/20 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <input type="text" placeholder="Label (optional)" value={wp.name}
                      onChange={e => updateWP(i, 'name', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" step="any" placeholder="Latitude" value={wp.lat}
                        onChange={e => updateWP(i, 'lat', e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                      <input type="number" step="any" placeholder="Longitude" value={wp.lng}
                        onChange={e => updateWP(i, 'lng', e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                ))}

                <button onClick={() => setWaypoints(p => [...p, { lat: '', lng: '', name: '' }])}
                  className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-blue-400 hover:border-blue-500 text-xs font-bold transition-all flex items-center justify-center gap-2">
                  <Plus className="w-3.5 h-3.5" /> Add Waypoint
                </button>

                {routeError && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{routeError}</p>}

                {routeResult && (
                  <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-3 text-xs space-y-1.5">
                    <p className="font-bold text-blue-300 flex items-center gap-1"><Navigation className="w-3 h-3" /> Route Calculated</p>
                    <p className="text-slate-300">Road Distance: <span className="font-bold text-white">{routeResult.distance} km</span></p>
                    {routeResult.haversine && (
                      <p className="text-slate-300">Haversine: <span className="font-bold text-white">{routeResult.haversine} km</span></p>
                    )}
                    <p className="text-slate-300">Est. Time: <span className="font-bold text-white">{routeResult.duration} min</span></p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={drawRoute} disabled={loadingRoute}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                    {loadingRoute
                      ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calculating...</>
                      : <><Play className="w-3.5 h-3.5" /> Draw Route</>}
                  </button>
                  <button onClick={() => { setRouteResult(null); setWaypoints([{ lat:'',lng:'',name:'' },{ lat:'',lng:'',name:'' }]); setRouteError(''); }}
                    className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-400 transition-all">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Map ── */}
        <MapErrorBoundary>
        <div className="flex-1 order-1 md:order-2 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl relative h-[50%] md:h-full z-0">
          <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <MapController mapRef={mapRef} />
            <MapClickHandler onMapClick={handleMapClick} active={isAddingWP} />

            {/* FitBounds */}
            {routeMode && routeResult?.path?.length >= 2 && <FitBounds positions={routeResult.path} />}
            {!routeMode && showHistory && historyRoute?.path?.length >= 2 && <FitBounds positions={historyRoute.path} />}

            {/* FlyTo — triggered on each live update */}
            {isLive && flyTrigger && <FlyTo lat={flyTrigger.lat} lng={flyTrigger.lng} key={flyTrigger.ts} />}

            {/* All fleet markers — history mode mein sirf selected device dikhao, baaki hide */}
            {!routeMode && devices.filter(d => {
              if (!isValid(d.lat, d.lng)) return false;
              // Jab history dikh rahi ho — sirf selected device ka marker dikhao
              if (showHistory && historyRoute) return d.id === selectedDevice?.id;
              return true;
            }).map(device => {
              const deviceIsLive = isLive && selectedDevice?.id === device.id;
              const pos = deviceIsLive && liveCoords && isValid(liveCoords.lat, liveCoords.lng)
                ? [liveCoords.lat, liveCoords.lng]
                : [device.lat, device.lng];
              return (
                <Marker key={device.id} position={pos}
                  icon={deviceIsLive ? liveIcon : truckIcon}
                  eventHandlers={{ click: () => setSelectedDevice(device) }}>
                  <Popup>
                    <div className="min-w-[140px]">
                      <p className="font-bold border-b pb-1 mb-1">{device.name}</p>
                      <p className="text-xs text-gray-600">🚗 {device.vehicle_id || '–'}</p>
                      <p className="text-xs text-gray-600">⚡ {deviceIsLive ? liveSpeed : device.speed} km/h</p>
                      <p className="text-xs text-gray-600">📶 {device.signal || 'Good'}</p>
                      {deviceIsLive && <p className="text-xs text-green-600 font-bold mt-1 animate-pulse">● LIVE TRACKING</p>}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Live trail (dashed green line) */}
            {!routeMode && isLive && livePath.length >= 2 && (
              <Polyline
                positions={livePath.filter(p => isValid(p[0], p[1]))}
                color="#22c55e" weight={4} opacity={0.85} dashArray="10 5"
              />
            )}

            {/* History route */}
            {!routeMode && showHistory && historyRoute && (() => {
              const path = (historyRoute.path || []).filter(p => isValid(p[0], p[1]));
              const start = historyRoute.start;
              const end   = historyRoute.end;
              return (
                <>
                  {path.length >= 2 && <Polyline positions={path} color="#3b82f6" weight={5} opacity={0.85} />}
                  {start && isValid(start.lat, start.lng) && (
                    <Marker position={[start.lat, start.lng]} icon={greenIcon}>
                      <Popup><strong>Start Point</strong><br />{start.address || ''}</Popup>
                    </Marker>
                  )}
                  {end && isValid(end.lat, end.lng) && (
                    <Marker position={[end.lat, end.lng]} icon={redIcon}>
                      <Popup><strong>End Point</strong><br />{end.address || ''}</Popup>
                    </Marker>
                  )}
                </>
              );
            })()}

            {/* Planned route */}
            {routeMode && routeResult && (() => {
              const wps = routeResult.waypoints || [];
              const first = wps[0];
              const last  = wps[wps.length - 1];
              return (
                <>
                  <Polyline positions={routeResult.path} color="#6366f1" weight={5} opacity={0.9} />
                  {first && isValid(first.lat, first.lng) && (
                    <Marker position={[first.lat, first.lng]} icon={greenIcon}>
                      <Popup><strong>Start</strong>{first.name ? ` — ${first.name}` : ''}</Popup>
                    </Marker>
                  )}
                  {last && isValid(last.lat, last.lng) && (
                    <Marker position={[last.lat, last.lng]} icon={redIcon}>
                      <Popup><strong>End</strong>{last.name ? ` — ${last.name}` : ''}</Popup>
                    </Marker>
                  )}
                </>
              );
            })()}

            {/* Planning dots */}
            {routeMode && !routeResult && waypoints
              .filter(w => w.lat && w.lng && !isNaN(+w.lat) && !isNaN(+w.lng))
              .map((wp, i, arr) => {
                if (i !== 0 && i !== arr.length - 1) return null;
                return (
                  <Marker key={i} position={[+wp.lat, +wp.lng]}
                    icon={createDotIcon(ROUTE_COLORS[i % ROUTE_COLORS.length], i === 0 ? 'S' : 'E')}>
                    <Popup>{i === 0 ? 'Start' : 'End'}{wp.name ? ` — ${wp.name}` : ''}</Popup>
                  </Marker>
                );
              })}
          </MapContainer>

          {/* Legend */}
          <div className="absolute right-4 bottom-4 bg-slate-900/95 backdrop-blur-sm p-4 rounded-xl border border-slate-700 z-[500] text-xs space-y-2 min-w-[170px] shadow-2xl">
            {!routeMode ? (
              <>
                <p className="font-bold text-slate-300 text-[11px] uppercase tracking-wide">Fleet</p>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-400 rounded-full" /><span>Moving</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-slate-500 rounded-full" /><span>Parked</span></div>

                {showHistory && historyRoute && (
                  <div className="border-t border-slate-700 pt-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-1 bg-blue-500 rounded" />
                      <span className="text-slate-300">History</span>
                    </div>
                    <p className="text-blue-400 font-bold">{historyRoute.distance} km · {historyRoute.duration} min</p>
                  </div>
                )}

                {isLive && (
                  <div className="border-t border-slate-700 pt-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-green-400 font-bold">LIVE</span>
                    </div>
                    <p className="text-green-300">{liveSpeed} km/h</p>
                    <p className="text-slate-500 text-[10px]">Updates every 3s</p>
                  </div>
                )}
                <p className="text-slate-600 border-t border-slate-700/50 pt-1 text-[10px]">Fleet refresh: 15s</p>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-300 text-[11px] uppercase tracking-wide">Planner</p>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-indigo-400 rounded-full" /><span>Route</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-green-400 rounded-full" /><span>Start</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-red-400 rounded-full" /><span>End</span></div>
                <p className="text-slate-600 border-t border-slate-700/50 pt-1 text-[10px]">OSRM + Haversine</p>
              </>
            )}
          </div>
        </div>
        </MapErrorBoundary>
      </div>
    </div>
  );
}