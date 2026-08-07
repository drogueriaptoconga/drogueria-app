// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';
import { getCurrentUser, getAuthHeaders } from '../auth';

const Dashboard = () => {
    const [dashboardData, setDashboardData] = useState({
        ventasDelDia: 0,
        ventasEfectivo: 0,
        ventasTransferencia: 0,
        capitalInvertido: 0,
        gananciaPotencial: 0,
        gananciaBrutaDiaria: 0,
        gastosDiarios: 0,
        inversionDiaria: 0,
        gananciaNetaDiaria: 0,
        ventasSemana: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const currentUser = getCurrentUser();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [
                    ventasResponse,
                    capitalResponse,
                    gananciaPotencialResponse,
                    gananciaDiariaResponse,
                    ventasSemanaResponse
                ] = await Promise.all([
                    axios.get('http://localhost:3001/api/reportes/ventas_diarias', { headers: getAuthHeaders() }),
                    axios.get('http://localhost:3001/api/reportes/capital_invertido', { headers: getAuthHeaders() }),
                    axios.get('http://localhost:3001/api/reportes/ganancia_potencial', { headers: getAuthHeaders() }),
                    axios.get('http://localhost:3001/api/reportes/ganancia_diaria', { headers: getAuthHeaders() }),
                    axios.get('http://localhost:3001/api/reportes/ventas_semana', { headers: getAuthHeaders() })
                ]);

                const ventasBrutaDiaria = parseFloat(gananciaDiariaResponse.data.ganancia_bruta_diaria || gananciaDiariaResponse.data.ganancia_diaria) || 0;
                const porcentajeGananciaBruta = parseFloat(gananciaDiariaResponse.data.porcentaje_ganancia_bruta) || 0;
                const porcentajeGananciaNeta = parseFloat(gananciaDiariaResponse.data.porcentaje_ganancia_neta) || 0;

                setDashboardData({
                    ventasDelDia: parseFloat(ventasResponse.data.ventas_diarias) || 0,
                    ventasEfectivo: parseFloat(ventasResponse.data.ventas_efectivo) || 0,
                    ventasTransferencia: parseFloat(ventasResponse.data.ventas_transferencia) || 0,
                    capitalInvertido: parseFloat(capitalResponse.data.capital_invertido) || 0,
                    gananciaPotencial: parseFloat(gananciaPotencialResponse.data.ganancia_potencial) || 0,
                    gananciaBrutaDiaria: ventasBrutaDiaria,
                    porcentajeGananciaBruta: porcentajeGananciaBruta,
                    gastosDiarios: parseFloat(gananciaDiariaResponse.data.gastos_diarios) || 0,
                    inversionDiaria: parseFloat(gananciaDiariaResponse.data.inversion_diaria) || 0,
                    gananciaNetaDiaria: parseFloat(gananciaDiariaResponse.data.ganancia_neta_diaria) || 0,
                    porcentajeGananciaNeta: porcentajeGananciaNeta,
                    ventasSemana: ventasSemanaResponse.data
                });
                setLoading(false);
            } catch (err) {
                console.error('Error al cargar datos del dashboard:', err);
                setError('Error al cargar datos del dashboard. Por favor, intente de nuevo.');
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if ((currentUser.role || '').toLowerCase() === 'asesor') {
        return (
            <div className="dashboard-container">
                <h2>403 - No autorizado</h2>
                <p>No tienes permisos para ver el Dashboard financiero.</p>
            </div>
        );
    }

    if (loading) return <div className="loading">Cargando datos del Dashboard...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="dashboard-container">
            <h1 className="dashboard-header">Dashboard de la Droguería</h1>
            
            <div className="kpi-grid">
                <div className="kpi-card">
                    <h2>Ventas del Día</h2>
                    <p>${dashboardData.ventasDelDia}</p>
                </div>
                <div className="kpi-card">
                    <h2>Ventas Efectivo</h2>
                    <p>${dashboardData.ventasEfectivo}</p>
                </div>
                <div className="kpi-card">
                    <h2>Ventas Transferencia</h2>
                    <p>${dashboardData.ventasTransferencia}</p>
                </div>
                <div className="kpi-card">
                    <h2>Ganancia Bruta del Día</h2>
                    <p style={{color: '#007bff'}}>${dashboardData.gananciaBrutaDiaria}</p>
                </div>
                <div className="kpi-card">
                    <h2>Margen Bruto Diario</h2>
                    <p style={{color: '#17a2b8'}}>{dashboardData.porcentajeGananciaBruta}%</p>
                </div>
                <div className="kpi-card">
                    <h2>Margen Neto Diario</h2>
                    <p style={{color: '#28a745'}}>{dashboardData.porcentajeGananciaNeta}%</p>
                </div>
                <div className="kpi-card">
                    <h2>Gastos del Día</h2>
                    <p style={{color: '#dc3545'}}>${dashboardData.gastosDiarios}</p>
                </div>
                <div className="kpi-card">
                    <h2>Ganancia Neta del Día</h2>
                    <p style={{color: '#28a745'}}>${dashboardData.gananciaNetaDiaria}</p>
                </div>
                <div className="kpi-card">
                    <h2>Inversión del Día</h2>
                    <p style={{color: '#6f42c1'}}>${dashboardData.inversionDiaria}</p>
                </div>
                <div className="kpi-card">
                    <h2>Capital Invertido</h2>
                    <p style={{color: '#ffc107'}}>${dashboardData.capitalInvertido}</p>
                </div>
                <div className="kpi-card">
                    <h2>Ganancia Potencial</h2>
                    <p style={{color: '#343a40'}}>${dashboardData.gananciaPotencial}</p>
                </div>
            </div>

            <div className="chart-container">
                <h2>Ventas de la Semana</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboardData.ventasSemana}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="dia" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="ventas" fill="#8884d8" name="Ventas diarias" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Dashboard;