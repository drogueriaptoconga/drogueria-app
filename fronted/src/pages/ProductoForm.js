// src/components/ProductoForm.js
import React from 'react';
import axios from 'axios';

const ProductoForm = ({ form, setForm, isEditing, currentId, setFormMessage, fetchProductos, handleClear }) => {

    const calculateMargin = (costo, precio) => {
        const c = parseFloat(costo);
        const p = parseFloat(precio);
        if (!isNaN(c) && !isNaN(p) && c > 0) {
            return (((p - c) / c) * 100).toFixed(2);
        }
        return '';
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newForm = { ...form };

        if (type === 'checkbox') {
            newForm[name] = checked;
        } else {
            newForm[name] = value;
        }

        let basePrice = '';
        if (newForm.venta_por_unidad_habilitada) {
            basePrice = newForm.precio_unidad;
        } else if (newForm.vender_por_sobre) {
            basePrice = newForm.precio_por_sobre;
        } else if (newForm.vender_por_caja) {
            basePrice = newForm.precio_por_caja;
        }

        newForm.margen_porcentaje = calculateMargin(newForm.costo_unidad, basePrice);
        setForm(newForm);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.venta_por_unidad_habilitada && !form.vender_por_sobre && !form.vender_por_caja) {
            setFormMessage({ type: 'error', text: 'Debes habilitar al menos una opción de venta.' });
            return;
        }

        try {
            if (isEditing) {
                const response = await axios.put(`http://localhost:3001/api/productos/${currentId}`, form);
                setFormMessage({ type: 'success', text: response.data.message });
            } else {
                const response = await axios.post('http://localhost:3001/api/productos', form);
                setFormMessage({ type: 'success', text: response.data.message });
            }
            fetchProductos();
            handleClear();
        } catch (error) {
            console.error('Error al guardar producto:', error);
            if (error.response && error.response.status === 409) {
                setFormMessage({ type: 'error', text: error.response.data.error });
            } else {
                setFormMessage({ type: 'error', text: 'Error al guardar el producto. Inténtalo de nuevo.' });
            }
        }
    };

    return (
        <div className="form-overlay">
            <div className="form-container">
                <h2>{isEditing ? 'Editar Producto' : 'Crear Nuevo Producto'}</h2>
                {/* Agrega esta línea para el mensaje del formulario */}
                {form.formMessage && (
                    <div className={`message ${form.formMessage.type}`}>
                        {form.formMessage.text}
                    </div>
                )}
                {/* Aquí está todo el HTML del formulario que te faltó */}
                <form onSubmit={handleSubmit}>
                    <div className="form-field-row">
                        <div className="form-field">
                            <label htmlFor="codigo_producto">Código:</label>
                            <input id="codigo_producto" type="text" name="codigo_producto" value={form.codigo_producto} onChange={handleChange} required />
                        </div>
                        <div className="form-field">
                            <label htmlFor="nombre">Nombre:</label>
                            <input id="nombre" type="text" name="nombre" value={form.nombre} onChange={handleChange} required />
                        </div>
                        <div className="form-field">
                            <label htmlFor="stock_total">Stock Inicial:</label>
                            <input id="stock_total" type="number" name="stock_total" value={form.stock_total} onChange={handleChange} required />
                        </div>
                        <div className="form-field">
                            <label htmlFor="stock_minimo_alerta">Stock Mínimo:</label>
                            <input id="stock_minimo_alerta" type="number" name="stock_minimo_alerta" value={form.stock_minimo_alerta} onChange={handleChange} />
                        </div>
                        <div className="form-field">
                            <label htmlFor="costo_unidad">Costo por Unidad:</label>
                            <input id="costo_unidad" type="number" step="0.01" name="costo_unidad" value={form.costo_unidad} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="form-field margen-small">
                        <label htmlFor="margen_porcentaje">Margen de Ganancia (%):</label>
                        <input id="margen_porcentaje" type="number" step="0.01" name="margen_porcentaje" value={form.margen_porcentaje} readOnly />
                    </div>
                    
                    <hr/>
                    
                    <div className="form-section">
                        <div className="checkbox-field">
                            <input type="checkbox" name="venta_por_unidad_habilitada" checked={form.venta_por_unidad_habilitada} onChange={handleChange} />
                            <span>**Venta por unidad**</span>
                        </div>
                        {form.venta_por_unidad_habilitada && (
                            <div className="form-field-row sub-fields">
                                <div className="form-field">
                                    <label htmlFor="precio_unidad">Precio por Unidad:</label>
                                    <input id="precio_unidad" type="number" step="0.01" name="precio_unidad" value={form.precio_unidad} onChange={handleChange} />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <hr/>
                    
                    <div className="form-section">
                        <div className="checkbox-field">
                            <input type="checkbox" name="vender_por_sobre" checked={form.vender_por_sobre} onChange={handleChange} />
                            <span>**Vender por sobre**</span>
                        </div>
                        {form.vender_por_sobre && (
                            <div className="form-field-row sub-fields">
                                <div className="form-field">
                                    <label htmlFor="unidades_por_sobre">Unidades por sobre:</label>
                                    <input id="unidades_por_sobre" type="number" name="unidades_por_sobre" value={form.unidades_por_sobre} onChange={handleChange} />
                                </div>
                                <div className="form-field">
                                    <label htmlFor="precio_por_sobre">Precio por unidad en sobre:</label>
                                    <input id="precio_por_sobre" type="number" step="0.01" name="precio_por_sobre" value={form.precio_por_sobre} onChange={handleChange} />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <hr/>
                    
                    <div className="form-section">
                        <div className="checkbox-field">
                            <input type="checkbox" name="vender_por_caja" checked={form.vender_por_caja} onChange={handleChange} />
                            <span>**Vender por caja**</span>
                        </div>
                        {form.vender_por_caja && (
                            <div className="form-field-row sub-fields">
                                <div className="form-field">
                                    <label htmlFor="unidades_por_caja">Unidades por caja:</label>
                                    <input id="unidades_por_caja" type="number" name="unidades_por_caja" value={form.unidades_por_caja} onChange={handleChange} />
                                </div>
                                <div className="form-field">
                                    <label htmlFor="precio_por_caja">Precio por unidad en caja:</label>
                                    <input id="precio_por_caja" type="number" step="0.01" name="precio_por_caja" value={form.precio_por_caja} onChange={handleChange} />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="button-group">
                        <button type="submit">{isEditing ? 'Actualizar Producto' : 'Guardar Producto'}</button>
                        <button type="button" className="cancel-button" onClick={handleClear}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductoForm;