import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';

/**
 * Wraps auth pages with navigation handlers.
 * If already authenticated, redirects to the main app (placeholder for now).
 */

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login onSwitchToRegister={() => navigate('/register')} />;
}

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Register onSwitchToLogin={() => navigate('/login')} />;
}

function HomePage() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Placeholder home page -- the main editor will go here
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{
        padding: 40,
        borderRadius: 20,
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        textAlign: 'center',
      }}>
        <h1 style={{ color: '#ECEDEE', fontWeight: 300, marginBottom: 8 }}>Writer</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
          Signed in as {user?.email}
        </p>
        <button
          onClick={logout}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)',
            color: '#ECEDEE',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
