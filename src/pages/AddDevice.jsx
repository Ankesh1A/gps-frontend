import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import deviceService from '../services/deviceService';
import toast from 'react-hot-toast';

export default function AddDevice() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    device_id: '', device_name: '', imei: '',
    mobile_num: '', vehicle_id: '', plan_validity: '', status: 'Active'
  });

  const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await deviceService.create(formData);
      toast.success('Device registered successfully!');
      navigate('/devices');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0] || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-200 transition-all placeholder:text-slate-600";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/devices" className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Add New GPS Device</h2>
          <p className="text-slate-400 text-sm">Enter the device and vehicle details below</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { name: 'device_id',   label: 'Device ID',                  placeholder: 'e.g. GPS-001' },
            { name: 'device_name', label: 'Device Name',                placeholder: 'e.g. Truck A-1' },
            { name: 'imei',        label: 'IMEI Number (15 digits)',     placeholder: '862093012345678', maxLength: 15 },
            { name: 'mobile_num',  label: 'Mobile Number (SIM)',         placeholder: '+91 9876543210' },
            { name: 'vehicle_id',  label: 'Vehicle Registration ID',     placeholder: 'e.g. MH-12-AB-1234' },
          ].map(f => (
            <div key={f.name} className="space-y-2">
              <label className="text-sm font-medium text-slate-300">{f.label}</label>
              <input required name={f.name} value={formData[f.name]} onChange={handleChange}
                placeholder={f.placeholder} maxLength={f.maxLength}
                className={inputClass} />
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Plan Validity</label>
            <input required type="date" name="plan_validity" value={formData.plan_validity}
              onChange={handleChange} className={inputClass} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Status</label>
            <select name="status" value={formData.status} onChange={handleChange}
              className={`${inputClass} appearance-none cursor-pointer`}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="md:col-span-2 pt-4">
            <button disabled={loading} type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Registering...</> : <><Save className="w-5 h-5" /> Register Device</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
