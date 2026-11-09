import API_BASE from '../api';
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
        ventasEfectivo: 0,
        ventasTransferencia: 0,
        ventasMixto: 0,
        totalGastos: 0,
        totalGananciaBruta: 0,
        totalInversionEntradas: 0,
        totalCapitalInvertido: 0,
        gananciaNeta: 0,
        porcentajeGananciaBruta: 0,
        porcentajeGananciaNeta: 0,
    });
    const [entradas, setEntradas] = useState({
        totalProductos: 0,
        totalUnidades: 0,
        totalInversion: 0,
    });
    const [detalleEntradas, setDetalleEntradas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchResumen = async (nextFilters = filters) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (nextFilters.startDate) params.append('startDate', nextFilters.startDate);
            if (nextFilters.endDate) params.append('endDate', nextFilters.endDate);

            const [resumenResponse, entradasResponse, detalleEntradasResponse] = await Promise.all([
                axios.get(`${API_BASE}/api/reportes/resumen?${params.toString()}`, {
                    headers: getAuthHeaders(),
                }),
                axios.get(`${API_BASE}/api/reportes/entradas?${params.toString()}`, {
                    headers: getAuthHeaders(),
                }),
                axios.get(`${API_BASE}/api/reportes/entradas-detalle?${params.toString()}`, {
                    headers: getAuthHeaders(),
                })
            ]);

            const data = resumenResponse.data || {};
            const entradaData = entradasResponse.data || {};
            const detalleData = Array.isArray(detalleEntradasResponse.data) ? detalleEntradasResponse.data : [];

            setResumen({
                totalIngresos: Number(data.totalIngresos) || 0,
                ventasEfectivo: Number(data.ventasEfectivo) || 0,
                ventasTransferencia: Number(data.ventasTransferencia) || 0,
                ventasMixto: Number(data.ventasMixto) || 0,
                totalGastos: Number(data.totalGastos) || 0,
                totalGananciaBruta: Number(data.totalGananciaBruta) || 0,
                totalInversionEntradas: Number(data.totalInversionEntradas) || 0,
                totalCapitalInvertido: Number(data.totalCapitalInvertido) || 0,
                gananciaNeta: Number(data.gananciaNeta) || 0,
                porcentajeGananciaBruta: Number(data.porcentajeGananciaBruta) || 0,
                porcentajeGananciaNeta: Number(data.porcentajeGananciaNeta) || 0,
            });

            setEntradas({
                totalProductos: Number(entradaData.totalProductos) || 0,
                totalUnidades: Number(entradaData.totalUnidades) || 0,
                totalInversion: Number(entradaData.totalInversion) || 0,
            });

            setDetalleEntradas(detalleData);
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
                <div className="card efectivo-card">
                    <h3>Ventas en efectivo</h3>
                    <p className="monto">{formatCurrency(resumen.ventasEfectivo)}</p>
                </div>
                <div className="card transferencia-card">
                    <h3>Ventas por transferencia</h3>
                    <p className="monto">{formatCurrency(resumen.ventasTransferencia)}</p>
                </div>
                <div className="card transferencia-card">
                    <h3>Ventas mixtas</h3>
                    <p className="monto">{formatCurrency(resumen.ventasMixto)}</p>
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
                <div className="card entradas-card">
                    <h3>Productos ingresados</h3>
                    <p className="monto">{entradas.totalProductos}</p>
                </div>
                <div className="card entradas-unidades-card">
                    <h3>Unidades ingresadas</h3>
                    <p className="monto">{entradas.totalUnidades}</p>
                </div>
            </div>

            <div className="reporte-detalle">
                <h2>Detalle de productos ingresados</h2>
                {detalleEntradas.length === 0 ? (
                    <p className="empty-state">No se registraron productos con entrada en este rango de fechas.</p>
                ) : (
                    <div className="tabla-wrapper">
                        <table className="tabla-entradas">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Producto</th>
                                    <th>Código</th>
                                    <th>Cantidad</th>
                                    <th>Costo/U</th>
                                    <th>Inversión</th>
                                    <th>Usuario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalleEntradas.map((entrada) => (
                                    <tr key={entrada.id}>
                                        <td>{formatDate(entrada.fecha_entrada)}</td>
                                        <td>{entrada.nombre_producto || 'Sin nombre'}</td>
                                        <td>{entrada.codigo_producto || 'N/A'}</td>
                                        <td>{entrada.cantidad_entrada}</td>
                                        <td>{formatCurrency(entrada.costo_unidad_entrada)}</td>
                                        <td>{formatCurrency(entrada.inversion_total)}</td>
                                        <td>{entrada.usuario_nombre || 'Sistema'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="disclaimer">
                <p>Los valores mostrados corresponden al rango seleccionado y se calculan con la información real de ventas, gastos y entradas registradas.</p>
            </div>
        </div>
    );
};

export default Reportes;