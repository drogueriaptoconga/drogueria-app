import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Traslados.css';
import { getCurrentUser, getAuthHeaders } from '../auth';

const API_BASE = 'http://localhost:3001';

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
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
    return { startDate, endDate };
};

const Traslados = () => {
    const currentUser = getCurrentUser();
    const defaultDates = getDefaultDates();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [formData, setFormData] = useState({
        cantidad: '',
        punto_origen: '',
        punto_destino: '',
        observacion: '',
    });
    const [historial, setHistorial] = useState([]);
    const [estadisticas, setEstadisticas] = useState({});
    const [filtros, setFiltros] = useState({
        fecha_desde: defaultDates.startDate,
        fecha_hasta: defaultDates.endDate,
    });
    const [paginacion, setPaginacion] = useState({});
    const [mensaje, setMensaje] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showAnularModal, setShowAnularModal] = useState(false);
    const [trasladoAnular, setTrasladoAnular] = useState(null);
    const [motivoAnulacion, setMotivoAnulacion] = useState('');

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchTerm(query);

        if (query.length > 2) {
            try {
                const response = await axios.get(
                    `${API_BASE}/api/entradas/buscar?query=${encodeURIComponent(query)}`
                );
                setSearchResults(response.data);
            } catch (error) {
                console.error('Error al buscar productos:', error);
                setMensaje({ tipo: 'error', texto: 'Error al buscar productos' });
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setSearchTerm(`${product.codigo_producto} - ${product.nombre}`);
        setSearchResults([]);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        if (!selectedProduct || !formData.cantidad || !formData.punto_origen || !formData.punto_destino) {
            setMensaje({ tipo: 'error', texto: 'Complete todos los campos obligatorios.' });
            setIsLoading(false);
            return;
        }

        const cantidadNum = Number(formData.cantidad);
        if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
            setMensaje({ tipo: 'error', texto: 'La cantidad debe ser un número entero positivo.' });
            setIsLoading(false);
            return;
        }

        if (formData.punto_origen.trim() === formData.punto_destino.trim()) {
            setMensaje({ tipo: 'error', texto: 'El punto origen y destino no pueden ser iguales.' });
            setIsLoading(false);
            return;
        }

        try {
            const response = await axios.post(
                `${API_BASE}/api/traslados`,
                {
                    producto_id: selectedProduct.id,
                    cantidad: cantidadNum,
                    punto_origen: formData.punto_origen,
                    punto_destino: formData.punto_destino,
                    observacion: formData.observacion,
                },
                { headers: getAuthHeaders() }
            );

            setMensaje({ tipo: 'success', texto: response.data.message });
            setFormData({ cantidad: '', punto_origen: '', punto_destino: '', observacion: '' });
            setSelectedProduct(null);
            setSearchTerm('');
            cargarEstadisticas();
            cargarHistorial();
        } catch (error) {
            const mensajeError = error.response?.data?.error || 'Error al registrar el traslado';
            setMensaje({ tipo: 'error', texto: `❌ ${mensajeError}` });
        } finally {
            setIsLoading(false);
        }
    };

    const cargarHistorial = useCallback(async (pagina = 1) => {
        try {
            const params = new URLSearchParams({
                page: pagina,
                limit: 20,
                ...filtros,
            });

            const response = await axios.get(
                `${API_BASE}/api/traslados?${params.toString()}`,
                { headers: getAuthHeaders() }
            );

            setHistorial(response.data.traslados || []);
            setPaginacion(response.data.paginacion || {});
        } catch (error) {
            console.error('Error al cargar historial:', error);
        }
    }, [filtros]);

    const cargarEstadisticas = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                ...(filtros.fecha_desde && { fecha_desde: filtros.fecha_desde }),
                ...(filtros.fecha_hasta && { fecha_hasta: filtros.fecha_hasta }),
            });

            const response = await axios.get(
                `${API_BASE}/api/traslados/estadisticas?${params.toString()}`,
                { headers: getAuthHeaders() }
            );
            setEstadisticas(response.data);
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    }, [filtros.fecha_desde, filtros.fecha_hasta]);

    const handleAnular = async () => {
        if (!motivoAnulacion.trim()) {
            setMensaje({ tipo: 'error', texto: 'Debe proporcionar un motivo de anulación.' });
            return;
        }

        try {
            await axios.patch(
                `${API_BASE}/api/traslados/${trasladoAnular.id}/anular`,
                { motivo_anulacion: motivoAnulacion },
                { headers: getAuthHeaders() }
            );
            setMensaje({ tipo: 'success', texto: 'Traslado anulado correctamente. Stock restaurado.' });
            setShowAnularModal(false);
            setTrasladoAnular(null);
            setMotivoAnulacion('');
            cargarEstadisticas();
            cargarHistorial();
        } catch (error) {
            const mensajeError = error.response?.data?.error || 'Error al anular el traslado';
            setMensaje({ tipo: 'error', texto: `❌ ${mensajeError}` });
        }
    };

    useEffect(() => {
        cargarEstadisticas();
        cargarHistorial();
    }, [cargarEstadisticas, cargarHistorial]);

    if ((currentUser.role || '').toLowerCase() === 'asesor') {
        return (
            <div className="traslados-container">
                <h1>403 - No autorizado</h1>
                <p>No tienes permisos para ver la gestión de traslados.</p>
            </div>
        );
    }

    const stockResaltante = selectedProduct?.stock_total || 0;
    const valorTraslado =
        (Number(formData.cantidad) || 0) *
        (Number(selectedProduct?.costo_unidad) || 0);

    return (
        <div className="traslados-container">
            <h1>🚚 Traslados de Productos</h1>

            {mensaje && (
                <div className={`mensaje ${mensaje.tipo}`}>
                    {mensaje.texto}
                </div>
            )}

            <div className="estadisticas-grid">
                <div className="estadistica-card traslados-card">
                    <h3>Total Traslados</h3>
                    <span className="numero">{estadisticas.total_traslados || 0}</span>
                </div>
                <div className="estadistica-card unidades-card">
                    <h3>Total Unidades</h3>
                    <span className="numero">{estadisticas.total_unidades || 0}</span>
                </div>
                <div className="estadistica-card valor-card">
                    <h3>Valor Trasladado</h3>
                    <span className="numero">{formatCurrency(estadisticas.total_valor_trasladado)}</span>
                </div>
            </div>

            <div className="search-container">
                <input
                    type="text"
                    placeholder="🔍 Buscar producto por código o nombre..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="search-input"
                />
                {searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults.map((product) => (
                            <div
                                key={product.id}
                                className="search-result"
                                onClick={() => handleSelectProduct(product)}
                            >
                                <div className="product-header">
                                    <strong>{product.codigo_producto}</strong> - {product.nombre}
                                </div>
                                <div className="product-details">
                                    <small>Stock: {product.stock_total} | Costo: {formatCurrency(product.costo_unidad)}</small>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedProduct && (
                <div className="traslado-form">
                    <div className="form-header">
                        <h2>📝 Registrar Traslado</h2>
                        <div className="selected-product-info">
                            <strong>{selectedProduct.codigo_producto}</strong> - {selectedProduct.nombre}
                            <span className="product-tag simple">
                                Stock: {selectedProduct.stock_total}
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-grid">
                            <div className="form-group info-group">
                                <label>Información del Producto</label>
                                <div className="info-display">
                                    <div><strong>Costo unitario:</strong> {formatCurrency(selectedProduct.costo_unidad)}</div>
                                    <div><strong>Stock disponible:</strong> {stockResaltante} unidades</div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Cantidad a trasladar *</label>
                                <input
                                    type="number"
                                    name="cantidad"
                                    value={formData.cantidad}
                                    onChange={handleInputChange}
                                    min="1"
                                    max={selectedProduct.stock_total}
                                    step="1"
                                    placeholder="0"
                                    required
                                />
                                <small className="help-text">
                                    Stock resultante: {stockResaltante - (Number(formData.cantidad) || 0)} unidades
                                </small>
                            </div>

                            <div className="form-group">
                                <label>Punto de origen *</label>
                                <input
                                    type="text"
                                    name="punto_origen"
                                    value={formData.punto_origen}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Estante A - Principal"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Punto de destino *</label>
                                <input
                                    type="text"
                                    name="punto_destino"
                                    value={formData.punto_destino}
                                    onChange={handleInputChange}
                                    placeholder="Ej: Estante B - Reserva"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Observación</label>
                                <textarea
                                    name="observacion"
                                    value={formData.observacion}
                                    onChange={handleInputChange}
                                    placeholder="Motivo del traslado (opcional)..."
                                />
                            </div>
                        </div>

                        <div className="resumen-grid">
                            <div className="resumen-item total">
                                <span>Valor del traslado:</span>
                                <strong>{formatCurrency(valorTraslado)}</strong>
                            </div>
                        </div>

                        <div className="button-group">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isLoading}
                            >
                                {isLoading ? '⏳ Procesando...' : '✅ Registrar Traslado'}
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setSelectedProduct(null);
                                    setSearchTerm('');
                                    setFormData({ cantidad: '', punto_origen: '', punto_destino: '', observacion: '' });
                                }}
                                disabled={isLoading}
                            >
                                ❌ Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="historial-toggle">
                <div className="filtros-historial">
                    <div className="filtro-group">
                        <label>Desde:</label>
                        <input
                            type="date"
                            name="fecha_desde"
                            value={filtros.fecha_desde}
                            onChange={(e) => setFiltros(prev => ({ ...prev, fecha_desde: e.target.value }))}
                        />
                    </div>
                    <div className="filtro-group">
                        <label>Hasta:</label>
                        <input
                            type="date"
                            name="fecha_hasta"
                            value={filtros.fecha_hasta}
                            onChange={(e) => setFiltros(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                        />
                    </div>
                    <button
                        className="btn-primary"
                        onClick={() => { cargarHistorial(1); }}
                    >
                        🔍 Aplicar Filtros
                    </button>
                </div>
            </div>

            <div className="historial-section">
                <h2>📊 Historial de Traslados</h2>
                {historial.length === 0 ? (
                    <p className="no-traslados">No hay traslados registrados en el rango de fechas.</p>
                ) : (
                    <>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Producto</th>
                                        <th>Código</th>
                                        <th>Cantidad</th>
                                        <th>Costo/U</th>
                                        <th>Valor</th>
                                        <th>Origen</th>
                                        <th>Destino</th>
                                        <th>Observación</th>
                                        <th>Usuario</th>
                                        <th>Estado</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historial.map((t) => (
                                        <tr key={t.id} className={t.anulado ? 'traslado-fila-anulada' : ''}>
                                            <td>{formatDate(t.fecha_entrada)}</td>
                                            <td>{t.nombre_producto || 'N/A'}</td>
                                            <td>{t.codigo_producto || 'N/A'}</td>
                                            <td>{t.cantidad}</td>
                                            <td>{formatCurrency(t.costo_unidad)}</td>
                                            <td>{formatCurrency(t.valor_traslado)}</td>
                                            <td>{t.punto_origen || '-'}</td>
                                            <td>{t.punto_destino || '-'}</td>
                                            <td>{t.observacion || '-'}</td>
                                            <td>{t.usuario_nombre || 'Sistema'}</td>
                                            <td>
                                                {t.anulado ? (
                                                    <span className="anulado-badge">Anulado</span>
                                                ) : 'Activo'}
                                            </td>
                                            <td>
                                                {!t.anulado && currentUser.role === 'admin' && (
                                                    <button
                                                        className="btn-anular"
                                                        onClick={() => {
                                                            setTrasladoAnular(t);
                                                            setMotivoAnulacion('');
                                                            setShowAnularModal(true);
                                                        }}
                                                    >
                                                        Anular
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {paginacion && paginacion.total_paginas > 1 && (
                            <div className="paginacion">
                                <button
                                    onClick={() => cargarHistorial(paginacion.pagina_actual - 1)}
                                    disabled={paginacion.pagina_actual === 1}
                                >
                                    ◀ Anterior
                                </button>
                                <span>Página {paginacion.pagina_actual} de {paginacion.total_paginas}</span>
                                <button
                                    onClick={() => cargarHistorial(paginacion.pagina_actual + 1)}
                                    disabled={paginacion.pagina_actual === paginacion.total_paginas}
                                >
                                    Siguiente ▶
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showAnularModal && trasladoAnular && (
                <div className="modal-overlay" onClick={() => setShowAnularModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Anular Traslado</h3>
                        <p>
                            Traslado de <strong>{trasladoAnular.nombre_producto}</strong> -{' '}
                            {formatCurrency(trasladoAnular.valor_traslado)}
                        </p>
                        <p>Ingrese el motivo por el que se anula este traslado. El stock será restaurado.</p>
                        <textarea
                            value={motivoAnulacion}
                            onChange={(e) => setMotivoAnulacion(e.target.value)}
                            rows={4}
                            placeholder="Motivo de anulación..."
                        />
                        <div className="modal-buttons">
                            <button className="btn-cancel" onClick={() => setShowAnularModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn-confirm" onClick={handleAnular}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Traslados;
