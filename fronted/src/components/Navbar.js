// src/components/Navbar.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Navbar.css';
import { clearAuthSession, getAuthHeaders } from '../auth';

const Navbar = ({ currentUser, onLogout }) => {
    const role = (currentUser.role || '').toLowerCase();
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const isAdmin = role === 'admin';
    const showFinancial = isAdmin;

    const handleLogout = async () => {
        try {
            await axios.post('http://localhost:3001/api/auth/logout');
        } catch (error) {
            console.error('Error al cerrar sesión:', error.message);
        } finally {
            clearAuthSession();
            onLogout();
        }
    };

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const response = await axios.get('http://localhost:3001/api/backup', {
                headers: getAuthHeaders(),
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            const contentDisposition = response.headers['content-disposition'] || '';
            const filename = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1]
                || `drogueria_backup_${new Date().toISOString().slice(0, 10)}.dump`;

            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            let message = error.message;
            const responseBody = error.response?.data;
            if (responseBody?.text) {
                try {
                    const responseText = await responseBody.text();
                    message = JSON.parse(responseText).error || message;
                } catch (parseError) {
                    message = responseBody.size ? message : 'No se pudo generar el respaldo.';
                }
            }
            window.alert(`No se pudo crear el respaldo: ${message}`);
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const { data } = await axios.post('http://localhost:3001/api/supabase/sync', {}, {
                headers: getAuthHeaders()
            });
            window.alert(data.message || 'Sincronización con Supabase completada.');
        } catch (error) {
            const message = error.response?.data?.error || error.message;
            const detail = error.response?.data?.detalle;
            const detailText = Array.isArray(detail) && detail.length ? `\n\n${detail.join('\n')}` : '';
            window.alert(`No se pudo sincronizar: ${message}${detailText}`);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <nav className="navbar">
            <div className="logo">
                <Link to={isAdmin ? '/' : '/punto-de-venta'}>Droguería App</Link>
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
                {showFinancial && (
                    <li>
                        <Link to="/entradas-stock">Entradas de Stock</Link>
                    </li>
                )}
                {showFinancial && (
                    <li>
                        <Link to="/traslados">Traslados</Link>
                    </li>
                )}
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
                {isAdmin && (
                    <li>
                        <Link to="/usuarios">Usuarios</Link>
                    </li>
                )}
                <li className="nav-user">{currentUser.username} ({isAdmin ? 'Admin' : 'Vendedor'})</li>
                {isAdmin && (
                    <li>
                        <button className="nav-action" type="button" onClick={handleBackup} disabled={isBackingUp}>
                            {isBackingUp ? 'Generando respaldo...' : 'Respaldar BD'}
                        </button>
                    </li>
                )}
                {isAdmin && (
                    <li>
                        <button className="nav-action" type="button" onClick={handleSync} disabled={isSyncing}>
                            {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                        </button>
                    </li>
                )}
                <li>
                    <button className="nav-logout" type="button" onClick={handleLogout}>Cerrar sesión</button>
                </li>
            </ul>
        </nav>
    );
};

export default Navbar;