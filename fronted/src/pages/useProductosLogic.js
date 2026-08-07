import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { calculateMargin, sanitizeFormData } from './productUtils';

const useProductosLogic = () => {
    const [productos, setProductos] = useState([]);
    const [form, setForm] = useState({
        codigo_producto: '', nombre: '', costo_unidad: '', precio_unidad: '', stock_total: '',
        margen_porcentaje: '', stock_minimo_alerta: '', venta_por_unidad_habilitada: false,
        vender_por_sobre: false, unidades_por_sobre: '', precio_por_sobre: '', margen_sobre: '',
        vender_por_caja: false, unidades_por_caja: '', precio_por_caja: '', margen_caja: '',
        fecha_vencimiento: '', dias_alerta_vencimiento: '',
        venta_exclusiva_sobre: false, cantidad_solo_sobre: '', precio_solo_sobre: '', margen_solo_sobre: '',
        venta_exclusiva_caja: false, cantidad_solo_caja: '', precio_solo_caja: '', margen_solo_caja: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formMessage, setFormMessage] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [showLowStock, setShowLowStock] = useState(false);
    const [showExpired, setShowExpired] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [globalMessage, setGlobalMessage] = useState(null);
    const [productExistsModal, setProductExistsModal] = useState({
        show: false,
        product: null,
        formData: null,
        context: 'create'
    });

    const [autoLoadProduct, setAutoLoadProduct] = useState(null);

    const searchRef = useRef(null);

    // Función para mostrar mensajes globales
    const showGlobalMessage = (message, type = 'success', duration = 5000) => {
        setGlobalMessage({ text: message, type });
        setTimeout(() => setGlobalMessage(null), duration);
    };

    const resetFormState = () => {
        setForm({
            codigo_producto: '', nombre: '', costo_unidad: '', precio_unidad: '', stock_total: '',
            margen_porcentaje: '', stock_minimo_alerta: '', venta_por_unidad_habilitada: false,
            vender_por_sobre: false, unidades_por_sobre: '', precio_por_sobre: '', margen_sobre: '',
            vender_por_caja: false, unidades_por_caja: '', precio_por_caja: '', margen_caja: '',
            fecha_vencimiento: '', dias_alerta_vencimiento: '',
            venta_exclusiva_sobre: false, cantidad_solo_sobre: '', precio_solo_sobre: '', margen_solo_sobre: '',
            venta_exclusiva_caja: false, cantidad_solo_caja: '', precio_solo_caja: '', margen_solo_caja: ''
        });
        setIsEditing(false);
        setCurrentId(null);
        setFormMessage(null);
    };

    const fetchProductos = useCallback(async (term = '', expired = false, warning = false) => {
        try {
            setIsLoading(true);
            let url = `http://localhost:3001/api/productos?search=${encodeURIComponent(term)}`;
            if (expired) url += '&expired=true';
            if (warning) url += '&warning=true';
            if (showLowStock) url += '&lowStock=true';
            
            const response = await axios.get(url);
            const fetchedProductos = response.data;
            setProductos(fetchedProductos);
            
            // Validar si se buscó exactamente un código y se encontró un solo producto
            if (term.trim() !== '' && fetchedProductos.length === 1) {
                const foundProduct = fetchedProductos[0];
                
                // Verificar si la búsqueda es exactamente el código del producto
                if (foundProduct.codigo_producto === term.trim()) {
                    // Mostrar modal para preguntar si quiere editar
                    setProductExistsModal({
                        show: true,
                        product: foundProduct,
                        formData: null,
                        context: 'search'
                    });
                    return;
                }
            }
            
            // Mantener la funcionalidad original de auto-cargar para edición
            if (fetchedProductos.length === 1 && fetchedProductos[0].codigo_producto === term) {
                setAutoLoadProduct(fetchedProductos[0]);
                setSearchTerm('');
                showGlobalMessage(`Producto "${fetchedProductos[0].nombre}" encontrado y cargado para edición`, 'info');
            }
        } catch (error) {
            console.error('❌ Error al obtener productos:', error);
            showGlobalMessage('Error al cargar los productos. Verifica tu conexión.', 'error');
            // ⚠️ No vaciar productos en error
        } finally {
            setIsLoading(false);
        }
    }, [showLowStock]);

    useEffect(() => {
        if (searchRef.current) searchRef.current.focus();
        const handler = setTimeout(() => {
            fetchProductos(searchTerm, showExpired, showWarning);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, showExpired, showWarning, fetchProductos]);

    // Función mejorada para calcular márgenes (memoizada)
    const calculateMargins = useCallback((formData) => {
        const result = { ...formData };
        
        const calcAndFormatMargin = (costo, precio) => {
            const margin = calculateMargin(costo, precio);
            return margin && margin !== '0.00' ? margin + '%' : '';
        };

        result.margen_porcentaje = calcAndFormatMargin(result.costo_unidad, result.precio_unidad);

        if (result.vender_por_sobre && result.unidades_por_sobre && result.costo_unidad && result.precio_por_sobre) {
            const costoSobre = result.costo_unidad * result.unidades_por_sobre;
            result.margen_sobre = calcAndFormatMargin(costoSobre, result.precio_por_sobre);
        } else {
            result.margen_sobre = '';
        }

        if (result.vender_por_caja && result.unidades_por_caja && result.costo_unidad && result.precio_por_caja) {
            const costoCaja = result.costo_unidad * result.unidades_por_caja;
            result.margen_caja = calcAndFormatMargin(costoCaja, result.precio_por_caja);
        } else {
            result.margen_caja = '';
        }

        if (result.venta_exclusiva_sobre) {
            if (result.unidades_por_sobre && result.costo_unidad && result.precio_solo_sobre) {
                const costoSobre = result.costo_unidad * result.unidades_por_sobre;
                result.margen_solo_sobre = calcAndFormatMargin(costoSobre, result.precio_solo_sobre);
            } else {
                result.margen_solo_sobre = calcAndFormatMargin(result.costo_unidad, result.precio_solo_sobre);
            }
        } else {
            result.margen_solo_sobre = '';
        }

        if (result.venta_exclusiva_caja) {
            if (result.unidades_por_caja && result.costo_unidad && result.precio_solo_caja) {
                const costoCaja = result.costo_unidad * result.unidades_por_caja;
                result.margen_solo_caja = calcAndFormatMargin(costoCaja, result.precio_solo_caja);
            } else {
                result.margen_solo_caja = calcAndFormatMargin(result.costo_unidad, result.precio_solo_caja);
            }
        } else {
            result.margen_solo_caja = '';
        }

        return result;
    }, []);

    const validateCodigoExists = async (codigo) => {
        if (!codigo || codigo.trim() === '' || isEditing) return false;

        const normalizedCode = codigo.trim();
        const existingProduct = productos.find(p => p.codigo_producto === normalizedCode);
        if (existingProduct) return existingProduct;

        try {
            const response = await axios.get(`http://localhost:3001/api/productos?search=${encodeURIComponent(normalizedCode)}`);
            return (response.data || []).find(p => p.codigo_producto === normalizedCode) || false;
        } catch (error) {
            console.error('Error al validar código de producto:', error);
            return false;
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newForm = { ...form };

        if (type === 'checkbox') {
            newForm[name] = checked;
            
            if (name === 'venta_exclusiva_sobre' && checked) {
                newForm.venta_exclusiva_caja = false;
                newForm.venta_por_unidad_habilitada = false;
                newForm.vender_por_sobre = false;
                newForm.vender_por_caja = false;
            } else if (name === 'venta_exclusiva_caja' && checked) {
                newForm.venta_exclusiva_sobre = false;
                newForm.venta_por_unidad_habilitada = false;
                newForm.vender_por_sobre = false;
                newForm.vender_por_caja = false;
            } else if ((name === 'venta_por_unidad_habilitada' || name === 'vender_por_sobre' || name === 'vender_por_caja') && checked) {
                newForm.venta_exclusiva_sobre = false;
                newForm.venta_exclusiva_caja = false;
            }
        } else {
            newForm[name] = value;
        }

        newForm = calculateMargins(newForm);
        setForm(newForm);
    };

    const handleCodigoBlur = async (e) => {
        const codigo = e.target.value.trim();
        if (!codigo || isEditing) return;

        const existingProduct = await validateCodigoExists(codigo);
        if (existingProduct) {
            setFormMessage({ type: 'error', text: `El producto con el código "${codigo}" ya existe.` });
            setProductExistsModal({
                show: true,
                product: existingProduct,
                formData: { ...form },
                context: 'blur'
            });
        }
    };

    const handleEdit = useCallback((producto) => {
        const formData = {
            codigo_producto: producto.codigo_producto || '',
            nombre: producto.nombre || '',
            costo_unidad: producto.costo_unidad || '',
            precio_unidad: producto.precio_unidad || '',
            stock_total: producto.stock_total || '',
            margen_porcentaje: producto.margen_porcentaje || '',
            stock_minimo_alerta: producto.stock_minimo_alerta || '',
            venta_por_unidad_habilitada: !!producto.venta_por_unidad_habilitada,
            vender_por_sobre: !!producto.vender_por_sobre,
            unidades_por_sobre: producto.unidades_por_sobre || '',
            precio_por_sobre: producto.precio_por_sobre || '',
            margen_sobre: producto.margen_sobre || '',
            vender_por_caja: !!producto.vender_por_caja,
            unidades_por_caja: producto.unidades_por_caja || '',
            precio_por_caja: producto.precio_por_caja || '',
            margen_caja: producto.margen_caja || '',
            fecha_vencimiento: producto.fecha_vencimiento || '',
            dias_alerta_vencimiento: producto.dias_alerta_vencimiento || '',
            venta_exclusiva_sobre: !!producto.venta_exclusiva_sobre,
            cantidad_solo_sobre: producto.cantidad_solo_sobre || producto.stock_total || '',
            precio_solo_sobre: producto.precio_solo_sobre || '',
            margen_solo_sobre: producto.margen_solo_sobre || '',
            venta_exclusiva_caja: !!producto.venta_exclusiva_caja,
            cantidad_solo_caja: producto.cantidad_solo_caja || producto.stock_total || '',
            precio_solo_caja: producto.precio_solo_caja || '',
            margen_solo_caja: producto.margen_solo_caja || ''
        };

        const formWithMargins = calculateMargins(formData);
        setForm(formWithMargins);
        setIsEditing(true);
        setCurrentId(producto.id);
        setFormMessage(null);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [calculateMargins]);

    useEffect(() => {
        if (autoLoadProduct) {
            handleEdit(autoLoadProduct);
            setAutoLoadProduct(null);
        }
    }, [autoLoadProduct, handleEdit]);

    const handleDelete = async (id, nombre) => {
        const confirmation = window.confirm(`¿Estás seguro de que quieres eliminar el producto "${nombre}"? Esta acción no se puede deshacer.`);
        if (!confirmation) return;
        
        try {
            setIsLoading(true);
            await axios.delete(`http://localhost:3001/api/productos/${id}`);
            await fetchProductos(searchTerm, showExpired, showWarning);
            showGlobalMessage(`Producto "${nombre}" eliminado exitosamente`, 'success');
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            showGlobalMessage(`Error al eliminar el producto "${nombre}". Inténtalo de nuevo.`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // =============================================
    // FUNCIÓN PRINCIPAL PARA GUARDAR PRODUCTO
    // =============================================
    const handleSubmitInternal = async () => {
        // Validaciones básicas
        if (!form.codigo_producto.trim()) {
            setFormMessage({ type: 'error', text: 'El código del producto es obligatorio.' });
            return;
        }

        if (!form.nombre.trim()) {
            setFormMessage({ type: 'error', text: 'El nombre del producto es obligatorio.' });
            return;
        }

        if (!form.costo_unidad || parseFloat(form.costo_unidad) <= 0) {
            setFormMessage({ type: 'error', text: 'El costo debe ser mayor a 0.' });
            return;
        }

        // Validar que tenga al menos una opción de venta habilitada
        const hasAnySaleOption = form.venta_por_unidad_habilitada || form.vender_por_sobre || form.vender_por_caja || form.venta_exclusiva_sobre || form.venta_exclusiva_caja;
        if (!hasAnySaleOption) {
            setFormMessage({ type: 'error', text: 'Debes habilitar al menos una opción de venta.' });
            return;
        }

        // Validaciones específicas por tipo de venta
        if (form.venta_por_unidad_habilitada && (!form.precio_unidad || parseFloat(form.precio_unidad) <= 0)) {
            setFormMessage({ type: 'error', text: 'Debes ingresar un precio válido para venta por unidad.' });
            return;
        }

        if (form.vender_por_sobre && (!form.precio_por_sobre || parseFloat(form.precio_por_sobre) <= 0)) {
            setFormMessage({ type: 'error', text: 'Debes ingresar un precio válido para venta por sobre.' });
            return;
        }

        if (form.vender_por_caja && (!form.precio_por_caja || parseFloat(form.precio_por_caja) <= 0)) {
            setFormMessage({ type: 'error', text: 'Debes ingresar un precio válido para venta por caja.' });
            return;
        }

        if (form.venta_exclusiva_sobre && (!form.precio_solo_sobre || parseFloat(form.precio_solo_sobre) <= 0)) {
            setFormMessage({ type: 'error', text: 'Debes ingresar un precio válido para "Venta Exclusiva por Sobre".' });
            return;
        }

        if (form.venta_exclusiva_caja && (!form.precio_solo_caja || parseFloat(form.precio_solo_caja) <= 0)) {
            setFormMessage({ type: 'error', text: 'Debes ingresar un precio válido para "Venta Exclusiva por Caja".' });
            return;
        }

        setIsLoading(true);
        setFormMessage(null);

        try {
            // ⚠️ CONVERTIR DATOS PARA POSTGRESQL
            const sanitizedForm = {
                codigo_producto: form.codigo_producto.trim(),
                nombre: form.nombre.trim(),
                costo_unidad: parseFloat(form.costo_unidad) || 0,
                precio_unidad: parseFloat(form.precio_unidad) || 0,
                stock_total: parseInt(form.stock_total) || 0,
                margen_porcentaje: form.margen_porcentaje ? parseFloat(form.margen_porcentaje) : null,
                stock_minimo_alerta: form.stock_minimo_alerta ? parseInt(form.stock_minimo_alerta) : null,
                venta_por_unidad_habilitada: !!form.venta_por_unidad_habilitada,
                vender_por_sobre: !!form.vender_por_sobre,
                unidades_por_sobre: form.unidades_por_sobre ? parseInt(form.unidades_por_sobre) : null,
                precio_por_sobre: form.precio_por_sobre ? parseFloat(form.precio_por_sobre) : null,
                margen_sobre: form.margen_sobre ? parseFloat(form.margen_sobre) : null,
                vender_por_caja: !!form.vender_por_caja,
                unidades_por_caja: form.unidades_por_caja ? parseInt(form.unidades_por_caja) : null,
                precio_por_caja: form.precio_por_caja ? parseFloat(form.precio_por_caja) : null,
                margen_caja: form.margen_caja ? parseFloat(form.margen_caja) : null,
                fecha_vencimiento: form.fecha_vencimiento || null,
                dias_alerta_vencimiento: form.dias_alerta_vencimiento ? parseInt(form.dias_alerta_vencimiento) : null,
                venta_exclusiva_sobre: !!form.venta_exclusiva_sobre,
                cantidad_solo_sobre: form.cantidad_solo_sobre ? parseInt(form.cantidad_solo_sobre) : (parseInt(form.stock_total) || 0),
                precio_solo_sobre: form.precio_solo_sobre ? parseFloat(form.precio_solo_sobre) : null,
                margen_solo_sobre: form.margen_solo_sobre ? parseFloat(form.margen_solo_sobre) : null,
                venta_exclusiva_caja: !!form.venta_exclusiva_caja,
                cantidad_solo_caja: form.cantidad_solo_caja ? parseInt(form.cantidad_solo_caja) : (parseInt(form.stock_total) || 0),
                precio_solo_caja: form.precio_solo_caja ? parseFloat(form.precio_solo_caja) : null,
                margen_solo_caja: form.margen_solo_caja ? parseFloat(form.margen_solo_caja) : null
            };

            console.log('📦 Enviando al backend:', sanitizedForm);

            if (isEditing) {
                const response = await axios.put(`http://localhost:3001/api/productos/${currentId}`, sanitizedForm);
                setFormMessage({ type: 'success', text: response.data.message });
                showGlobalMessage(`Producto "${form.nombre}" actualizado exitosamente`, 'success');
                setShowForm(false);
                setSearchTerm('');
                await fetchProductos('', showExpired, showWarning);
                if (searchRef.current) searchRef.current.focus();
            } else {
                const response = await axios.post('http://localhost:3001/api/productos', sanitizedForm);
                setFormMessage({ type: 'success', text: response.data.message });
                showGlobalMessage(`Producto "${form.nombre}" creado exitosamente`, 'success');
                await fetchProductos(searchTerm, showExpired, showWarning);
                
                const continueAdding = window.confirm("¡Producto guardado exitosamente! ¿Quieres agregar otro producto?");
                if (continueAdding) {
                    resetFormState();
                    showGlobalMessage('Puedes agregar un nuevo producto', 'info');
                } else {
                    resetFormState();
                    setShowForm(false);
                    if (searchRef.current) searchRef.current.focus();
                }
            }
        } catch (error) {
            console.error('❌ Error al guardar producto:', error);
            let errorMessage = 'Error al guardar el producto. Inténtalo de nuevo.';
            
            if (error.response) {
                console.error('❌ Detalles del error:', error.response.data);
                if (error.response.status === 409) {
                    errorMessage = 'Ya existe un producto con ese código. Usa un código diferente.';
                } else if (error.response.data && error.response.data.error) {
                    errorMessage = error.response.data.error;
                    if (error.response.data.detalle) {
                        errorMessage += ` (${error.response.data.detalle})`;
                    }
                }
            }
            
            setFormMessage({ type: 'error', text: errorMessage });
            showGlobalMessage(errorMessage, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Función principal de submit con validación de producto existente
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isEditing) {
            await handleSubmitInternal();
            return;
        }
        
        const existingProduct = await validateCodigoExists(form.codigo_producto);
        
        if (existingProduct) {
            setFormMessage({ type: 'error', text: `El producto con el código "${form.codigo_producto}" ya existe.` });
            setProductExistsModal({
                show: true,
                product: existingProduct,
                formData: { ...form },
                context: 'create'
            });
        } else {
            await handleSubmitInternal();
        }
    };

    const handleClear = () => {
        resetFormState();
        setShowForm(false);
        showGlobalMessage('Formulario cancelado', 'info');
        if (searchRef.current) searchRef.current.focus();
    };

    const handleModalResponse = async (response) => {
        const modalContext = productExistsModal.context;
        
        if (response === 'modify') {
            handleEdit(productExistsModal.product);
        } else if (response === 'create' && (modalContext === 'create' || modalContext === 'blur')) {
            await handleSubmitInternal();
        } else if (response === 'cancel') {
            if (modalContext === 'search') {
                setSearchTerm('');
                if (searchRef.current) searchRef.current.focus();
            } else if (modalContext === 'create' || modalContext === 'blur') {
                setForm(prev => ({
                    ...prev,
                    codigo_producto: ''
                }));
                setTimeout(() => {
                    const codigoInput = document.getElementById('codigo_producto');
                    if (codigoInput) codigoInput.focus();
                }, 100);
            }
        }
        
        setProductExistsModal({
            show: false,
            product: null,
            formData: null,
            context: 'create'
        });
    };

    const closeModal = () => {
        setProductExistsModal({
            show: false,
            product: null,
            formData: null,
            context: 'create'
        });
    };

    return {
        productos,
        searchTerm,
        setSearchTerm,
        showLowStock,
        setShowLowStock,
        showExpired,
        setShowExpired,
        showWarning,
        setShowWarning,
        form,
        isEditing,
        formMessage,
        showForm,
        setShowForm,
        handleChange,
        handleSubmit,
        handleEdit,
        handleDelete,
        handleClear,
        resetFormState,
        searchRef,
        isLoading,
        globalMessage,
        productExistsModal,
        handleModalResponse,
        closeModal,
        handleCodigoBlur,
        validateCodigoExists
    };
};

export default useProductosLogic;