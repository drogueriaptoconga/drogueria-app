import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HistorialDeVentas.css';
import { getCurrentUser, getAuthHeaders } from '../auth';

const HistorialDeVentas = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sales, setSales] = useState([]);
    const [totalSales, setTotalSales] = useState(0);
    const [totalProfit, setTotalProfit] = useState(0);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [selectedSaleId, setSelectedSaleId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [feedback, setFeedback] = useState(null);

    const currentUser = getCurrentUser();

    const fetchSales = async (start, end) => {
        try {
            const params = {};
            if (start) params.startDate = start;
            if (end) params.endDate = end;

            // add auth headers so backend can enforce role checks
            const response = await axios.get(`http://localhost:3001/api/historial/ventas_detallado`, { params, headers: getAuthHeaders() });
            
            const fetchedSales = response.data.sales;
            const fetchedTotalSales = response.data.total;
            const fetchedTotalProfit = response.data.totalProfit || 0;

            setSales(fetchedSales);
            setTotalSales(fetchedTotalSales);
            setTotalProfit(fetchedTotalProfit);
        } catch (error) {
            console.error('Error al obtener el historial de ventas:', error);
            alert('Error al obtener el historial de ventas. Por favor, inténtalo de nuevo.');
        }
    };

    useEffect(() => {
        fetchSales();
    }, []);

    const handleSearch = () => {
        fetchSales(startDate, endDate);
    };

    const handleOpenCancelModal = (saleId) => {
        setSelectedSaleId(saleId);
        setCancelReason('');
        setShowCancelModal(true);
    };

    const handleCloseCancelModal = () => {
        setShowCancelModal(false);
        setSelectedSaleId(null);
        setCancelReason('');
    };

    const handleCancelSale = async () => {
        if (!cancelReason.trim()) {
            setFeedback({ type: 'error', message: 'Debe proporcionar un motivo de anulación.' });
            return;
        }

        try {
            await axios.put(
                `http://localhost:3001/api/ventas/${selectedSaleId}/anular`,
                { motivo_anulacion: cancelReason },
                {
                    headers: {
                        'x-user-role': currentUser.role,
                        'x-user-id': currentUser.id,
                    },
                }
            );
            setFeedback({ type: 'success', message: 'La venta fue anulada correctamente.' });
            handleCloseCancelModal();
            fetchSales(startDate, endDate);
        } catch (error) {
            console.error('Error al anular la venta:', error);
            setFeedback({ type: 'error', message: error.response?.data?.error || 'Error al anular la venta.' });
        }
    };

    if ((currentUser.role || '').toLowerCase() === 'asesor') {
        return (
            <div className="history-container">
                <h2>403 - No autorizado</h2>
                <p>No tienes permisos para ver el historial de ventas.</p>
            </div>
        );
    }

    return (
        <div className="history-container">
            <h2>Historial de Ventas</h2>
            <div className="filter-section">
                <div className="filter-item">
                    <label>Fecha de inicio:</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="filter-item">
                    <label>Fecha de fin:</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <button onClick={handleSearch}>Buscar</button>
            </div>
            
            <div className="summary-section">
                <span>Ventas Encontradas: {sales.length}</span>
                <span>Total Vendido: ${parseFloat(totalSales) || 0}</span>
                <span>Ganancia Total: ${parseFloat(totalProfit) || 0}</span>
                <span>Rol actual: {currentUser.role}</span>
            </div>
            {feedback && (
                <div className={`message ${feedback.type}`}>
                    {feedback.message}
                </div>
            )}

            <div className="sales-list-container">
                {sales.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>ID Venta</th>
                                <th>Fecha</th>
                                <th>Método Pago</th>
                                <th>Monto Total</th>
                                <th>Ganancia</th>
                                <th>Estado</th>
                                <th>Productos</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(sale => {
                                const isCanceled = !!sale.anulado;
                                const statusText = sale.estado || (isCanceled ? 'ANULADA' : 'ACTIVA');

                                const saleProfit = parseFloat(sale.ganancia_por_venta) || 0;

                                return (
                                    <tr key={sale.id} className={isCanceled ? 'sale-canceled' : ''}>
                                        <td>{sale.id}</td>
                                        <td>{new Date(sale.fecha_venta).toLocaleString()}</td>
                                        <td>{sale.metodo_pago}</td>
                                        <td>${parseFloat(sale.monto_total) || 0}</td>
                                        <td>${saleProfit}</td>
                                        <td>
                                            <div>{statusText}</div>
                                            {isCanceled && sale.motivo_anulacion && (
                                                <div className="cancel-info">Motivo: {sale.motivo_anulacion}</div>
                                            )}
                                            {isCanceled && sale.fecha_anulacion && (
                                                <div className="cancel-info">Anulada: {new Date(sale.fecha_anulacion).toLocaleString()}</div>
                                            )}
                                        </td>
                                        <td>
                                            <ul className="product-list">
                                                {sale.productos.map((product, index) => (
                                                    <li key={index}>
                                                        {product.nombre_producto} (x{product.cantidad}) - ${product.precio_unitario} c/u
                                                        {typeof product.ganancia_linea !== 'undefined' && (
                                                            <div className="cancel-info">Ganancia línea: ${parseFloat(product.ganancia_linea).toFixed(2)}</div>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                        <td>
                                            {!isCanceled && currentUser.role === 'admin' ? (
                                                <button className="btn-cancel-sale" onClick={() => handleOpenCancelModal(sale.id)}>
                                                    Anular
                                                </button>
                                            ) : (
                                                isCanceled ? <span className="cancelled-label">Anulada</span> : <span className="no-action-label">Sin acción</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="no-sales-message">
                        No hay ventas en el rango de fechas seleccionado.
                    </div>
                )}
            </div>

            {showCancelModal && (
                <div className="modal-overlay" onClick={handleCloseCancelModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Anular Venta</h3>
                        <p>Ingrese el motivo por el que se anula esta venta.</p>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            rows={4}
                            placeholder="Motivo de anulación"
                        />
                        <div className="modal-buttons">
                            <button className="btn-confirm" onClick={handleCancelSale}>Confirmar</button>
                            <button className="btn-cancel" onClick={handleCloseCancelModal}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistorialDeVentas;