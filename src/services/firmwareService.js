import api from './api';

const firmwareService = {
  // Upload new firmware
  upload: (deviceId, file, version) => {
    const formData = new FormData();
    formData.append('firmware', file);
    formData.append('device_id', deviceId);
    formData.append('version', version);
    return api.post('/firmware/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Download firmware
  download: async (deviceId) => {
    try {
      let filename = 'firmware.bin';

      try {
        // Try to get device info first to get the filename
        const response = await api.get(`/firmware/latest/${deviceId}`);
        filename = response.data.data.firmware_file_name || 'firmware.bin';
      } catch (authError) {
        // Continue with default filename if auth fails
      }

      // Download with responseType blob
      const fileResponse = await api.get(`/firmware/download/${deviceId}`, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/octet-stream'
        }
      });

      // Create blob URL and trigger download
      const url = window.URL.createObjectURL(fileResponse.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  },

  // Get latest firmware info
  getLatest: (deviceId) => api.get(`/firmware/latest/${deviceId}`),

  // Get all versions for a device
  getVersions: (deviceId) => api.get(`/firmware/versions/${deviceId}`),

  // Get specific version
  getByVersion: (deviceId, version) => api.get(`/firmware/${deviceId}/${version}`),

  // Update firmware status
  updateStatus: (deviceId, status) => api.patch(`/firmware/status/${deviceId}`, { status }),

  // Delete firmware version
  delete: (deviceId, publicId) => api.delete(`/firmware/${deviceId}/${publicId}`),
};

export default firmwareService;
