// src/components/ProductoLista.js
import React from 'react';
import './Productos.css';

const ProductoLista = ({ productos, searchTerm, setSearchTerm, onEdit, onDelete }) => {

    const formatPrice = (price) => {
        const parsedPrice = parseFloat(price);
        return isNaN(parsedPrice) || parsedPrice === 0 ? 'No registrado' : `$${parsedPrice.toFixed(2)}`;
    };

    return (
        <>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Buscar por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="table-container">
                <h2>Lista de Productos</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Stock</th>
                            <th>Costo</th>
                            <th>P. Unidad</th>
                            <th>P. Caja</th>
                            <th>P. Sobre</th>
                            <th>Margen (%)</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map(producto => (
                            <tr key={producto.id} className={producto.stock_total <= producto.stock_minimo_alerta ? 'low-stock-row' : ''}>
                                <td>{producto.codigo_producto}</td>
                                <td>{producto.nombre}</td>
                                <td>{producto.stock_total}</td>
                                <td>{formatPrice(producto.costo_unidad)}</td>
                                <td>{producto.venta_por_unidad_habilitada ? formatPrice(producto.precio_unidad) : 'No registrado'}</td>
                                <td>{producto.vender_por_caja ? formatPrice(producto.precio_por_caja) : 'No registrado'}</td>
                                <td>{producto.vender_por_sobre ? formatPrice(producto.precio_por_sobre) : 'No registrado'}</td>
                                <td>{parseFloat(producto.margen_porcentaje).toFixed(2)}%</td>
                                <td>
                                    <button className="edit-button" onClick={() => onEdit(producto)}>Editar</button>
                                    <button className="delete-button" onClick={() => onDelete(producto.id, producto.nombre)}>Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default ProductoLista;