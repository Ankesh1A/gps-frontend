import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import firmwareService from '../../services/firmwareService';

export default function FirmwareUpload({ deviceId, deviceName, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [version, setVersion] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size (max 100MB)
    if (selectedFile.size > 100 * 1024 * 1024) {
      toast.error('File size must be less than 100MB');
      return;
    }

    setFile(selectedFile);
    toast.success(`File selected: ${selectedFile.name}`);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      toast.error('Please select a firmware file');
      return;
    }

    if (!version.trim()) {
      toast.error('Please enter firmware version');
      return;
    }

    setUploading(true);
    try {
      const response = await firmwareService.upload(deviceId, file, version);
      
      if (response.data?.success) {
        toast.success('Firmware uploaded successfully!');
        setFile(null);
        setVersion('');
        fileInputRef.current.value = '';
        
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload firmware');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4"> Upload Firmware</h3>
      
      <form onSubmit={handleUpload} className="space-y-4">
        {/* Device Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-sm text-slate-400">Device ID</label>
            <input
              type="text"
              value={deviceId}
              disabled
              className="w-full bg-slate-700 text-slate-300 px-3 py-2 rounded border border-slate-600 text-sm cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">Device Name</label>
            <input
              type="text"
              value={deviceName}
              disabled
              className="w-full bg-slate-700 text-slate-300 px-3 py-2 rounded border border-slate-600 text-sm cursor-not-allowed"
            />
          </div>
        </div>

        {/* Version Input */}
        <div>
          <label className="text-sm text-slate-400">Firmware Version</label>
          <input
            type="text"
            placeholder="e.g., 2.0.0"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            disabled={uploading}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">Use semantic versioning (major.minor.patch)</p>
        </div>

        {/* File Input */}
        <div>
          <label className="text-sm text-slate-400">Select File</label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
              accept=".bin,.hex,.elf,.zip"
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          {file && (
            <div className="mt-2 p-3 bg-slate-700 rounded border border-slate-600">
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">Selected:</span> {file.name}
              </p>
              <p className="text-xs text-slate-500">
                Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="flex items-center gap-2">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '75%' }} />
            </div>
            <span className="text-sm text-slate-400">Uploading...</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading || !file || !version}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload Firmware'}
        </button>
      </form>
    </div>
  );
}
