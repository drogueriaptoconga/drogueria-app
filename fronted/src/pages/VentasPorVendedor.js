import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getCurrentUser, getAuthHeaders } from '../auth';

const VentasPorVendedor = () => {
    const currentUser = getCurrentUser();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [horaInicio, setHoraInicio] = useState('');
    const [horaFin, setHoraFin] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [vendedorFilter, setVendedorFilter] = useState('');
    const [vendedores, setVendedores] = useState([]);
    const [rows, setRows] = useState([]);
    const [totales, setTotales] = useState({ cantidad_ventas: 0, monto_total: 0, ganancia_total: 0 });
    const [feedback, setFeedback] = useState(null);

    const fetchReport = useCallback(async () => {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (horaInicio) params.hora_inicio = horaInicio;
            if (horaFin) params.hora_fin = horaFin;
            if (paymentMethod) params.metodo_pago = paymentMethod;
            if (vendedorFilter) params.usuario_id = vendedorFilter;

            const res = await axios.get('http://localhost:3001/api/reportes/ventas_por_vendedor', { params, headers: getAuthHeaders() });
            setRows(res.data.vendedores || []);
            setTotales(res.data.totales || { cantidad_ventas: 0, monto_total: 0, ganancia_total: 0 });
        } catch (error) {
            console.error('Error al obtener ventas por vendedor:', error);
            setFeedback({ type: 'error', message: error.response?.data?.error || 'Error al obtener el reporte.' });
        }
    }, [startDate, endDate, horaInicio, horaFin, paymentMethod, vendedorFilter]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    useEffect(() => {
        const loadVendedores = async () => {
            try {
                const res = await axios.get('http://localhost:3001/api/usuarios', { headers: getAuthHeaders() });
                setVendedores(res.data || []);
            } catch (e) {
                console.error('No se pudieron cargar los vendedores', e);
            }
        };
        loadVendedores();
    }, []);

    const handleSearch = () => fetchReport();

    if ((currentUser.role || '').toLowerCase() !== 'admin') {
        return (
            <div className="history-container">
                <h2>403 - No autorizado</h2>
                <p>No tienes permisos para ver este reporte.</p>
            </div>
        );
    }

    return (
        <div className="history-container">
            <h2>Ventas por vendedor</h2>
            <div className="filter-section">
                <div className="filter-item">
                    <label>Fecha inicio:</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="filter-item">
                    <label>Fecha fin:</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="filter-item">
                    <label>Hora inicio:</label>
                    <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                </div>
                <div className="filter-item">
                    <label>Hora fin:</label>
                    <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                </div>
                <div className="filter-item">
                    <label>Método de pago:</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="">Todos</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Mixto">Mixto</option>
                    </select>
                </div>
                <div className="filter-item">
                    <label>Vendedor:</label>
                    <select value={vendedorFilter} onChange={(e) => setVendedorFilter(e.target.value)}>
                        <option value="">Todos</option>
                        {vendedores.map((v) => (
                            <option key={v.id} value={v.id}>{v.nombre_usuario}</option>
                        ))}
                    </select>
                </div>
                <button onClick={handleSearch}>Buscar</button>
            </div>

            {feedback && (
                <div className={`message ${feedback.type}`}>{feedback.message}</div>
            )}

            <div className="summary-section">
                <span>Vendedores: {rows.length}</span>
                <span>Ventas: {totales.cantidad_ventas}</span>
                <span>Total vendido: ${totales.monto_total}</span>
                <span>Ganancia: ${totales.ganancia_total}</span>
            </div>

            <div className="sales-list-container">
                {rows.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Vendedor</th>
                                <th>Rol</th>
                                <th>Cantidad de ventas</th>
                                <th>Total vendido</th>
                                <th>Ganancia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, idx) => (
                                <tr key={idx}>
                                    <td>{r.usuario_nombre}</td>
                                    <td>{r.rol}</td>
                                    <td>{r.cantidad_ventas}</td>
                                    <td>${r.monto_total}</td>
                                    <td>${r.ganancia_total}</td>
                                </tr>
                            ))}
                            <tr>
                                <td><strong>Total</strong></td>
                                <td></td>
                                <td><strong>{totales.cantidad_ventas}</strong></td>
                                <td><strong>${totales.monto_total}</strong></td>
                                <td><strong>${totales.ganancia_total}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                ) : (
                    <div className="no-sales-message">No hay ventas en el rango seleccionado.</div>
                )}
            </div>
        </div>
    );
};

export default VentasPorVendedor;