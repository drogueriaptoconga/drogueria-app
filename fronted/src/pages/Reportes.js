// src/pages/Reportes.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Reportes.css';
import { getCurrentUser, getAuthHeaders } from '../auth';

const Reportes = () => {
    const [resumen, setResumen] = useState({
        totalIngresos: 0,
        totalGastos: 0,
        totalGananciaBruta: 0,
        totalInversionEntradas: 0,
        totalCapitalInvertido: 0,
        gananciaNeta: 0,
        ventasDelDia: 0,
        ventasEfectivo: 0,
        ventasTransferencia: 0,
        porcentajeGananciaBruta: 0,
        porcentajeGananciaNeta: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchResumen = async () => {
            try {
                const [resumenResponse, gananciaDiariaResponse, ventasResponse] = await Promise.all([
                    axios.get('http://localhost:3001/api/reportes/resumen', { headers: getAuthHeaders() }),
                    axios.get('http://localhost:3001/api/reportes/ganancia_diaria', { headers: getAuthHeaders() }),
                    axios.get('http://localhost:3001/api/reportes/ventas_diarias', { headers: getAuthHeaders() })
                ]);
                const data = resumenResponse.data;
                const gananciasData = gananciaDiariaResponse.data;
                const ventasData = ventasResponse.data;
                const totalIngresos = parseFloat(data.totalIngresos) || 0;
                const totalGastos = parseFloat(data.totalGastos) || 0;
                const totalGananciaBruta = parseFloat(data.totalGananciaBruta) || 0;
                const totalInversionEntradas = parseFloat(data.totalInversionEntradas) || 0;
                const totalCapitalInvertido = parseFloat(data.totalCapitalInvertido) || 0;
                const gananciaNeta = parseFloat(data.gananciaNeta) || 0;
                const ventasDelDia = parseFloat(ventasData.ventas_diarias) || 0;
                const ventasEfectivo = parseFloat(ventasData.ventas_efectivo) || 0;
                const ventasTransferencia = parseFloat(ventasData.ventas_transferencia) || 0;
                const porcentajeGananciaBruta = parseFloat(gananciasData.porcentaje_ganancia_bruta) || 0;
                const porcentajeGananciaNeta = parseFloat(gananciasData.porcentaje_ganancia_neta) || 0;

                setResumen({
                    totalIngresos,
                    totalGastos,
                    totalGananciaBruta,
                    totalInversionEntradas,
                    totalCapitalInvertido,
                    gananciaNeta,
                    ventasDelDia,
                    ventasEfectivo,
                    ventasTransferencia,
                    porcentajeGananciaBruta,
                    porcentajeGananciaNeta,
                });
            } catch (err) {
                setError('Error al cargar el reporte financiero. Por favor, intente de nuevo.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchResumen();
    }, []);

    const currentUser = getCurrentUser();
    if ((currentUser.role || '').toLowerCase() === 'asesor') {
        return (
            <div className="reportes-container">
                <h2>403 - No autorizado</h2>
                <p>No tienes permisos para ver reportes financieros.</p>
            </div>
        );
    }

    if (loading) return <div className="reportes-container">Cargando reporte...</div>;
    if (error) return <div className="reportes-container error-message">{error}</div>;

    return (
        <div className="reportes-container">
            <h1>Reporte Financiero</h1>
            <div className="resumen-cards">
                <div className="card ingresos-card">
                    <h3>Ingresos Totales</h3>
                    <p className="monto">${resumen.totalIngresos}</p>
                </div>
                <div className="card gastos-card">
                    <h3>Gastos Totales</h3>
                    <p className="monto">${resumen.totalGastos}</p>
                </div>
                <div className="card ganancia-bruta-card">
                    <h3>Ganancia Bruta</h3>
                    <p className="monto">${resumen.totalGananciaBruta}</p>
                </div>
                <div className="card ventas-dia-card">
                    <h3>Ventas del Día</h3>
                    <p className="monto">${resumen.ventasDelDia}</p>
                </div>
                <div className="card ventas-efectivo-card">
                    <h3>Ventas Efectivo</h3>
                    <p className="monto">${resumen.ventasEfectivo}</p>
                </div>
                <div className="card ventas-transferencia-card">
                    <h3>Ventas Transferencia</h3>
                    <p className="monto">${resumen.ventasTransferencia}</p>
                </div>
                <div className="card porcentaje-ganancia-bruta-card">
                    <h3>Margen Bruto Diario</h3>
                    <p className="monto">{resumen.porcentajeGananciaBruta}%</p>
                </div>
                <div className="card porcentaje-ganancia-neta-card">
                    <h3>Margen Neto Diario</h3>
                    <p className="monto">{resumen.porcentajeGananciaNeta}%</p>
                </div>
                <div className="card inversion-card">
                    <h3>Inversión en Entradas</h3>
                    <p className="monto">${resumen.totalInversionEntradas}</p>
                </div>
                <div className="card capital-card">
                    <h3>Capital Invertido</h3>
                    <p className="monto">${resumen.totalCapitalInvertido}</p>
                </div>
                <div className="card ganancia-card">
                    <h3>Ganancia Neta</h3>
                    <p className="monto">${resumen.gananciaNeta}</p>
                </div>
            </div>
            <div className="disclaimer">
                <p>Nota: Los montos se calculan a partir de los datos registrados en los módulos de ventas y gastos.</p>
            </div>
        </div>
    );
};

export default Reportes;