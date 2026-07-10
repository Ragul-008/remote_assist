import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './layouts/DashboardLayout';
import TechnicianDashboard from './pages/TechnicianDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import SupportRoom from './pages/SupportRoom';
import SessionsList from './pages/SessionsList';
import CustomersList from './pages/CustomersList';
import Settings from './pages/Settings';
import JoinSession from './pages/JoinSession';

// A simple protective route component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'technician' ? '/technician' : '/customer'} replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/join/:sessionId" element={<JoinSession />} />
          
          {/* Dashboard Routes */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/technician" element={
              <ProtectedRoute allowedRoles={['technician']}>
                <TechnicianDashboard />
              </ProtectedRoute>
            } />
            <Route path="/technician/sessions" element={<SessionsList />} />
            <Route path="/technician/customers" element={<CustomersList />} />
            
            <Route path="/customer" element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/customer/sessions" element={<SessionsList />} />
            
            <Route path="/settings" element={<Settings />} />
            {/* Redirect root to appropriate dashboard */}
            <Route path="/" element={<Navigate to="/customer" replace />} />
          </Route>

          {/* Support Room (Phase 5) */}
          <Route path="/room/:sessionCode" element={
            <ProtectedRoute>
              <SupportRoom />
            </ProtectedRoute>
          } />
          
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
