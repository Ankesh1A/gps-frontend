import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import firmwareService from '../../services/firmwareService';
import ConfirmModal from '../common/ConfirmModal';

export default function FirmwareList({ deviceId, originalFileName, onRefresh }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, fileName: null });

  useEffect(() => {
    loadVersions();
  }, [deviceId, onRefresh]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await firmwareService.getVersions(deviceId);
      if (response.data?.success) {
        setVersions(response.data?.data?.versions || []);
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load firmware versions');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Download via backend — no direct Cloudinary URL needed
  const handleDownload = async (versionKey, fileName) => {
    setDownloading(versionKey);
    try {
      await firmwareService.download(deviceId, fileName);
      toast.success(`Downloaded ${fileName || 'firmware'}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleDeleteClick = (version) => {
    setDeleteModal({
      show: true,
      id: version.public_id,
      fileName: version.version
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return;
    try {
      const response = await firmwareService.delete(deviceId, deleteModal.id);
      if (response.data?.success) {
        toast.success('Firmware version deleted successfully');
        setDeleteModal({ show: false, id: null, fileName: null });
        loadVersions();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete firmware');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">📋 Firmware Versions</h3>
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">📋 Firmware Versions</h3>
            <button
              onClick={loadVersions}
              className="text-slate-400 hover:text-white text-sm px-3 py-1 rounded hover:bg-slate-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {versions.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-slate-400">No firmware versions uploaded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Version</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">File Size</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Uploaded</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {versions.map((version, index) => (
                  <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs font-semibold">
                        v{version.version}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {formatFileSize(version.size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {formatDate(version.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleDownload(
                            version.version,
                            version.original_filename || originalFileName || `firmware-v${version.version}.bin`
                          )}
                          disabled={downloading === version.version}
                          className="text-sm px-3 py-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                        >
                          {downloading === version.version ? '⏳ Downloading...' : '⬇️ Download'}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(version)}
                          className="text-sm px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.show}
        title="Delete Firmware Version"
        message={`Are you sure you want to delete firmware version ${deleteModal.fileName}? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ show: false, id: null, fileName: null })}
        confirmText="Delete"
        confirmClassName="bg-red-600 hover:bg-red-700"
      />
    </>
  );
}