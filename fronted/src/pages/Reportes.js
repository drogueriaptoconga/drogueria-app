// src/pages/Reportes.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Reportes.css';
import { getCurrentUser, getAuthHeaders } from '../auth';

const formatCurrency = (value) => {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(numericValue);
};

const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
};

const getDefaultDates = () => {
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
};

const Reportes = () => {
    const defaultDates = getDefaultDates();
    const [filters, setFilters] = useState({
        startDate: defaultDates.startDate,
        endDate: defaultDates.endDate,
    });
    const [resumen, setResumen] = useState({
        totalIngresos: 0,
        totalGastos: 0,
        totalGananciaBruta: 0,
        totalInversionEntradas: 0,
        totalCapitalInvertido: 0,
        gananciaNeta: 0,
        porcentajeGananciaBruta: 0,
        porcentajeGananciaNeta: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchResumen = async (nextFilters = filters) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (nextFilters.startDate) params.append('startDate', nextFilters.startDate);
            if (nextFilters.endDate) params.append('endDate', nextFilters.endDate);

            const response = await axios.get(`http://localhost:3001/api/reportes/resumen?${params.toString()}`, {
                headers: getAuthHeaders(),
            });

            const data = response.data || {};
            setResumen({
                totalIngresos: Number(data.totalIngresos) || 0,
                totalGastos: Number(data.totalGastos) || 0,
                totalGananciaBruta: Number(data.totalGananciaBruta) || 0,
                totalInversionEntradas: Number(data.totalInversionEntradas) || 0,
                totalCapitalInvertido: Number(data.totalCapitalInvertido) || 0,
                gananciaNeta: Number(data.gananciaNeta) || 0,
                porcentajeGananciaBruta: Number(data.porcentajeGananciaBruta) || 0,
                porcentajeGananciaNeta: Number(data.porcentajeGananciaNeta) || 0,
            });
        } catch (err) {
            setError('Error al cargar el reporte financiero. Por favor, intente de nuevo.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResumen(filters);
    }, []);

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
            setError('La fecha de inicio no puede ser mayor que la fecha final.');
            return;
        }

        fetchResumen(filters);
    };

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

            <div className="filtros-panel">
                <div className="filtro-item">
                    <label htmlFor="startDate">Fecha inicio</label>
                    <input
                        id="startDate"
                        type="date"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleFilterChange}
                    />
                </div>
                <div className="filtro-item">
                    <label htmlFor="endDate">Fecha fin</label>
                    <input
                        id="endDate"
                        type="date"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleFilterChange}
                    />
                </div>
                <button type="button" className="btn-aplicar" onClick={handleApplyFilters}>
                    Aplicar filtros
                </button>
            </div>

            <div className="range-summary">
                <span>Periodo: {formatDate(filters.startDate)} - {formatDate(filters.endDate)}</span>
            </div>

            <div className="resumen-cards">
                <div className="card ingresos-card">
                    <h3>Ingresos</h3>
                    <p className="monto">{formatCurrency(resumen.totalIngresos)}</p>
                </div>
                <div className="card gastos-card">
                    <h3>Gastos</h3>
                    <p className="monto">{formatCurrency(resumen.totalGastos)}</p>
                </div>
                <div className="card ganancia-bruta-card">
                    <h3>Ganancia Bruta</h3>
                    <p className="monto">{formatCurrency(resumen.totalGananciaBruta)}</p>
                </div>
                <div className="card porcentaje-ganancia-bruta-card">
                    <h3>Margen Bruto</h3>
                    <p className="monto">{resumen.porcentajeGananciaBruta}%</p>
                </div>
                <div className="card ganancia-card">
                    <h3>Ganancia Neta</h3>
                    <p className="monto">{formatCurrency(resumen.gananciaNeta)}</p>
                </div>
                <div className="card porcentaje-ganancia-neta-card">
                    <h3>Margen Neto</h3>
                    <p className="monto">{resumen.porcentajeGananciaNeta}%</p>
                </div>
                <div className="card inversion-card">
                    <h3>Inversión en entradas</h3>
                    <p className="monto">{formatCurrency(resumen.totalInversionEntradas)}</p>
                </div>
                <div className="card capital-card">
                    <h3>Capital invertido</h3>
                    <p className="monto">{formatCurrency(resumen.totalCapitalInvertido)}</p>
                </div>
            </div>

            <div className="disclaimer">
                <p>Los valores mostrados corresponden al rango seleccionado y se calculan con la información real de ventas, gastos y entradas registradas.</p>
            </div>
        </div>
    );
};

export default Reportes;