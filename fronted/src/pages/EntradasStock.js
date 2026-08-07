import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './EntradasStock.css';

const EntradasStock = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [form, setForm] = useState({
        cantidad_entrada: '',
        costo_unidad_entrada: '',
        precio_unidad_entrada: '',
        precio_por_sobre_entrada: '',
        precio_por_caja_entrada: '',
        precio_solo_sobre_entrada: '',
        precio_solo_caja_entrada: '',
        fecha_vencimiento: ''
    });
    const [margenes, setMargenes] = useState({
        unidad: 0,
        sobre: 0,
        caja: 0,
        solo_sobre: 0,
        solo_caja: 0
    });
    const [sugeridos, setSugeridos] = useState({
        precio_unidad_entrada: '',
        precio_por_sobre_entrada: '',
        precio_por_caja_entrada: '',
        precio_solo_sobre_entrada: '',
        precio_solo_caja_entrada: ''
    });
    const [historial, setHistorial] = useState([]);
    const [estadisticas, setEstadisticas] = useState({});
    const [showHistorial, setShowHistorial] = useState(false);
    const [filtros, setFiltros] = useState({
        fecha_desde: '',
        fecha_hasta: ''
    });
    const [paginacion, setPaginacion] = useState({});
    const [mensaje, setMensaje] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const searchRef = useRef(null);

    // Buscar productos
    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchTerm(query);
        
        if (query.length > 2) {
            try {
                const response = await axios.get(`http://localhost:3001/api/entradas/buscar?query=${encodeURIComponent(query)}`);
                setSearchResults(response.data);
            } catch (error) {
                console.error('Error al buscar productos:', error);
                setMensaje({ tipo: 'error', texto: 'Error al buscar productos' });
            }
        } else {
            setSearchResults([]);
        }
    };

    // Seleccionar producto
    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setSearchTerm(`${product.codigo_producto} - ${product.nombre}`);
        setSearchResults([]);
        
        // Llenar automáticamente con los valores actuales del producto (sin ceros colgando)
        setForm({
            cantidad_entrada: '',
            costo_unidad_entrada: product.costo_unidad || '',
            precio_unidad_entrada: product.precio_unidad || '',
            precio_por_sobre_entrada: product.precio_por_sobre || '',
            precio_por_caja_entrada: product.precio_por_caja || '',
            precio_solo_sobre_entrada: product.precio_solo_sobre || '',
            precio_solo_caja_entrada: product.precio_solo_caja || '',
            fecha_vencimiento: product.fecha_vencimiento ? product.fecha_vencimiento.substring(0, 10) : ''
        });
        
        // Calcular márgenes iniciales
        calcularTodosLosMargenes(
            product.costo_unidad || 0,
            product.precio_unidad || 0,
            product.precio_por_sobre || 0,
            product.precio_por_caja || 0,
            product.precio_solo_sobre || 0,
            product.precio_solo_caja || 0,
            product
        );

        // Calcular sugerencias de venta con 20% de margen
        calcularSugeridos(product.costo_unidad || 0, product);
    };

    // ✅✅✅ CALCULAR TODOS LOS MÁRGENES - FORMULAS CORREGIDAS
    const calcularTodosLosMargenes = (costo, precioUnidad, precioSobre, precioCaja, precioSoloSobre, precioSoloCaja, producto) => {
        const margenUnidad = calcularPorcentajeMargen(costo, precioUnidad);
        
        let margenSobre = 0;
        let margenCaja = 0;
        let margenSoloSobre = 0;
        let margenSoloCaja = 0;

        // ✅ CORRECTO: Calcular margen para sobre multiplicando por unidades
        if (producto.vender_por_sobre && producto.unidades_por_sobre) {
            const costoSobre = costo * producto.unidades_por_sobre;
            margenSobre = calcularPorcentajeMargen(costoSobre, precioSobre);
        }

        // ✅ CORRECTO: Calcular margen para caja multiplicando por unidades
        if (producto.vender_por_caja && producto.unidades_por_caja) {
            const costoCaja = costo * producto.unidades_por_caja;
            margenCaja = calcularPorcentajeMargen(costoCaja, precioCaja);
        }

        // ✅ CORRECTO: Calcular margen para solo sobre multiplicando por cantidad
        if (producto.venta_exclusiva_sobre && producto.cantidad_solo_sobre) {
            const costoSoloSobre = costo * producto.cantidad_solo_sobre;
            margenSoloSobre = calcularPorcentajeMargen(costoSoloSobre, precioSoloSobre);
        }

        // ✅ CORRECTO: Calcular margen para solo caja multiplicando por cantidad
        if (producto.venta_exclusiva_caja && producto.cantidad_solo_caja) {
            const costoSoloCaja = costo * producto.cantidad_solo_caja;
            margenSoloCaja = calcularPorcentajeMargen(costoSoloCaja, precioSoloCaja);
        }

        setMargenes({
            unidad: margenUnidad,
            sobre: margenSobre,
            caja: margenCaja,
            solo_sobre: margenSoloSobre,
            solo_caja: margenSoloCaja
        });
    };

    // Calcular porcentaje de margen individual
    const calcularPorcentajeMargen = (costo, precio) => {
        if (costo && precio && precio > 0) {
            const margen = ((precio - costo) / precio) * 100;
            return parseFloat(margen.toFixed(2));
        }
        return 0;
    };

    const esEnteroPositivo = (value) => {
        const numero = Number(value);
        return Number.isInteger(numero) && numero > 0;
    };

    const calcularPrecioCompraFinal = (stockActual, precioActual, cantidadNueva, precioNuevo) => {
        const precioAnt = parseFloat(precioActual) || 0;
        const precioNew = parseFloat(precioNuevo) || 0;

        if (precioNew <= 0) {
            return precioAnt;
        }

        if (precioAnt <= 0) {
            return precioNew;
        }

        const promedio = (precioAnt + precioNew) / 2;
        return parseFloat(promedio.toFixed(2));
    };

    const calcularPrecioSugerido = (costo, unidades = 1) => {
        const base = parseFloat(costo) || 0;
        if (base <= 0) return '';
        return parseFloat((base * unidades * 1.2).toFixed(2));
    };

    const calcularSugeridos = (costo, producto) => {
        if (!producto) return;
        setSugeridos({
            precio_unidad_entrada: calcularPrecioSugerido(costo, 1),
            precio_por_sobre_entrada: producto.vender_por_sobre && producto.unidades_por_sobre
                ? calcularPrecioSugerido(costo, producto.unidades_por_sobre)
                : '',
            precio_por_caja_entrada: producto.vender_por_caja && producto.unidades_por_caja
                ? calcularPrecioSugerido(costo, producto.unidades_por_caja)
                : '',
            precio_solo_sobre_entrada: producto.venta_exclusiva_sobre && producto.cantidad_solo_sobre
                ? calcularPrecioSugerido(costo, producto.cantidad_solo_sobre)
                : '',
            precio_solo_caja_entrada: producto.venta_exclusiva_caja && producto.cantidad_solo_caja
                ? calcularPrecioSugerido(costo, producto.cantidad_solo_caja)
                : ''
        });
    };

    // Precio de compra final informativo en tiempo real
    const precioCompraFinal = selectedProduct
        ? calcularPrecioCompraFinal(
            selectedProduct.stock_total,
            selectedProduct.costo_unidad,
            form.cantidad_entrada,
            form.costo_unidad_entrada
        )
        : 0;

    const precioCompraActual = selectedProduct ? selectedProduct.costo_unidad : 0;

    // Manejar cambios en los campos - CORREGIDO para evitar ceros colgando
    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // Limpiar el valor: quitar ceros a la izquierda y manejar vacíos
        let cleanedValue = value;
        if (value === '' || value === '0') {
            cleanedValue = '';
        } else if (value.startsWith('0') && !value.includes('.')) {
            cleanedValue = value.replace(/^0+/, '');
        }
        
        setForm(prev => {
            const newForm = {
                ...prev,
                [name]: name === 'fecha_vencimiento' ? value : cleanedValue
            };
            
            // Recalcular márgenes cuando cambian costos o precios
            if (name.includes('costo') || name.includes('precio')) {
                const costo = name === 'costo_unidad_entrada' ? cleanedValue : prev.costo_unidad_entrada;
                const precioUnidad = name === 'precio_unidad_entrada' ? cleanedValue : prev.precio_unidad_entrada;
                const precioSobre = name === 'precio_por_sobre_entrada' ? cleanedValue : prev.precio_por_sobre_entrada;
                const precioCaja = name === 'precio_por_caja_entrada' ? cleanedValue : prev.precio_por_caja_entrada;
                const precioSoloSobre = name === 'precio_solo_sobre_entrada' ? cleanedValue : prev.precio_solo_sobre_entrada;
                const precioSoloCaja = name === 'precio_solo_caja_entrada' ? cleanedValue : prev.precio_solo_caja_entrada;
                
                calcularTodosLosMargenes(costo, precioUnidad, precioSobre, precioCaja, precioSoloSobre, precioSoloCaja, selectedProduct);
            }

            if (name === 'costo_unidad_entrada' && selectedProduct) {
                calcularSugeridos(cleanedValue, selectedProduct);
            }
            
            return newForm;
        });
    };

    // Calcular total de la entrada
    const calcularTotal = () => {
        const cantidad = parseFloat(form.cantidad_entrada) || 0;
        const costo = parseFloat(form.costo_unidad_entrada) || 0;
        return (cantidad * costo).toFixed(2);
    };

    // Formatear número para mostrar (sin decimales si es entero)
    const formatNumber = (value) => {
        if (!value && value !== 0) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        
        // Si es entero, mostrar sin decimales
        if (num % 1 === 0) {
            return num.toString();
        }
        // Si tiene decimales, mostrar con 2 decimales
        return num.toFixed(2);
    };

    // Registrar entrada
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        
        if (!selectedProduct || !form.cantidad_entrada || !form.costo_unidad_entrada) {
            setMensaje({ tipo: 'error', texto: 'Por favor, complete los campos obligatorios: cantidad y costo.' });
            setIsLoading(false);
            return;
        }

        const cantidadValue = Number(form.cantidad_entrada);
        const costoValue = Number(form.costo_unidad_entrada);

        if (!esEnteroPositivo(cantidadValue)) {
            setMensaje({ tipo: 'error', texto: 'La cantidad debe ser un número entero positivo.' });
            setIsLoading(false);
            return;
        }

        if (!Number.isFinite(costoValue) || costoValue <= 0) {
            setMensaje({ tipo: 'error', texto: 'El costo debe ser un número válido mayor a 0.' });
            setIsLoading(false);
            return;
        }

        try {
            const entradaData = {
                producto_id: selectedProduct.id,
                cantidad_entrada: cantidadValue,
                costo_unidad_entrada: costoValue,
                precio_unidad_entrada: form.precio_unidad_entrada || null,
                precio_por_sobre_entrada: form.precio_por_sobre_entrada || null,
                precio_por_caja_entrada: form.precio_por_caja_entrada || null,
                precio_solo_sobre_entrada: form.precio_solo_sobre_entrada || null,
                precio_solo_caja_entrada: form.precio_solo_caja_entrada || null,
                fecha_vencimiento: form.fecha_vencimiento || null
            };

            const response = await axios.post('http://localhost:3001/api/entradas', entradaData);
            
            setMensaje({ 
                tipo: 'success', 
                texto: `✅ ${response.data.message}` 
            });

            // Limpiar formulario
            setSelectedProduct(null);
            setSearchTerm('');
            setForm({
                cantidad_entrada: '',
                costo_unidad_entrada: '',
                precio_unidad_entrada: '',
                precio_por_sobre_entrada: '',
                precio_por_caja_entrada: '',
                precio_solo_sobre_entrada: '',
                precio_solo_caja_entrada: '',
                fecha_vencimiento: ''
            });
            setMargenes({ unidad: 0, sobre: 0, caja: 0, solo_sobre: 0, solo_caja: 0 });

            // Actualizar estadísticas
            cargarEstadisticas();
            if (showHistorial) cargarHistorial();

        } catch (error) {
            console.error('Error al registrar entrada:', error);
            const mensajeError = error.response?.data?.error || 'Error al registrar la entrada';
            setMensaje({ tipo: 'error', texto: `❌ ${mensajeError}` });
        } finally {
            setIsLoading(false);
        }
    };

    // Cargar historial
    const cargarHistorial = useCallback(async (pagina = 1) => {
        try {
            const params = new URLSearchParams({
                page: pagina,
                limit: 10,
                ...filtros
            });

            const response = await axios.get(`http://localhost:3001/api/entradas/historial?${params}`);
            setHistorial(response.data.entradas);
            setPaginacion(response.data.paginacion);
        } catch (error) {
            console.error('Error al cargar historial:', error);
        }
    }, [filtros]);

    // Cargar estadísticas
    const cargarEstadisticas = async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/entradas/estadisticas');
            setEstadisticas(response.data);
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    };

    useEffect(() => {
        cargarEstadisticas();
    }, []);

    useEffect(() => {
        if (showHistorial) {
            cargarHistorial();
        }
    }, [showHistorial, cargarHistorial]);

    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return '$ 0';
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-ES');
    };

    // Determinar el tipo de producto para mostrar etiquetas
    const getTipoProducto = (producto) => {
        if (producto.venta_exclusiva_sobre) {
            return { 
                tipo: 'exclusivo_sobre', 
                texto: 'EXCLUSIVO SOBRE', 
                unidades: producto.cantidad_solo_sobre,
                color: 'exclusivo'
            };
        }
        if (producto.venta_exclusiva_caja) {
            return { 
                tipo: 'exclusivo_caja', 
                texto: 'EXCLUSIVO CAJA', 
                unidades: producto.cantidad_solo_caja,
                color: 'exclusivo'
            };
        }
        if (producto.vender_por_sobre && producto.vender_por_caja) {
            return { 
                tipo: 'ambos', 
                texto: 'UNIDAD/SOBRE/CAJA',
                color: 'flexible'
            };
        }
        if (producto.vender_por_sobre) {
            return { 
                tipo: 'sobre', 
                texto: 'UNIDAD/SOBRE',
                color: 'flexible'
            };
        }
        if (producto.vender_por_caja) {
            return { 
                tipo: 'caja', 
                texto: 'UNIDAD/CAJA',
                color: 'flexible'
            };
        }
        return { 
            tipo: 'unidad', 
            texto: 'SOLO UNIDAD',
            color: 'simple'
        };
    };

    // Renderizar campos según el modo de venta
    const renderCamposPrecio = () => {
        return (
            <>
                {/* PRECIO UNIDAD - Solo si no es modo exclusivo */}
                {!selectedProduct.venta_exclusiva_sobre && !selectedProduct.venta_exclusiva_caja && (
                    <div className="form-group">
                        <label>Nuevo precio de venta (unidad)</label>
                        <input
                            type="number"
                            step="0.01"
                            name="precio_unidad_entrada"
                            value={formatNumber(form.precio_unidad_entrada)}
                            onChange={handleChange}
                            min="0.01"
                            placeholder={sugeridos.precio_unidad_entrada ? sugeridos.precio_unidad_entrada : formatNumber(selectedProduct.precio_unidad) || "0"}
                        />
                        <div className="margen-display">
                            <span className={`margen-value ${margenes.unidad >= 0 ? 'positive' : 'negative'}`}>
                                {margenes.unidad}%
                            </span>
                            <small>Margen unidad</small>
                        </div>
                        <small className="help-text">
                            Precio anterior: {formatCurrency(selectedProduct.precio_unidad)}
                        </small>
                    </div>
                )}

                {/* PRECIO SOBRE NORMAL - Solo si está habilitado y no es exclusivo */}
                {selectedProduct.vender_por_sobre && !selectedProduct.venta_exclusiva_sobre && (
                    <div className="form-group precio-adicional">
                        <label>Nuevo precio por sobre</label>
                        <input
                            type="number"
                            step="0.01"
                            name="precio_por_sobre_entrada"
                            value={formatNumber(form.precio_por_sobre_entrada)}
                            onChange={handleChange}
                            min="0.01"
                            placeholder={sugeridos.precio_por_sobre_entrada ? sugeridos.precio_por_sobre_entrada : formatNumber(selectedProduct.precio_por_sobre) || "0"}
                        />
                        <div className="margen-display">
                            <span className={`margen-value ${margenes.sobre >= 0 ? 'positive' : 'negative'}`}>
                                {margenes.sobre}%
                            </span>
                            <small>Margen sobre</small>
                        </div>
                        <small className="help-text">
                            {selectedProduct.unidades_por_sobre} unidades por sobre | 
                            Precio anterior: {formatCurrency(selectedProduct.precio_por_sobre)}
                        </small>
                    </div>
                )}

                {/* PRECIO CAJA NORMAL - Solo si está habilitado y no es exclusivo */}
                {selectedProduct.vender_por_caja && !selectedProduct.venta_exclusiva_caja && (
                    <div className="form-group precio-adicional">
                        <label>Nuevo precio por caja</label>
                        <input
                            type="number"
                            step="0.01"
                            name="precio_por_caja_entrada"
                            value={formatNumber(form.precio_por_caja_entrada)}
                            onChange={handleChange}
                            min="0.01"
                            placeholder={sugeridos.precio_por_caja_entrada ? sugeridos.precio_por_caja_entrada : formatNumber(selectedProduct.precio_por_caja) || "0"}
                        />
                        <div className="margen-display">
                            <span className={`margen-value ${margenes.caja >= 0 ? 'positive' : 'negative'}`}>
                                {margenes.caja}%
                            </span>
                            <small>Margen caja</small>
                        </div>
                        <small className="help-text">
                            {selectedProduct.unidades_por_caja} unidades por caja | 
                            Precio anterior: {formatCurrency(selectedProduct.precio_por_caja)}
                        </small>
                    </div>
                )}

                {/* PRECIO SOLO SOBRE - Solo si es modo exclusivo */}
                {selectedProduct.venta_exclusiva_sobre && (
                    <div className="form-group precio-exclusivo">
                        <label>Nuevo precio exclusivo por sobre</label>
                        <input
                            type="number"
                            step="0.01"
                            name="precio_solo_sobre_entrada"
                            value={formatNumber(form.precio_solo_sobre_entrada)}
                            onChange={handleChange}
                            min="0.01"
                            placeholder={sugeridos.precio_solo_sobre_entrada ? sugeridos.precio_solo_sobre_entrada : formatNumber(selectedProduct.precio_solo_sobre) || "0"}
                        />
                        <div className="margen-display">
                            <span className={`margen-value ${margenes.solo_sobre >= 0 ? 'positive' : 'negative'}`}>
                                {margenes.solo_sobre}%
                            </span>
                            <small>Margen exclusivo</small>
                        </div>
                        <small className="help-text">
                            {selectedProduct.cantidad_solo_sobre} unidades por sobre | 
                            Precio anterior: {formatCurrency(selectedProduct.precio_solo_sobre)}
                        </small>
                    </div>
                )}

                {/* PRECIO SOLO CAJA - Solo si es modo exclusivo */}
                {selectedProduct.venta_exclusiva_caja && (
                    <div className="form-group precio-exclusivo">
                        <label>Nuevo precio exclusivo por caja</label>
                        <input
                            type="number"
                            step="0.01"
                            name="precio_solo_caja_entrada"
                            value={formatNumber(form.precio_solo_caja_entrada)}
                            onChange={handleChange}
                            min="0.01"
                            placeholder={sugeridos.precio_solo_caja_entrada ? sugeridos.precio_solo_caja_entrada : formatNumber(selectedProduct.precio_solo_caja) || "0"}
                        />
                        <div className="margen-display">
                            <span className={`margen-value ${margenes.solo_caja >= 0 ? 'positive' : 'negative'}`}>
                                {margenes.solo_caja}%
                            </span>
                            <small>Margen exclusivo</small>
                        </div>
                        <small className="help-text">
                            {selectedProduct.cantidad_solo_caja} unidades por caja | 
                            Precio anterior: {formatCurrency(selectedProduct.precio_solo_caja)}
                        </small>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="entradas-container">
            <h1>📦 Gestión de Entradas de Stock</h1>
            
            {mensaje && (
                <div className={`mensaje ${mensaje.tipo}`}>
                    {mensaje.texto}
                </div>
            )}

            {/* Tarjetas de estadísticas */}
            <div className="estadisticas-grid">
                <div className="estadistica-card">
                    <h3>Total Entradas</h3>
                    <span className="numero">{estadisticas.total_entradas || 0}</span>
                </div>
                <div className="estadistica-card">
                    <h3>Unidades Ingresadas</h3>
                    <span className="numero">{estadisticas.total_unidades || 0}</span>
                </div>
                <div className="estadistica-card">
                    <h3>Total Invertido</h3>
                    <span className="numero">{formatCurrency(estadisticas.total_invertido || 0)}</span>
                </div>
                <div className="estadistica-card">
                    <h3>Productos Diferentes</h3>
                    <span className="numero">{estadisticas.productos_diferentes || 0}</span>
                </div>
            </div>

            {/* Búsqueda y formulario */}
            <div className="form-section">
                <div className="search-container">
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="🔍 Buscar producto por código o nombre..."
                        value={searchTerm}
                        onChange={handleSearch}
                        className="search-input"
                    />
                    {searchResults.length > 0 && (
                        <div className="search-results">
                            {searchResults.map(product => {
                                const tipoInfo = getTipoProducto(product);
                                return (
                                    <div key={product.id} className="search-result">
                                        <div 
                                            className="product-info"
                                            onClick={() => handleSelectProduct(product)}
                                        >
                                            <div className="product-header">
                                                <strong>{product.codigo_producto}</strong> - {product.nombre}
                                                <span className={`product-tag ${tipoInfo.color}`}>
                                                    {tipoInfo.texto}
                                                </span>
                                            </div>
                                            <div className="product-details">
                                                <small>Stock: {product.stock_total} | Costo: {formatCurrency(product.costo_unidad)}</small>
                                                {product.venta_exclusiva_sobre && (
                                                    <small> | Precio Sobre: {formatCurrency(product.precio_solo_sobre)}</small>
                                                )}
                                                {product.venta_exclusiva_caja && (
                                                    <small> | Precio Caja: {formatCurrency(product.precio_solo_caja)}</small>
                                                )}
                                                {!product.venta_exclusiva_sobre && !product.venta_exclusiva_caja && (
                                                    <small> | Precio: {formatCurrency(product.precio_unidad)}</small>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {selectedProduct && (
                    <div className="entrada-form">
                        <div className="form-header">
                            <h2>📝 Registrar Entrada de Stock</h2>
                            <div className="selected-product-info">
                                <strong>{selectedProduct.codigo_producto}</strong> - {selectedProduct.nombre}
                                <span className={`product-tag ${getTipoProducto(selectedProduct).color}`}>
                                    {getTipoProducto(selectedProduct).texto}
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                {/* Información actual del producto */}
                                <div className="form-group info-group">
                                    <label>Información Actual del Producto</label>
                                    <div className="info-display">
                                        <div><strong>Stock actual:</strong> {selectedProduct.stock_total} unidades</div>
                                        <div><strong>Costo actual:</strong> {formatCurrency(selectedProduct.costo_unidad)}</div>
                                        
                                        {/* Mostrar precios según el modo */}
                                        {selectedProduct.venta_exclusiva_sobre && (
                                            <div className="precio-actual exclusivo">
                                                <strong>Precio sobre exclusivo:</strong> {formatCurrency(selectedProduct.precio_solo_sobre)}
                                                <small> ({selectedProduct.cantidad_solo_sobre} unidades) - Margen: {selectedProduct.margen_solo_sobre || 0}%</small>
                                            </div>
                                        )}
                                        
                                        {selectedProduct.venta_exclusiva_caja && (
                                            <div className="precio-actual exclusivo">
                                                <strong>Precio caja exclusivo:</strong> {formatCurrency(selectedProduct.precio_solo_caja)}
                                                <small> ({selectedProduct.cantidad_solo_caja} unidades) - Margen: {selectedProduct.margen_solo_caja || 0}%</small>
                                            </div>
                                        )}
                                        
                                        {!selectedProduct.venta_exclusiva_sobre && !selectedProduct.venta_exclusiva_caja && (
                                            <>
                                                <div><strong>Precio unidad actual:</strong> {formatCurrency(selectedProduct.precio_unidad)}</div>
                                                <div><strong>Margen actual:</strong> {selectedProduct.margen_porcentaje || 0}%</div>
                                                
                                                {selectedProduct.vender_por_sobre && (
                                                    <div className="precio-actual">
                                                        <strong>Precio sobre actual:</strong> {formatCurrency(selectedProduct.precio_por_sobre)}
                                                        <small> ({selectedProduct.unidades_por_sobre} unidades) - Margen: {selectedProduct.margen_sobre || 0}%</small>
                                                    </div>
                                                )}
                                                
                                                {selectedProduct.vender_por_caja && (
                                                    <div className="precio-actual">
                                                        <strong>Precio caja actual:</strong> {formatCurrency(selectedProduct.precio_por_caja)}
                                                        <small> ({selectedProduct.unidades_por_caja} unidades) - Margen: {selectedProduct.margen_caja || 0}%</small>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Campos de entrada PRINCIPALES */}
                                <div className="form-group">
                                    <label>Precio de compra actual</label>
                                    <input
                                        type="text"
                                        value={formatCurrency(precioCompraActual)}
                                        readOnly
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Cantidad de entrada *</label>
                                    <input
                                        type="number"
                                        name="cantidad_entrada"
                                        value={formatNumber(form.cantidad_entrada)}
                                        onChange={handleChange}
                                        min="1"
                                        step="1"
                                        placeholder="0"
                                        required
                                    />
                                    <small className="help-text">
                                        Stock resultante: {selectedProduct.stock_total + (parseInt(form.cantidad_entrada) || 0)} unidades
                                    </small>
                                </div>

                                <div className="form-group">
                                    <label>Precio de compra nuevo *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="costo_unidad_entrada"
                                        value={formatNumber(form.costo_unidad_entrada)}
                                        onChange={handleChange}
                                        min="0.01"
                                        placeholder="0"
                                        required
                                    />
                                    <small className="help-text">
                                        Precio anterior: {formatCurrency(selectedProduct.costo_unidad)}
                                    </small>
                                </div>

                                <div className="form-group">
                                    <label>Fecha de vencimiento</label>
                                    <input
                                        type="date"
                                        name="fecha_vencimiento"
                                        value={form.fecha_vencimiento}
                                        onChange={handleChange}
                                    />
                                    <small className="help-text">
                                        Opcional, agrega la fecha de vencimiento del lote entrante.
                                    </small>
                                </div>

                                <div className="form-group">
                                    <label>Precio de compra final</label>
                                    <input
                                        type="text"
                                        value={formatCurrency(precioCompraFinal)}
                                        readOnly
                                    />
                                    <small className="help-text">
                                        Promedio simple entre precio anterior y nuevo, sin considerar cantidad.
                                    </small>
                                </div>

                                {/* Campos de precio dinámicos según el modo */}
                                {renderCamposPrecio()}
                            </div>

                            {/* Resumen de la entrada - SIN PORCENTAJES */}
                            <div className="resumen-entrada">
                                <h4>📊 Resumen de la Entrada</h4>
                                <div className="resumen-grid">
                                    <div className="resumen-item">
                                        <span>Cantidad:</span>
                                        <strong>{form.cantidad_entrada || 0} unidades</strong>
                                    </div>
                                    <div className="resumen-item">
                                        <span>Costo unitario:</span>
                                        <strong>{formatCurrency(form.costo_unidad_entrada || 0)}</strong>
                                    </div>
                                    
                                    {/* Mostrar precios según el modo en el resumen - SIN PORCENTAJES */}
                                    {!selectedProduct.venta_exclusiva_sobre && !selectedProduct.venta_exclusiva_caja && form.precio_unidad_entrada && (
                                        <div className="resumen-item">
                                            <span>Precio venta unidad:</span>
                                            <strong>{formatCurrency(form.precio_unidad_entrada || 0)}</strong>
                                        </div>
                                    )}
                                    
                                    {selectedProduct.vender_por_sobre && form.precio_por_sobre_entrada && (
                                        <div className="resumen-item">
                                            <span>Precio sobre:</span>
                                            <strong>{formatCurrency(form.precio_por_sobre_entrada || selectedProduct.precio_por_sobre || 0)}</strong>
                                        </div>
                                    )}
                                    
                                    {selectedProduct.vender_por_caja && form.precio_por_caja_entrada && (
                                        <div className="resumen-item">
                                            <span>Precio caja:</span>
                                            <strong>{formatCurrency(form.precio_por_caja_entrada || selectedProduct.precio_por_caja || 0)}</strong>
                                        </div>
                                    )}
                                    
                                    {selectedProduct.venta_exclusiva_sobre && form.precio_solo_sobre_entrada && (
                                        <div className="resumen-item exclusivo">
                                            <span>Precio sobre exclusivo:</span>
                                            <strong>{formatCurrency(form.precio_solo_sobre_entrada || selectedProduct.precio_solo_sobre || 0)}</strong>
                                        </div>
                                    )}
                                    
                                    {selectedProduct.venta_exclusiva_caja && form.precio_solo_caja_entrada && (
                                        <div className="resumen-item exclusivo">
                                            <span>Precio caja exclusivo:</span>
                                            <strong>{formatCurrency(form.precio_solo_caja_entrada || selectedProduct.precio_solo_caja || 0)}</strong>
                                        </div>
                                    )}
                                    
                                    <div className="resumen-item total">
                                        <span>Total inversión:</span>
                                        <strong>{formatCurrency(calcularTotal())}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="button-group">
                                <button 
                                    type="submit" 
                                    className="btn-primary"
                                    disabled={isLoading}
                                >
                                    {isLoading ? '⏳ Procesando...' : '✅ Registrar Entrada'}
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-secondary"
                                    onClick={() => {
                                        setSelectedProduct(null);
                                        setSearchTerm('');
                                        setForm({
                                            cantidad_entrada: '',
                                            costo_unidad_entrada: '',
                                            precio_unidad_entrada: '',
                                            precio_por_sobre_entrada: '',
                                            precio_por_caja_entrada: '',
                                            precio_solo_sobre_entrada: '',
                                            precio_solo_caja_entrada: ''
                                        });
                                        setMargenes({ unidad: 0, sobre: 0, caja: 0, solo_sobre: 0, solo_caja: 0 });
                                    }}
                                    disabled={isLoading}
                                >
                                    ❌ Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* Historial (se mantiene igual) */}
            <div className="historial-toggle">
                <button 
                    onClick={() => setShowHistorial(!showHistorial)}
                    className={`btn-toggle ${showHistorial ? 'active' : ''}`}
                >
                    {showHistorial ? '📋 Ocultar Historial' : '📋 Ver Historial de Entradas'}
                </button>
            </div>

            {showHistorial && (
                <div className="historial-section">
                    <h2>📊 Historial de Entradas</h2>
                    
                    <div className="filtros-historial">
                        <div className="filtro-group">
                            <label>Desde:</label>
                            <input
                                type="date"
                                name="fecha_desde"
                                value={filtros.fecha_desde}
                                onChange={(e) => setFiltros(prev => ({...prev, fecha_desde: e.target.value}))}
                            />
                        </div>
                        <div className="filtro-group">
                            <label>Hasta:</label>
                            <input
                                type="date"
                                name="fecha_hasta"
                                value={filtros.fecha_hasta}
                                onChange={(e) => setFiltros(prev => ({...prev, fecha_hasta: e.target.value}))}
                            />
                        </div>
                        <button 
                            onClick={() => cargarHistorial()}
                            className="btn-primary"
                        >
                            🔍 Aplicar Filtros
                        </button>
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Producto</th>
                                    <th>Cantidad</th>
                                    <th>Costo Unitario</th>
                                    <th>Total</th>
                                    <th>Usuario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map(entrada => (
                                    <tr key={entrada.id}>
                                        <td>{formatDate(entrada.fecha_entrada)}</td>
                                        <td>
                                            <strong>{entrada.codigo_producto}</strong><br/>
                                            {entrada.producto_nombre}
                                        </td>
                                        <td>{entrada.cantidad_entrada}</td>
                                        <td>{formatCurrency(entrada.costo_unidad_entrada)}</td>
                                        <td>{formatCurrency(entrada.cantidad_entrada * entrada.costo_unidad_entrada)}</td>
                                        <td>{entrada.usuario_nombre || 'Sistema'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

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
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntradasStock;