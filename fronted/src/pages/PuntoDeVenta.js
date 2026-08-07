import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './PuntoDeVenta.css';

const PuntoDeVenta = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [cart, setCart] = useState([]);
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [montoTotal, setMontoTotal] = useState(0);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [message, setMessage] = useState(null);
    const [montoPagado, setMontoPagado] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [clienteData, setClienteData] = useState({ nombre: '', cedula: '', correo: '', celular: '' });
    const [conFactura, setConFactura] = useState(false);
    const [showFactura, setShowFactura] = useState(false);
    const [facturaVenta, setFacturaVenta] = useState(null);
    
    const [activeCartItemIndex, setActiveCartItemIndex] = useState(null);

    const searchInputRef = useRef(null);
    const searchResultsRef = useRef(null);
    const processSaleButtonRef = useRef(null);
    const confirmButtonRef = useRef(null);

    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchTerm(query);
        if (query.length > 2) {
            try {
                const response = await axios.get(`http://localhost:3001/api/productos?search=${query}`);
                setSearchResults(response.data);
            } catch (error) {
                console.error('Error al buscar productos:', error);
                showMessage('Error al buscar productos', 'error');
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleSearchKeyDown = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchTerm.trim() !== '') {
                try {
                    const response = await axios.get(`http://localhost:3001/api/productos?search=${searchTerm}`);
                    if (response.data.length === 1) {
                        addToCart(response.data[0]);
                    } else {
                        showMessage('Producto no encontrado o búsqueda ambigua.', 'error');
                    }
                } catch (error) {
                    console.error('Error al buscar producto por código:', error);
                    showMessage('Error al buscar producto.', 'error');
                }
            }
        }
    };

    const addToCart = (product) => {
        const availableOptions = getAvailableTipoVentaOptions(product);

        // Filtrar opciones que ya están en el carrito
        const usedOptions = cart
            .filter(item => item.id === product.id)
            .map(item => item.tipo_venta);

        const remainingOptions = availableOptions.filter(opt => !usedOptions.includes(opt));

        if (remainingOptions.length === 0) {
            showMessage('Este producto ya fue agregado en todas sus presentaciones.', 'error');
            return;
        }

        const defaultTipoVenta = remainingOptions[0];

        setCart([...cart, { ...product, cantidad_vendida: 1, tipo_venta: defaultTipoVenta }]);
        setSearchTerm('');
        setSearchResults([]);
        showMessage(`Producto añadido al carrito en modo ${defaultTipoVenta}.`);
        setActiveCartItemIndex(cart.length);
    };

    const handleQuantityChange = useCallback((id, change) => {
        const updatedCart = cart.map(item =>
            item.id === id ? { ...item, cantidad_vendida: Math.max(1, item.cantidad_vendida + change) } : item
        );
        setCart(updatedCart);
    }, [cart]);

    const handleRemoveFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
        showMessage('Producto eliminado del carrito.');
    };

    const handleTipoVentaChange = (id, tipo) => {
        const updatedCart = cart.map(item =>
            item.id === id ? { ...item, tipo_venta: tipo } : item
        );
        setCart(updatedCart);
    };

    const handleProcesarVenta = useCallback(() => {
        if (cart.length === 0) {
            showMessage('El carrito está vacío.', 'error');
            return;
        }
        setShowConfirmation(true);
    }, [cart]);

    const confirmarVenta = useCallback(async () => {
        const montoNumerico = parseFloat(montoPagado);
        const clienteNombre = clienteData.nombre.trim();
        const clienteCorreo = clienteData.correo.trim();

        if (conFactura && !clienteNombre && !clienteCorreo) {
            showMessage('Ingresa al menos el nombre o el correo del cliente para la factura.', 'error');
            return;
        }
        
        // Validación para Efectivo
        if (metodoPago === 'Efectivo') {
            if (isNaN(montoNumerico) || montoNumerico <= 0) {
                showMessage('El monto pagado no puede ser cero.', 'error');
                return;
            }
            if (montoNumerico < montoTotal) {
                showMessage('El monto pagado es insuficiente.', 'error');
                return;
            }
        }

        // Preparar productos para la venta
        const ventaProductos = cart.map(item => ({
            producto_id: item.id,
            cantidad_vendida: item.cantidad_vendida,
            tipo_venta: item.tipo_venta
        }));

        // Preparar datos de la venta
        const ventaData = {
            usuario_id: 1,
            metodo_pago: metodoPago,
            monto_efectivo: metodoPago === 'Efectivo' ? montoTotal : 0,
            monto_transferencia: metodoPago === 'Transferencia' ? montoTotal : 0,
            productos: ventaProductos
        };

        console.log('📦 Enviando venta:', JSON.stringify(ventaData, null, 2));

        setIsLoading(true);

        try {
            const response = await axios.post('http://localhost:3001/api/ventas', ventaData);
            
            console.log('✅ Venta exitosa:', response.data);
            
            const factura = {
                id: response.data.venta_id,
                numero: response.data.venta_id,
                fecha: new Date().toLocaleString('es-CO'),
                empresa: 'Drogueria Puerto Conga',
                cliente: {
                    nombre: clienteData.nombre || 'Cliente general',
                    cedula: clienteData.cedula || 'N/A',
                    correo: clienteData.correo || 'N/A',
                    celular: clienteData.celular || 'N/A'
                },
                productos: cart.map(item => ({
                    nombre: item.nombre,
                    tipo: item.tipo_venta,
                    cantidad: item.cantidad_vendida,
                    precio: (item.tipo_venta === 'Unidad' ? item.precio_unidad : item.tipo_venta === 'Sobre' ? item.precio_por_sobre : item.tipo_venta === 'Caja' ? item.precio_por_caja : item.tipo_venta === 'Solo Sobre' ? item.precio_solo_sobre : item.tipo_venta === 'Solo Caja' ? item.precio_solo_caja : 0),
                    total: (item.tipo_venta === 'Unidad' ? item.precio_unidad * item.cantidad_vendida : item.tipo_venta === 'Sobre' ? item.precio_por_sobre * item.cantidad_vendida : item.tipo_venta === 'Caja' ? item.precio_por_caja * item.cantidad_vendida : item.tipo_venta === 'Solo Sobre' ? item.precio_solo_sobre * item.cantidad_vendida : item.tipo_venta === 'Solo Caja' ? item.precio_solo_caja * item.cantidad_vendida : 0)
                })),
                total: montoTotal,
                metodoPago: metodoPago
            };

            setFacturaVenta(factura);
            setShowFactura(conFactura);
            showMessage('✅ Venta procesada exitosamente!');
            setCart([]);
            setMontoTotal(0);
            setMontoPagado('');
            setShowConfirmation(false);
            
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        } catch (error) {
            console.error('❌ Error al procesar la venta:', error);
            
            let errorMessage = 'Error al procesar la venta.';
            
            if (error.response) {
                console.error('❌ Detalles del error:', error.response.data);
                if (error.response.data && error.response.data.error) {
                    errorMessage = error.response.data.error;
                }
                if (error.response.data && error.response.data.detalle) {
                    errorMessage += ` (${error.response.data.detalle})`;
                }
                if (error.response.status === 500) {
                    errorMessage = 'Error interno del servidor. Revisa la consola del backend.';
                }
            } else if (error.request) {
                errorMessage = 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.';
            }
            
            showMessage(`❌ ${errorMessage}`, 'error');
            setShowConfirmation(false);
        } finally {
            setIsLoading(false);
        }
    }, [metodoPago, montoPagado, montoTotal, cart, clienteData]);

    const cancelarVenta = () => {
        setShowConfirmation(false);
        setMontoPagado('');
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    };

    const imprimirFactura = () => {
        if (!facturaVenta) return;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return;
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Factura</title><style>body{font-family:Arial,sans-serif;padding:24px;} .box{border:1px solid #ddd;padding:16px;border-radius:8px;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;} .right{text-align:right;} .title{font-size:20px;font-weight:bold;margin-bottom:10px;}</style></head><body><div class='box'><div class='title'>Factura de venta</div><p><strong>Empresa:</strong> ${facturaVenta.empresa}</p><p><strong>Número de factura:</strong> ${facturaVenta.numero}</p><p><strong>Cliente:</strong> ${facturaVenta.cliente.nombre}</p><p><strong>Cédula:</strong> ${facturaVenta.cliente.cedula}</p><p><strong>Correo:</strong> ${facturaVenta.cliente.correo}</p><p><strong>Celular:</strong> ${facturaVenta.cliente.celular}</p><p><strong>Fecha:</strong> ${facturaVenta.fecha}</p><p><strong>Método de pago:</strong> ${facturaVenta.metodoPago}</p><table><thead><tr><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>${facturaVenta.productos.map(item => `<tr><td>${item.nombre}</td><td>${item.tipo}</td><td>${item.cantidad}</td><td>${Number(item.precio).toLocaleString('es-CO')}</td><td>${Number(item.total).toLocaleString('es-CO')}</td></tr>`).join('')}</tbody></table><p class='right'><strong>Total:</strong> ${Number(facturaVenta.total).toLocaleString('es-CO')}</p></div></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    // Calcular total del carrito
    useEffect(() => {
        const total = cart.reduce((sum, item) => {
            let price = 0;
            if (item.tipo_venta === 'Unidad') {
                price = item.precio_unidad || 0;
            } else if (item.tipo_venta === 'Sobre') {
                price = item.precio_por_sobre || 0;
            } else if (item.tipo_venta === 'Caja') {
                price = item.precio_por_caja || 0;
            } else if (item.tipo_venta === 'Solo Sobre') {
                price = item.precio_solo_sobre || 0;
            } else if (item.tipo_venta === 'Solo Caja') {
                price = item.precio_solo_caja || 0;
            }
            return sum + (price * item.cantidad_vendida);
        }, 0);
        setMontoTotal(total);
    }, [cart]);

    // Foco automático en el campo de búsqueda
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // Cerrar resultados de búsqueda al hacer clic fuera o con Escape
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target) &&
                searchResultsRef.current &&
                !searchResultsRef.current.contains(event.target)
            ) {
                setSearchResults([]);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                if (showConfirmation) {
                    cancelarVenta();
                } else {
                    setSearchResults([]);
                    setSearchTerm('');
                }
            } else if (e.key === 'Enter') {
                const active = document.activeElement;

                if (searchInputRef.current && searchInputRef.current.contains(active)) return;

                if (showConfirmation) {
                    if (cart.length === 0) return;

                    const modalOverlays = document.querySelectorAll('.modal-overlay');
                    if (modalOverlays && modalOverlays.length > 1) return;

                    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
                        if (!(active.id === 'montoPagado' || (confirmButtonRef.current && confirmButtonRef.current.contains(active)))) return;
                    }

                    e.preventDefault();
                    confirmarVenta();
                } else {
                    if (cart.length === 0) return;

                    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
                        return;
                    }

                    e.preventDefault();
                    handleProcesarVenta();
                }
            } else if (e.key === ' ') {
                if (document.activeElement !== searchInputRef.current) {
                    if (cart.length === 0) return;
                    if (showConfirmation) {
                        confirmarVenta();
                    } else {
                        handleProcesarVenta();
                    }
                }
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (cart.length > 0 && document.activeElement !== searchInputRef.current) {
                    const direction = e.key === 'ArrowUp' ? -1 : 1;
                    let newIndex = activeCartItemIndex === null ? (direction === 1 ? 0 : cart.length - 1) : activeCartItemIndex + direction;
                    if (newIndex < 0) newIndex = cart.length - 1;
                    if (newIndex >= cart.length) newIndex = 0;
                    setActiveCartItemIndex(newIndex);
                    
                    if (activeCartItemIndex !== null) {
                        handleQuantityChange(cart[activeCartItemIndex].id, direction);
                    }
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showConfirmation, activeCartItemIndex, cart, confirmarVenta, handleProcesarVenta, handleQuantityChange]);

    const vuelto = montoPagado && parseFloat(montoPagado) > montoTotal ? parseFloat(montoPagado) - montoTotal : 0;

    // Función para determinar las opciones de tipo de venta disponibles
    const getAvailableTipoVentaOptions = (product) => {
        const options = [];
        
        if (product.precio_unidad && product.precio_unidad > 0) {
            options.push('Unidad');
        }
        
        if (product.precio_por_sobre && product.precio_por_sobre > 0 && product.unidades_por_sobre && product.unidades_por_sobre > 0) {
            options.push('Sobre');
        }
        
        if (product.precio_por_caja && product.precio_por_caja > 0 && product.unidades_por_caja && product.unidades_por_caja > 0) {
            options.push('Caja');
        }
        
        if (product.precio_solo_sobre && product.precio_solo_sobre > 0 && product.cantidad_solo_sobre && product.cantidad_solo_sobre > 0) {
            options.push('Solo Sobre');
        }
        
        if (product.precio_solo_caja && product.precio_solo_caja > 0 && product.cantidad_solo_caja && product.cantidad_solo_caja > 0) {
            options.push('Solo Caja');
        }
        
        return options;
    };

    return (
        <div className="pv-container">
            <h1>Punto de Venta</h1>
            
            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}
            
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Procesando venta...</p>
                </div>
            )}
            
            <div className="main-content">
                <div className="left-panel">
                    <div className="search-section">
                        <input
                            type="text"
                            placeholder="Buscar producto por nombre o código..."
                            value={searchTerm}
                            onChange={handleSearch}
                            onKeyDown={handleSearchKeyDown}
                            ref={searchInputRef}
                        />
                    </div>
                    {searchResults.length > 0 && (
                        <div className="search-results-overlay" ref={searchResultsRef}>
                            <div className="search-results-list">
                                {searchResults.map(product => (
                                    <div
                                        key={product.id}
                                        className="search-result-item"
                                        onClick={() => addToCart(product)}
                                    >
                                        <span>{product.nombre} - ${product.precio_unidad}</span>
                                        {product.solo_sobre && <span className="badge-solo">Solo Sobre</span>}
                                        {product.solo_caja && <span className="badge-solo">Solo Caja</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="right-panel">
                    <div className="cart-section">
                        <h2>Carrito de Compras</h2>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Tipo</th>
                                        <th>Cantidad</th>
                                        <th>Precio</th>
                                        <th>Total</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, index) => {
                                        const availableOptions = getAvailableTipoVentaOptions(item);
                                        
                                        return (
                                            <tr 
                                                key={item.id} 
                                                className={index === activeCartItemIndex ? 'selected-row' : ''}
                                                onClick={() => setActiveCartItemIndex(index)}
                                            >
                                                <td>{item.nombre}</td>
                                                <td>
                                                    <select
                                                        value={item.tipo_venta}
                                                        onChange={(e) => handleTipoVentaChange(item.id, e.target.value)}
                                                    >
                                                        {availableOptions
                                                            .filter(opt => 
                                                                !cart.some(c => c.id === item.id && c.tipo_venta === opt && c !== item)
                                                            )
                                                            .map(option => (
                                                                <option key={option} value={option}>{option}</option>
                                                            ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <div className="quantity-controls">
                                                        <button onClick={() => handleQuantityChange(item.id, -1)}>-</button>
                                                        <span>{item.cantidad_vendida}</span>
                                                        <button onClick={() => handleQuantityChange(item.id, 1)}>+</button>
                                                    </div>
                                                </td>
                                                <td>
                                                    ${item.tipo_venta === 'Unidad' ? item.precio_unidad :
                                                    item.tipo_venta === 'Sobre' ? item.precio_por_sobre :
                                                    item.tipo_venta === 'Caja' ? item.precio_por_caja :
                                                    item.tipo_venta === 'Solo Sobre' ? item.precio_solo_sobre :
                                                    item.tipo_venta === 'Solo Caja' ? item.precio_solo_caja : 'N/A'}
                                                </td>
                                                <td>
                                                    $
                                                    {(item.tipo_venta === 'Unidad' ? item.precio_unidad * item.cantidad_vendida :
                                                    item.tipo_venta === 'Sobre' ? item.precio_por_sobre * item.cantidad_vendida :
                                                    item.tipo_venta === 'Caja' ? item.precio_por_caja * item.cantidad_vendida :
                                                    item.tipo_venta === 'Solo Sobre' ? item.precio_solo_sobre * item.cantidad_vendida :
                                                    item.tipo_venta === 'Solo Caja' ? item.precio_solo_caja * item.cantidad_vendida : 0)
                                                    }
                                                </td>
                                                <td>
                                                    <button onClick={() => handleRemoveFromCart(item.id)}>Quitar</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="checkout-section">
                        <div className="total">
                            <strong>Total: ${montoTotal}</strong>
                        </div>
                        <div className="payment-method">
                            <label>
                                <input
                                    type="radio"
                                    value="Efectivo"
                                    checked={metodoPago === 'Efectivo'}
                                    onChange={() => setMetodoPago('Efectivo')}
                                />
                                Efectivo
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    value="Transferencia"
                                    checked={metodoPago === 'Transferencia'}
                                    onChange={() => setMetodoPago('Transferencia')}
                                />
                                Transferencia
                            </label>
                        </div>
                        <div className="factura-option">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={conFactura}
                                    onChange={(e) => setConFactura(e.target.checked)}
                                />
                                Generar factura
                            </label>
                        </div>
                        <button
                            className="process-sale-btn"
                            onClick={handleProcesarVenta}
                            ref={processSaleButtonRef}
                            disabled={cart.length === 0 || isLoading}
                            title={cart.length === 0 ? 'Agrega al menos un producto para procesar la venta' : 'Procesar venta'}
                        >
                            {isLoading ? 'Procesando...' : 'Procesar Venta'}
                        </button>
                    </div>
                </div>
            </div>
            
            {showConfirmation && !isLoading && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Confirmar Venta</h3>
                        <p>¿Estás seguro de que deseas procesar esta venta?</p>
                        <div className="modal-details">
                            <p><strong>Total:</strong> ${montoTotal}</p>
                            <p><strong>Método de pago:</strong> {metodoPago}</p>
                            {metodoPago === 'Efectivo' && (
                                <>
                                    <div className="modal-input-group">
                                        <label htmlFor="montoPagado">Monto recibido:</label>
                                        <input
                                            id="montoPagado"
                                            type="number"
                                            step="0.01"
                                            value={montoPagado}
                                            onChange={(e) => setMontoPagado(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <p className="vuelto"><strong>Vuelto:</strong> ${vuelto}</p>
                                </>
                            )}
                            {conFactura ? (
                                <>
                                    <div className="modal-input-group">
                                        <label htmlFor="clienteNombre">Nombre del cliente</label>
                                        <input id="clienteNombre" value={clienteData.nombre} onChange={(e) => setClienteData(prev => ({ ...prev, nombre: e.target.value }))} placeholder="Requerido para factura" />
                                    </div>
                                    <div className="modal-input-group">
                                        <label htmlFor="clienteCedula">Cédula</label>
                                        <input id="clienteCedula" value={clienteData.cedula} onChange={(e) => setClienteData(prev => ({ ...prev, cedula: e.target.value }))} placeholder="Opcional" />
                                    </div>
                                    <div className="modal-input-group">
                                        <label htmlFor="clienteCorreo">Correo</label>
                                        <input id="clienteCorreo" type="email" value={clienteData.correo} onChange={(e) => setClienteData(prev => ({ ...prev, correo: e.target.value }))} placeholder="Opcional" />
                                    </div>
                                    <div className="modal-input-group">
                                        <label htmlFor="clienteCelular">Celular</label>
                                        <input id="clienteCelular" value={clienteData.celular} onChange={(e) => setClienteData(prev => ({ ...prev, celular: e.target.value }))} placeholder="Opcional" />
                                    </div>
                                </>
                            ) : (
                                <p className="sin-factura">No se requiere información de facturación porque no se activó la factura.</p>
                            )}
                            <p><strong>Productos:</strong></p>
                            <ul>
                                {cart.map(item => (
                                    <li key={item.id}>
                                        {item.nombre} - {item.cantidad_vendida} {item.tipo_venta.toLowerCase()}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="modal-buttons">
                            <button className="btn-confirm" onClick={confirmarVenta} ref={confirmButtonRef} disabled={isLoading}>
                                {isLoading ? 'Procesando...' : 'Confirmar'}
                            </button>
                            <button className="btn-cancel" onClick={cancelarVenta}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {showFactura && facturaVenta && (
                <div className="factura-modal">
                    <div className="factura-card">
                        <h3>Factura de venta</h3>
                        <p><strong>Empresa:</strong> {facturaVenta.empresa}</p>
                        <p><strong>Número de factura:</strong> {facturaVenta.numero}</p>
                        <p><strong>Cliente:</strong> {facturaVenta.cliente.nombre}</p>
                        <p><strong>Cédula:</strong> {facturaVenta.cliente.cedula}</p>
                        <p><strong>Correo:</strong> {facturaVenta.cliente.correo}</p>
                        <p><strong>Celular:</strong> {facturaVenta.cliente.celular}</p>
                        <p><strong>Fecha:</strong> {facturaVenta.fecha}</p>
                        <p><strong>Método de pago:</strong> {facturaVenta.metodoPago}</p>
                        <table>
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Tipo</th>
                                    <th>Cant.</th>
                                    <th>Precio</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {facturaVenta.productos.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.nombre}</td>
                                        <td>{item.tipo}</td>
                                        <td>{item.cantidad}</td>
                                        <td>{Number(item.precio).toLocaleString('es-CO')}</td>
                                        <td>{Number(item.total).toLocaleString('es-CO')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p style={{ textAlign: 'right', fontWeight: 'bold', marginTop: '12px' }}>
                            Total: {Number(facturaVenta.total).toLocaleString('es-CO')}
                        </p>
                        <div className="factura-actions">
                            <button className="btn-secondary" onClick={() => setShowFactura(false)}>Cerrar</button>
                            <button className="btn-primary" onClick={imprimirFactura}>Imprimir / Guardar PDF</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PuntoDeVenta;