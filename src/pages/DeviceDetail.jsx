import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Power, RefreshCw, Calendar,
  Battery, Signal, Smartphone, Clock, Map as RouteIcon, Navigation, Play, Copy
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import deviceService from '../services/deviceService';
import locationService from '../services/locationService';
import { formatDate } from '../utils/formatDate';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmModal from '../components/common/ConfirmModal';
import toast from 'react-hot-toast';

// Add CSS for vehicle marker animation
const vehicleMarkerStyle = `
  .vehicle-marker-wrapper {
    animation: bikePulse 2s infinite ease-in-out;
    transform-origin: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  @keyframes bikePulse {
    0% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(59,130,246,0.8)); }
    50% { transform: scale(1.2); filter: drop-shadow(0 0 14px rgba(59,130,246,1.0)); }
    100% { transform: scale(1); filter: drop-shadow(0 0 6px rgba(59,130,246,0.8)); }
  }
`;

const copyToClipboard = (text, label) => {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied!`, { duration: 2000 });
  }).catch(() => {
    toast.error('Failed to copy');
  });
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41],
});
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41],
});

//  NEW: Bike emoji DivIcon — no CDN dependency, always visible
const vehicleIcon = L.divIcon({
  className: '',
  html: `<div class="vehicle-marker-wrapper" style="font-size:34px;line-height:1;">🏍️</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -24],
});

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Remove GPS outliers (points > maxDistanceKm from median cluster) ─────────
function filterOutlierPoints(points, maxDistanceKm = 5) {
  if (!points || points.length < 3) return points || [];

  const validPoints = points.filter(p =>
    p && typeof p.lat === 'number' && typeof p.lng === 'number' &&
    !isNaN(p.lat) && !isNaN(p.lng) &&
    p.lat >= -90 && p.lat <= 90 &&
    p.lng >= -180 && p.lng <= 180
  );

  if (validPoints.length < 2) return validPoints;

  const sortedLats = [...validPoints.map(p => p.lat)].sort((a, b) => a - b);
  const sortedLngs = [...validPoints.map(p => p.lng)].sort((a, b) => a - b);
  const medLat = sortedLats[Math.floor(sortedLats.length / 2)];
  const medLng = sortedLngs[Math.floor(sortedLngs.length / 2)];

  return validPoints.filter(p =>
    haversine(p.lat, p.lng, medLat, medLng) <= maxDistanceKm
  );
}

// ─── Fetch address from lat/lng using Nominatim ───────────────────────────────
const fetchAddress = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    return data.display_name || 'Unknown Address';
  } catch (err) {
    console.error('Address fetch error:', err);
    return 'Error fetching address';
  }
};

function MapAutoPan({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2) {
      map.panTo(center);
    }
  }, [center, map]);
  return null;
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length >= 2) map.fitBounds(L.latLngBounds(positions), { padding: [60,60] });
  }, [positions, map]);
  return null;
}

