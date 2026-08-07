// src/components/Navbar.js
import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';
import { getCurrentUser } from '../auth';

const Navbar = () => {
    const currentUser = getCurrentUser();
    const role = (currentUser.role || '').toLowerCase();

    const showFinancial = role !== 'asesor';

    return (
        <nav className="navbar">
            <div className="logo">
                <Link to="/">Droguería App</Link>
            </div>
            <ul className="nav-links">
                {showFinancial && (
                    <li>
                        <Link to="/">Dashboard</Link>
                    </li>
                )}
                <li>
                    <Link to="/productos">Productos</Link>
                </li>
                <li>
                    <Link to="/punto-de-venta">Punto de Venta</Link>
                </li>
                {showFinancial && (
                    <li>
                        <Link to="/historial-ventas">Historial de Ventas</Link>
                    </li>
                )}
                <li>
                    <Link to="/entradas-stock">Entradas de Stock</Link>
                </li>
                {showFinancial && (
                    <li>
                        <Link to="/gastos">Gastos</Link>
                    </li>
                )}
                {showFinancial && (
                    <li>
                        <Link to="/reportes">Reportes</Link>
                    </li>
                )}
            </ul>
        </nav>
    );
};

export default Navbar;