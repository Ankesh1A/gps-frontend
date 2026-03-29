import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';

const Dashboard   = lazy(() => import('./pages/Dashboard'));
const DeviceList  = lazy(() => import('./pages/DeviceList'));
const AddDevice   = lazy(() => import('./pages/AddDevice'));
const DeviceDetail= lazy(() => import('./pages/DeviceDetail'));
const LiveTracking= lazy(() => import('./pages/LiveTracking'));
const FirmwareManagement = lazy(() => import('./pages/FirmwareManagement'));
const Login       = lazy(() => import('./pages/Login'));

const Spin = () => (
  <div className="flex items-center justify-center h-screen bg-slate-950">
    <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }
        }} />
        <Suspense fallback={<Spin />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="devices" element={<DeviceList />} />
              <Route path="devices/add" element={<AddDevice />} />
              <Route path="devices/:id" element={<DeviceDetail />} />
              <Route path="devices/:id/firmware" element={<FirmwareManagement />} />
              <Route path="live" element={<LiveTracking />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}
