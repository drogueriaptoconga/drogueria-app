// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Productos from './pages/Productos';
import PuntoDeVenta from './pages/PuntoDeVenta';
import HistorialDeVentas from './pages/HistorialDeVentas'; // Importamos el nuevo componente
import EntradasStock from './pages/EntradasStock';
import Gastos from './pages/Gastos';
import Reportes from './pages/Reportes';
import Navbar from './components/Navbar';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/punto-de-venta" element={<PuntoDeVenta />} />
            <Route path="/historial-ventas" element={<HistorialDeVentas />} /> {/* Nueva ruta */}
            <Route path="/entradas-stock" element={<EntradasStock />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/reportes" element={<Reportes />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;