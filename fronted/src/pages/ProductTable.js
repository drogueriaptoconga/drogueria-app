import React from 'react';
import { getExpirationStatus, formatDate, formatPrice } from './productUtils';

const ProductTable = ({ productos, showLowStock, handleEdit, handleDelete, isLoading, canManage = true }) => {
    const renderExpirationStatus = (producto) => {
        const status = getExpirationStatus(producto.fecha_vencimiento, producto.dias_alerta_vencimiento);
        
        if (status === 'expired') return <span className="badge badge-expired">Vencido</span>;
        if (status === 'warning') return <span className="badge badge-warning">Por vencer</span>;
        if (status === 'ok') return <span className="badge badge-success">Vigente</span>;
        return <span className="badge badge-secondary">Sin fecha</span>;
    };

    const renderSaleMode = (producto) => {
        if (producto.venta_exclusiva_sobre) {
            return <span className="badge badge-exclusive">Exclusivo Sobre</span>;
        }
        if (producto.venta_exclusiva_caja) {
            return <span className="badge badge-exclusive">Exclusivo Caja</span>;
        }
        
        const modes = [];
        if (producto.venta_por_unidad_habilitada) modes.push('Unidad');
        if (producto.vender_por_sobre) modes.push('Sobre');
        if (producto.vender_por_caja) modes.push('Caja');
        
        return modes.length > 0 ? modes.join(', ') : 'Sin modo';
    };

    const filteredProductos = productos.filter(p => {
        if (showLowStock) {
            const stockTotal = Number(p.stock_total) || 0;
            const stockMinimo = p.stock_minimo_alerta === null || p.stock_minimo_alerta === undefined || p.stock_minimo_alerta === ''
                ? 0
                : Number(p.stock_minimo_alerta) || 0;
            return stockTotal === 0 || stockTotal <= stockMinimo;
        }
        return true;
    });

    return (
        <div className="table-container">
            <h2>Lista de Productos ({filteredProductos.length})</h2>
            
            {isLoading ? (
                <div className="loading-table">
                    <p>Cargando productos...</p>
                </div>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Stock</th>
                            <th>Modo Venta</th>
                            {canManage && <th>Costo</th>}
                            <th>P. Unidad</th>
                            <th>P. Sobre</th>
                            <th>P. Caja</th>
                            <th>P. Solo Sobre</th>
                            <th>P. Solo Caja</th>
                            {canManage && <th>Margen U.</th>}
                            {canManage && <th>Margen S.</th>}
                            {canManage && <th>Margen C.</th>}
                            <th>Fecha Venc.</th>
                            <th>Estado / Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProductos.map(producto => {
                            const expirationStatus = getExpirationStatus(producto.fecha_vencimiento, producto.dias_alerta_vencimiento);
                            const stockTotal = Number(producto.stock_total) || 0;
                            const stockMinimo = producto.stock_minimo_alerta === null || producto.stock_minimo_alerta === undefined || producto.stock_minimo_alerta === ''
                                ? 0
                                : Number(producto.stock_minimo_alerta) || 0;
                            const isLowStock = stockTotal === 0 || stockTotal <= stockMinimo;
                            
                            const rowClass = expirationStatus === 'expired' ? 'expired-row' : 
                                             expirationStatus === 'warning' ? 'warning-row' : 
                                             isLowStock ? 'low-stock-row' : '';
                            
                            return (
                                <tr key={producto.id} className={rowClass}>
                                    <td>{producto.codigo_producto}</td>
                                    <td className="product-name">{producto.nombre}</td>
                                    <td className={isLowStock ? 'low-stock' : ''}>
                                        {producto.stock_total}
                                        {isLowStock && ' ⚠️'}
                                    </td>
                                    <td>{renderSaleMode(producto)}</td>
                                    {canManage && <td>{formatPrice(producto.costo_unidad)}</td>}
                                    <td>{producto.venta_por_unidad_habilitada ? formatPrice(producto.precio_unidad) : 'N/A'}</td>
                                    <td>{producto.vender_por_sobre ? formatPrice(producto.precio_por_sobre) : 'N/A'}</td>
                                    <td>{producto.vender_por_caja ? formatPrice(producto.precio_por_caja) : 'N/A'}</td>
                                    <td>{producto.venta_exclusiva_sobre ? formatPrice(producto.precio_solo_sobre) : 'N/A'}</td>
                                    <td>{producto.venta_exclusiva_caja ? formatPrice(producto.precio_solo_caja) : 'N/A'}</td>
                                    {canManage && <td>{producto.margen_porcentaje ? `${parseFloat(producto.margen_porcentaje).toFixed(1)}%` : 'N/A'}</td>}
                                    {canManage && <td>{producto.margen_sobre ? `${parseFloat(producto.margen_sobre).toFixed(1)}%` : 'N/A'}</td>}
                                    {canManage && <td>{producto.margen_caja ? `${parseFloat(producto.margen_caja).toFixed(1)}%` : 'N/A'}</td>}
                                    <td>{formatDate(producto.fecha_vencimiento)}</td>
                                    <td>
                                        {renderExpirationStatus(producto)}
                                        {canManage && (
                                            <div className="product-actions-inline" style={{ marginTop: '4px' }}>
                                                <button
                                                    className="edit-button"
                                                    onClick={() => handleEdit(producto)}
                                                    disabled={isLoading}
                                                    style={{ marginRight: '4px' }}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    className="delete-button"
                                                    onClick={() => handleDelete(producto.id, producto.nombre)}
                                                    disabled={isLoading}
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            
            {filteredProductos.length === 0 && !isLoading && (
                <div className="no-products">
                    <p>No se encontraron productos</p>
                </div>
            )}
        </div>
    );
};

export default ProductTable;