async function fetchOSRMRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) return null;
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes.length > 0) {
      return {
        path: data.routes[0].geometry.coordinates.map(([lng,lat]) => [lat,lng]),
        osrm_distance: (data.routes[0].distance / 1000).toFixed(2),
        osrm_duration: Math.round(data.routes[0].duration / 60),
      };
    }
  } catch {}
  return null;
}

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showPowerModal, setShowPowerModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState([23.2599, 77.4126]);
  const [showLiveMarker, setShowLiveMarker] = useState(true);
  const [liveLocationFetched, setLiveLocationFetched] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeDrawn, setRouteDrawn] = useState(false);
  const [addresses, setAddresses] = useState({});

  // ─── Load device info ────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await deviceService.getById(id);
        const d = res.data?.data;
        setDevice(d);
        if (d?.lat && d?.lng) setCurrentLocation([d.lat, d.lng]);
      } catch (err) {
        toast.error('Failed to load device');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // ─── Load history on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const loadHistory = async () => {
      try {
        const res = await locationService.getHistory(id);
        const payload = res.data;
        if (!payload) return setHistory([]);

        let raw = [];
        const d = payload.data;
        if (Array.isArray(d)) {
          raw = d;
        } else if (d && d.points && Array.isArray(d.points)) {
          raw = d.points;
        } else if (Array.isArray(payload)) {
          raw = payload;
        }

        //  Show ALL raw points without filtering for better visibility
        setHistory(raw);

        if (raw.length > 0 && !liveLocationFetched) {
          const latest = raw[raw.length - 1];
          setCurrentLocation([latest.lat, latest.lng]);
          setShowLiveMarker(true);
        }
      } catch {}
    };
    loadHistory();
  }, [id]);

  // ─── Auto-refresh live location every 10 seconds ─────────────────────────────
  useEffect(() => {
    if (!id) return;

    const pollLiveLocation = async () => {
      try {
        const res = await locationService.getCurrentLocation(id);
        const loc = res.data?.data;
        if (loc?.lat && loc?.lng) {
          setCurrentLocation([loc.lat, loc.lng]);
          setLiveLocationFetched(true);
        }
      } catch (err) {
        console.error('Poll error:', err.message);
      }
    };

    pollLiveLocation();
    const interval = setInterval(pollLiveLocation, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const handleToggleStatus = async () => {
    const newStatus = device.status === 'Active' ? 'Disabled' : 'Active';
    try {
      await deviceService.toggleStatus(id, newStatus);
      setDevice({ ...device, status: newStatus });
      toast.success(`Device ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handlePowerToggle = async () => {
    const action = device.status === 'Active' ? 'off' : 'on';
    try {
      await deviceService.powerToggle(id, action);
      setDevice({ ...device, status: action === 'off' ? 'Disabled' : 'Active' });
      toast.success(`Remote power ${action} command sent!`);
      setShowPowerModal(false);
    } catch (err) {
      toast.error(`Power ${action} failed`);
    }
  };

  const handleGetLocation = async () => {
    const tid = toast.loading('Requesting live location...');
    try {
      const res = await locationService.getCurrentLocation(id);
      const loc = res.data?.data;
      if (loc?.lat && loc?.lng) {
        setCurrentLocation([loc.lat, loc.lng]);
        setShowLiveMarker(true);
        setLiveLocationFetched(true);
        toast.dismiss(tid);
        toast.success('Live location updated!');
      } else {
        throw new Error('No location');
      }
    } catch {
      toast.dismiss(tid);
      if (history.length > 0) {
        const latest = history[history.length - 1];
        setCurrentLocation([latest.lat, latest.lng]);
        setShowLiveMarker(true);
        setLiveLocationFetched(true);
        toast.success('Showing last known location');
      } else if (device?.lat && device?.lng) {
        setCurrentLocation([device.lat, device.lng]);
        setShowLiveMarker(true);
        setLiveLocationFetched(true);
        toast.success('Showing device registered location');
      } else {
        toast.error('Could not determine location');
      }
    }
  };

  // ─── Apply date filter ───────────────────────────────────────────────────────
  const handleApplyFilter = async () => {
    if (!startDate && !endDate) {
      toast.error('Please select at least one date');
      return;
    }
    setLoadingRoute(true);
    const tid = toast.loading('Fetching route from backend...');
    try {
      const res = await locationService.getHistoryWithStats(id, startDate, endDate);
      const { data, stats } = res.data;
      toast.dismiss(tid);
      setLoadingRoute(false);

      if (!data || data.length === 0) {
        toast.error('No data for selected date range');
        setHistory([]);
        setRouteData(null);
        setRouteDrawn(false);
        return;
      }

      //  Show ALL raw points in the table, but filter for route calculation
      setHistory(data);
      const clean = filterOutlierPoints(data);

      if (clean.length < 2) {
        toast('Only 1 valid point — need at least 2 for route', { icon: '⚠️' });
        return;
      }

      const osrmResult = await fetchOSRMRoute(clean.map(h => ({ lat: h.lat, lng: h.lng })));
      if (osrmResult) {
        setRouteData({
          path: osrmResult.path,
          distance: stats.distance,
          duration: stats.duration,
          maxSpeed: stats.maxSpeed,
          avgSpeed: stats.avgSpeed,
        });
      } else {
        setRouteData({
          path: clean.map(h => [h.lat, h.lng]),
          distance: stats.distance,
          duration: stats.duration,
          maxSpeed: stats.maxSpeed,
          avgSpeed: stats.avgSpeed,
        });
      }
      setRouteDrawn(true);
      toast.success(`Route: ${stats.distance} km · ${stats.duration} min (${clean.length} pts)`);
    } catch (err) {
      toast.dismiss(tid);
      setLoadingRoute(false);
      toast.error('Failed to fetch history');
    }
  };

  const handleDrawFullRoute = async () => {
    if (history.length < 2) { toast.error('Need at least 2 history points'); return; }
    setLoadingRoute(true);
    const tid = toast.loading('Calculating full route...');
    try {
      const res = await locationService.getHistoryWithStats(id);
      const { data, stats } = res.data;
      toast.dismiss(tid);
      setLoadingRoute(false);

      if (!data || data.length < 2) { toast.error('Not enough history points'); return; }

      //  Show ALL raw points in the table, but filter for route calculation
      setHistory(data);
      const clean = filterOutlierPoints(data);

      const osrmResult = await fetchOSRMRoute(clean.map(h => ({ lat: h.lat, lng: h.lng })));
      setRouteData({
        path: osrmResult ? osrmResult.path : clean.map(h => [h.lat, h.lng]),
        distance: stats.distance,
        duration: stats.duration,
        maxSpeed: stats.maxSpeed,
        avgSpeed: stats.avgSpeed,
      });
      setRouteDrawn(true);
      toast.success(`Route: ${stats.distance} km · ${stats.duration} min`);
    } catch {
      toast.dismiss(tid);
      setLoadingRoute(false);
      toast.error('Could not load route');
    }
  };

  const handleClearRoute = () => {
    setRouteData(null);
    setRouteDrawn(false);
    setStartDate('');
    setEndDate('');
  };

  const handleFetchAddress = async (log) => {
    const key = log._id || log.time || `${log.lat}-${log.lng}`;
    if (addresses[key]) return; // Already fetched
    const addr = await fetchAddress(log.lat, log.lng);
    setAddresses(prev => ({ ...prev, [key]: addr }));
  };

  const displayName = device?.device_name || 'Unknown Device';

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
      <div className="w-5 h-5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
      Loading device...
    </div>
  );
  if (!device) return <div className="text-center text-slate-400 py-20">Device not found</div>;

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: vehicleMarkerStyle }} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link to="/devices" className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{displayName}</h2>
            <StatusBadge status={device.status} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleGetLocation}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
            <RefreshCw className="w-4 h-4" /> Get Live Location
          </button>
          <button onClick={() => navigate(`/devices/${id}/firmware`)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
             Firmware
          </button>
          <button onClick={() => setShowPowerModal(true)}
            className={`text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
              device.status === 'Active'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}>
            <Power className="w-4 h-4" /> {device.status === 'Active' ? 'Power Off' : 'Power On'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-1 space-y-6">
          {/* Device Info */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-700 bg-slate-900/40">
              <h3 className="font-bold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" /> Device Information
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center text-sm gap-2">
                <span className="text-slate-400 shrink-0">Device ID</span>
                <div className="flex items-center gap-2">
                  <span className="text-right font-mono text-xs text-slate-200">{id || '—'}</span>
                  <button
                    onClick={() => copyToClipboard(id, 'Device ID')}
                    className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-blue-400"
                    title="Copy Device ID"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {[
                { label: 'IMEI Number',  value: device.imei, mono: true },
                { label: 'Mobile No.',   value: device.mobile_num },
                { label: 'Vehicle Reg.', value: device.vehicle_id },
                { label: 'Registered',   value: formatDate(device.registered_on, 'dd MMM yyyy') },
                { label: 'Plan Validity',value: formatDate(device.plan_validity, 'dd MMM yyyy'), highlight: true },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center text-sm gap-2">
                  <span className="text-slate-400 shrink-0">{row.label}</span>
                  <span className={`text-right truncate ${row.mono ? 'font-mono text-xs' : ''} ${row.highlight ? 'text-orange-400 font-medium' : 'text-slate-200'}`}>
                    {row.value || '—'}
                  </span>
                </div>
              ))}

              <div className="pt-4 mt-2 border-t border-slate-700 grid grid-cols-2 gap-3">
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex items-center gap-2">
                  <Battery className={`w-7 h-7 shrink-0 ${(device.battery ?? 100) > 20 ? 'text-green-500' : 'text-red-500'}`} />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Battery</p>
                    <p className="text-base font-bold">{device.battery ?? '–'}%</p>
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 flex items-center gap-2">
                  <Signal className="w-7 h-7 shrink-0 text-blue-500" />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Signal</p>
                    <p className="text-base font-bold">{device.signal || '–'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* History Filter */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 shadow-xl space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" /> History Filter & Route
            </h3>
            <div className="space-y-3">
              {[['From Date', startDate, setStartDate], ['To Date', endDate, setEndDate]].map(([lbl, val, set]) => (
                <div key={lbl} className="space-y-1">
                  <label className="text-xs text-slate-500 font-bold uppercase">{lbl}</label>
                  <input type="date"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                    value={val} onChange={e => set(e.target.value)} />
                </div>
              ))}
            </div>

            <button onClick={handleApplyFilter} disabled={loadingRoute}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2">
              {loadingRoute
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Calculating...</>
                : <><RouteIcon className="w-4 h-4" /> Apply Filter & Draw Route</>}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleDrawFullRoute} disabled={loadingRoute}
                className="py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1">
                <Play className="w-3 h-3" /> Full Route
              </button>
              <button onClick={handleClearRoute}
                className="py-2 rounded-xl text-xs font-bold border border-slate-600 text-slate-400 hover:bg-slate-700 transition-all flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>

            {routeDrawn && routeData && (
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-blue-300 flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Route (Haversine)
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/60 rounded-lg p-2 text-center">
                    <p className="text-slate-400">Distance</p>
                    <p className="font-bold text-white text-base">{routeData.distance} <span className="text-xs text-slate-400">km</span></p>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 text-center">
                    <p className="text-slate-400">Duration</p>
                    <p className="font-bold text-white text-base">{routeData.duration} <span className="text-xs text-slate-400">min</span></p>
                  </div>
                  {routeData.maxSpeed > 0 && (
                    <>
                      <div className="bg-slate-900/60 rounded-lg p-2 text-center">
                        <p className="text-slate-400">Max Speed</p>
                        <p className="font-bold text-white text-base">{routeData.maxSpeed} <span className="text-xs text-slate-400">km/h</span></p>
                      </div>
                      <div className="bg-slate-900/60 rounded-lg p-2 text-center">
                        <p className="text-slate-400">Avg Speed</p>
                        <p className="font-bold text-white text-base">{routeData.avgSpeed} <span className="text-xs text-slate-400">km/h</span></p>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">{history.length} location points used</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Map + Table */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl relative" style={{ height: '450px' }}>

            {/*  REMOVED: coordinates badge — bike marker on map is enough */}

            <MapContainer center={currentLocation} zoom={13} style={{ height:'100%', width:'100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <MapAutoPan center={currentLocation} />
              {routeDrawn && routeData && <FitBounds positions={routeData.path} />}

              {/*  Live bike emoji marker */}
              {showLiveMarker && currentLocation && currentLocation.length === 2 && (
                <Marker
                  key={`bike-${currentLocation[0]}-${currentLocation[1]}`}
                  position={L.latLng(parseFloat(currentLocation[0]), parseFloat(currentLocation[1]))}
                  icon={vehicleIcon}
                  zIndexOffset={1000}
                >
                  <Popup>
                    <strong>🏍️ {displayName}</strong><br />
                    <strong>Bike:</strong> {device?.vehicle_id || 'Unknown'}<br />
                    <span className="text-blue-600 font-bold">📍 Live Location</span><br />
                    <small className="text-slate-500">Auto-updates every 10s</small>
                  </Popup>
                </Marker>
              )}

              {routeDrawn && routeData && (
                <Polyline positions={routeData.path} color="#3b82f6" weight={6} opacity={0.85} />
              )}
              {!routeDrawn && history.length > 1 && (
                <Polyline positions={history.map(h => [h.lat, h.lng])} color="#3b82f6" weight={4} opacity={0.6} dashArray="8 4" />
              )}

              {history.length > 0 && (
                <Marker position={[history[0].lat, history[0].lng]} icon={greenIcon}>
                  <Popup><strong>Start Point</strong><br />{history[0].address}<br /><span className="text-xs text-slate-500">{formatDate(history[0].time)}</span></Popup>
                </Marker>
              )}
              {history.length > 1 && (
                <Marker position={[history[history.length-1].lat, history[history.length-1].lng]} icon={redIcon}>
                  <Popup><strong>End Point</strong><br />{history[history.length-1].address}<br /><span className="text-xs text-slate-500">{formatDate(history[history.length-1].time)}</span></Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          {/* Map Legend */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-slate-700/30 rounded-lg text-xs text-slate-300 border border-slate-600/50">
            <div className="font-bold text-blue-400">📍 Map Legend:</div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🏍️</span>
              <span className="font-semibold text-blue-400">Live Bike</span>
            </div>
            <div className="flex items-center gap-1.5">
              <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png" className="h-4 w-3" alt="" />
              <span>Start Point</span>
            </div>
            <div className="flex items-center gap-1.5">
              <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" className="h-4 w-3" alt="" />
              <span>End Point</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-1 rounded-full bg-blue-400" />
              <span>{routeDrawn ? 'Road Route' : 'Path'}</span>
            </div>
          </div>

          {/* Location Logs */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-700 bg-slate-900/40 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" /> Location Logs
                <span className="text-xs text-slate-500 font-normal">({history.length} points)</span>
              </h3>
              {routeDrawn && routeData && (
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-bold border border-indigo-500/30">
                  {routeData.distance} km · {routeData.duration} min
                </span>
              )}
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold sticky top-0">
                  <tr>
                    <th className="px-5 py-4">#</th>
                    <th className="px-5 py-4">Time</th>
                    <th className="px-5 py-4">Coordinates</th>
                    <th className="px-5 py-4">Speed</th>
                    <th className="px-5 py-4">Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {history.length === 0 ? (
                    <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-500">No location data available</td></tr>
                  ) : history.map((log, i) => (
                    <tr key={log._id || i} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className={`flex items-center justify-center font-bold text-white ${
                          i === 0 ? 'w-6 h-6 rounded-full bg-green-500 text-[10px]'
                          : i === history.length-1 ? 'w-6 h-6 rounded-full bg-red-500 text-[10px]'
                          : 'w-2 h-2 rounded-full bg-blue-500 ml-2'
                        }`}>
                          {i === 0 ? 'S' : i === history.length-1 ? 'E' : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-300 whitespace-nowrap text-xs">{formatDate(log.time)}</td>
                      <td className="px-5 py-4 font-mono text-slate-400 text-xs">{log.lat?.toFixed(4)}, {log.lng?.toFixed(4)}</td>
                      <td className="px-5 py-4 text-slate-300 text-xs">{log.speed ? `${log.speed} km/h` : '—'}</td>
                      <td className="px-5 py-4 text-slate-300 text-xs whitespace-normal break-words">
                        {(() => {
                          const key = log._id || log.time || `${log.lat}-${log.lng}`;
                          const addr = addresses[key];
                          return addr ? addr : (
                            <button onClick={() => handleFetchAddress(log)} className="text-blue-400 underline hover:text-blue-300">
                              Fetch Address
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showPowerModal}
        onClose={() => setShowPowerModal(false)}
        onConfirm={handlePowerToggle}
        title={device.status === 'Active' ? 'Remote Power Off' : 'Remote Power On'}
        message={device.status === 'Active'
          ? 'Are you sure you want to remotely power off this device? Tracking will stop until it\'s manually powered on again.'
          : 'Are you sure you want to remotely power on this device?'}
        confirmText={device.status === 'Active' ? 'Yes, Power Off' : 'Yes, Power On'}
      />
    </div>
  );
}