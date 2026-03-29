import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import deviceService from '../services/deviceService';
import firmwareService from '../services/firmwareService';
import FirmwareUpload from '../components/firmware/FirmwareUpload';
import FirmwareList from '../components/firmware/FirmwareList';

export default function FirmwareManagement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [latestFirmware, setLatestFirmware] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadDeviceAndFirmware();
  }, [id, refreshTrigger]);

  const loadDeviceAndFirmware = async () => {
    setLoading(true);
    try {
      const deviceResponse = await deviceService.getById(id);
      if (deviceResponse.data?.success) {
        setDevice(deviceResponse.data?.data);
      }

      try {
        const firmwareResponse = await firmwareService.getLatest(id);
        if (firmwareResponse.data?.success) {
          setLatestFirmware(firmwareResponse.data?.data);
        }
      } catch (error) {
        console.log('No firmware for this device yet');
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // ✅ Download via backend — backend streams file with correct Content-Disposition header
  const handleDownloadLatest = async () => {
    if (!latestFirmware?.firmware_url) {
      toast.error('Download URL not available');
      return;
    }
    setDownloading(true);
    try {
      const fileName = latestFirmware.firmware_file_name || `firmware-v${latestFirmware.current_version}.bin`;
      await firmwareService.download(id, fileName);
      toast.success('Firmware downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Device not found</p>
          <button
            onClick={() => navigate('/devices')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            ← Back to Devices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/devices')}
              className="text-blue-500 hover:text-blue-400 font-semibold text-sm"
            >
              ← Back to Devices
            </button>
          </div>
          <h1 className="text-3xl font-bold text-white"> Firmware Management</h1>
          <p className="text-slate-400 mt-2">
            Manage firmware versions for:{' '}
            <span className="text-slate-300 font-semibold">{device.device_name}</span>
          </p>
        </div>

        {/* Device Info Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-400 text-sm">Device ID</p>
              <p className="text-white font-semibold mt-1">{device.device_id}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Vehicle ID</p>
              <p className="text-white font-semibold mt-1">{device.vehicle_id}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">IMEI</p>
              <p className="text-white font-semibold mt-1 text-sm">{device.imei}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Status</p>
              <p className="text-white font-semibold mt-1">
                {device.status === 'Active' && <span className="text-green-400">● Active</span>}
                {device.status === 'Inactive' && <span className="text-yellow-400">● Inactive</span>}
                {device.status === 'Disabled' && <span className="text-red-400">● Disabled</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Latest Firmware Info */}
        {latestFirmware && (
          <div className="bg-blue-950 rounded-lg border border-blue-700 p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-300 mb-4"> Current Firmware</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-slate-400 text-sm">Current Version</p>
                <p className="text-white font-bold text-lg mt-1">v{latestFirmware.current_version}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">File Size</p>
                <p className="text-white font-semibold mt-1">
                  {(latestFirmware.firmware_size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Update Status</p>
                <p className="text-white font-semibold mt-1">
                  {latestFirmware.update_status === 'Success' && <span className="text-green-400">✓ Success</span>}
                  {latestFirmware.update_status === 'Pending' && <span className="text-yellow-400">⏳ Pending</span>}
                  {latestFirmware.update_status === 'In Progress' && <span className="text-blue-400">⌛ In Progress</span>}
                  {latestFirmware.update_status === 'Failed' && <span className="text-red-400">✗ Failed</span>}
                  {latestFirmware.update_status === 'None' && <span className="text-slate-400">- None</span>}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Last Updated</p>
                <p className="text-white font-semibold mt-1 text-sm">
                  {latestFirmware.last_updated
                    ? new Date(latestFirmware.last_updated).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })
                    : 'Never'}
                </p>
              </div>
            </div>

            {latestFirmware.firmware_url && (
              <div className="mt-4 pt-4 border-t border-blue-700">
                {/* ✅ Uses backend download — no direct Cloudinary URL */}
                <button
                  onClick={handleDownloadLatest}
                  disabled={downloading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  {downloading ? '⏳ Downloading...' : '⬇️ Download Latest Firmware'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <FirmwareUpload
              deviceId={id}
              deviceName={device.device_name}
              onUploadSuccess={handleUploadSuccess}
            />
          </div>
          <div className="lg:col-span-2">
            <FirmwareList
              deviceId={id}
              originalFileName={latestFirmware?.firmware_file_name}
              onRefresh={refreshTrigger}
            />
          </div>
        </div>

      </div>
    </div>
  );
}