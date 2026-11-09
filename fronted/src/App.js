// src/App.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Productos from './pages/Productos';
import PuntoDeVenta from './pages/PuntoDeVenta';
import HistorialDeVentas from './pages/HistorialDeVentas'; // Importamos el nuevo componente
import VentasPorVendedor from './pages/VentasPorVendedor';
import EntradasStock from './pages/EntradasStock';
import Traslados from './pages/Traslados';
import Gastos from './pages/Gastos';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';
import Login from './pages/Login';
import CambiarContrasena from './pages/CambiarContrasena';
import Navbar from './components/Navbar';
import { clearAuthSession, getAuthToken, saveAuthSession } from './auth';
import './App.css';

function RouteFocus() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return undefined;

    const selector = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([disabled]):not([readonly]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden])';
    const observer = new MutationObserver(() => {
      const field = main.querySelector(selector);
      if (field) {
        field.focus({ preventScroll: true });
        observer.disconnect();
      }
    });

    observer.observe(main, { childList: true, subtree: true });
    const field = main.querySelector(selector);
    if (field) {
      field.focus({ preventScroll: true });
      observer.disconnect();
    }

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

function AdminRoute({ user, children }) {
  return user.role === 'admin' ? children : <Navigate to="/punto-de-venta" replace />;
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsCheckingSession(false);
      return;
    }

    axios.get('http://localhost:3001/api/auth/me')
      .then(({ data }) => {
        setCurrentUser(data.user);
        saveAuthSession(token, data.user);
      })
      .catch(() => clearAuthSession())
      .finally(() => setIsCheckingSession(false));
  }, []);

  const handleLogin = (user) => setCurrentUser(user);
  const handleLogout = () => setCurrentUser(null);

  if (isCheckingSession) return <div className="auth-loading">Verificando sesión...</div>;

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" state={{ from: location }} replace />} />
      </Routes>
    );
  }

  const homePath = currentUser.role === 'admin' ? '/' : '/punto-de-venta';

  if (currentUser.debeCambiarContrasena && location.pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" replace />;
  }

  return (
    <div className="App">
      <RouteFocus />
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <main>
        <Routes>
          <Route path="/login" element={<Navigate to={homePath} replace />} />
          <Route path="/cambiar-contrasena" element={<CambiarContrasena onSaved={() => {
            setCurrentUser(user => ({ ...user, debeCambiarContrasena: false }));
            navigate(homePath, { replace: true });
          }} />} />
          <Route path="/" element={<AdminRoute user={currentUser}><Dashboard /></AdminRoute>} />
          <Route path="/productos" element={<AdminRoute user={currentUser}><Productos /></AdminRoute>} />
          <Route path="/punto-de-venta" element={<PuntoDeVenta />} />
          <Route path="/historial-ventas" element={<AdminRoute user={currentUser}><HistorialDeVentas /></AdminRoute>} />
          <Route path="/ventas-por-vendedor" element={<AdminRoute user={currentUser}><VentasPorVendedor /></AdminRoute>} />
          <Route path="/entradas-stock" element={<AdminRoute user={currentUser}><EntradasStock /></AdminRoute>} />
          <Route path="/traslados" element={<AdminRoute user={currentUser}><Traslados /></AdminRoute>} />
          <Route path="/gastos" element={<AdminRoute user={currentUser}><Gastos /></AdminRoute>} />
          <Route path="/reportes" element={<AdminRoute user={currentUser}><Reportes /></AdminRoute>} />
          <Route path="/usuarios" element={<AdminRoute user={currentUser}><Usuarios /></AdminRoute>} />
          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  useEffect(() => {
    const preventNumberInputWheelChange = (event) => {
      const numberInput = event.target.closest?.('input[type="number"]');

      if (numberInput && numberInput === document.activeElement) {
        numberInput.blur();
      }
    };

    document.addEventListener('wheel', preventNumberInputWheelChange, { passive: true });

    return () => {
      document.removeEventListener('wheel', preventNumberInputWheelChange);
    };
  }, []);

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;