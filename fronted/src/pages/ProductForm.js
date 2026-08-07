import React from 'react';
import { formatDateForInput } from './productUtils';

const ProductForm = ({ form, isEditing, formMessage, handleChange, handleSubmit, handleClear, isLoading, handleCodigoBlur }) => {
    // Determinar el modo actual basado en las selecciones
    const isExclusiveMode = form.venta_exclusiva_sobre || form.venta_exclusiva_caja;
    const isNormalMode = form.venta_por_unidad_habilitada || form.vender_por_sobre || form.vender_por_caja;

    return (
        <div className="form-overlay">
            <div className="form-container">
                <h2>{isEditing ? 'Editar Producto' : 'Crear Nuevo Producto'}</h2>
                
                {formMessage && (
                    <div className={`message ${formMessage.type}`}>
                        {formMessage.text}
                    </div>
                )}

                {/* INDICADOR DE MODO ACTIVO */}
                {isExclusiveMode && (
                    <div className="mode-indicator exclusive-mode">
                        🚫 <strong>MODO EXCLUSIVO ACTIVADO</strong> - Solo una opción de venta disponible
                    </div>
                )}
                {isNormalMode && !isExclusiveMode && (
                    <div className="mode-indicator normal-mode">
                        🔄 <strong>MODO FLEXIBLE</strong> - Múltiples opciones de venta disponibles
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    
                    {/* 1. INFORMACIÓN BÁSICA */}
                    <div className="form-section">
                        <h3>📋 Información Básica</h3>
                        <div className="form-field-row">
                            <div className="form-field">
                                <label htmlFor="codigo_producto">Código del Producto:</label>
                                <input 
                                    id="codigo_producto" 
                                    type="text" 
                                    name="codigo_producto" 
                                    value={form.codigo_producto} 
                                    onChange={handleChange} 
                                    onBlur={handleCodigoBlur} 
                                    required 
                                    disabled={isLoading}
                                    placeholder="Ej: 123456789"
                                />
                                <small className="field-hint">
                                    Al salir del campo, se verificará si ya existe
                                </small>
                            </div>
                            <div className="form-field">
                                <label htmlFor="nombre">Nombre del Producto:</label>
                                <input 
                                    id="nombre" 
                                    type="text" 
                                    name="nombre" 
                                    value={form.nombre} 
                                    onChange={handleChange} 
                                    required 
                                    disabled={isLoading}
                                    placeholder="Ej: Arroz Integral"
                                />
                            </div>
                        </div>
                    </div>

                    <hr/>

                    {/* 2. COSTO Y STOCK - AGRUPADOS */}
                    <div className="form-section">
                        <h3>💰 Costo y Gestión de Stock</h3>
                        <div className="form-field-row">
                            <div className="form-field">
                                <label htmlFor="costo_unidad">
                                    {isExclusiveMode ? 'Costo Base (Referencia):' : 'Costo:'}
                                </label>
                                <input 
                                    id="costo_unidad" 
                                    type="number" 
                                    step="0.01" 
                                    name="costo_unidad" 
                                    value={form.costo_unidad} 
                                    onChange={handleChange} 
                                    required 
                                    disabled={isLoading}
                                    placeholder="0.00"
                                />
                                {isExclusiveMode && (
                                    <small className="field-hint">
                                        Costo de referencia para calcular márgenes
                                    </small>
                                )}
                            </div>
                            <div className="form-field">
                                <label htmlFor="stock_total">Stock Actual:</label>
                                <input 
                                    id="stock_total" 
                                    type="number" 
                                    name="stock_total" 
                                    value={form.stock_total} 
                                    onChange={handleChange} 
                                    required 
                                    disabled={isLoading}
                                    placeholder="Ej: 100"
                                />
                            </div>
                            <div className="form-field">
                                <label htmlFor="stock_minimo_alerta">Stock Mínimo Alerta:</label>
                                <input 
                                    id="stock_minimo_alerta" 
                                    type="number" 
                                    name="stock_minimo_alerta" 
                                    value={form.stock_minimo_alerta} 
                                    onChange={handleChange} 
                                    disabled={isLoading}
                                    placeholder="Ej: 5"
                                />
                                <small className="field-hint">
                                    Alerta cuando el stock llegue a este nivel
                                </small>
                            </div>
                        </div>
                    </div>

                    <hr/>

                    {/* 3. MODO DE VENTA - REORGANIZADO (FLEXIBLE PRIMERO) */}
                    <div className="form-section">
                        <h3>🛒 Modo de Venta</h3>
                        
                        {/* OPCIONES FLEXIBLES - PRIMERO (MÁS COMÚN) */}
                        <div className="mode-section flexible-section">
                            <h4>🔄 Venta Flexible (Múltiples opciones)</h4>
                            
                            {/* Venta por Unidad */}
                            <div className="form-subsection">
                                <div className="checkbox-field">
                                    <input 
                                        type="checkbox" 
                                        name="venta_por_unidad_habilitada" 
                                        checked={form.venta_por_unidad_habilitada} 
                                        onChange={handleChange}
                                        disabled={isExclusiveMode || isLoading}
                                    />
                                    <span>Venta por Unidad</span>
                                </div>
                                {form.venta_por_unidad_habilitada && (
                                    <div className="form-field-row sub-fields">
                                        <div className="form-field">
                                            <label htmlFor="precio_unidad">Precio por Unidad:</label>
                                            <input 
                                                id="precio_unidad" 
                                                type="number" 
                                                step="0.01" 
                                                name="precio_unidad" 
                                                value={form.precio_unidad} 
                                                onChange={handleChange} 
                                                disabled={isLoading}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="form-field margen-small">
                                            <label>Margen (%):</label>
                                            <input 
                                                type="text" 
                                                name="margen_porcentaje" 
                                                value={form.margen_porcentaje} 
                                                readOnly 
                                                className="margen-field"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Vender por Sobre */}
                            <div className="form-subsection">
                                <div className="checkbox-field">
                                    <input 
                                        type="checkbox" 
                                        name="vender_por_sobre" 
                                        checked={form.vender_por_sobre} 
                                        onChange={handleChange}
                                        disabled={isExclusiveMode || isLoading}
                                    />
                                    <span>Vender por Sobre</span>
                                </div>
                                {form.vender_por_sobre && (
                                    <div className="form-field-row sub-fields">
                                        <div className="form-field">
                                            <label htmlFor="unidades_por_sobre">Unidades por Sobre:</label>
                                            <input 
                                                id="unidades_por_sobre" 
                                                type="number" 
                                                name="unidades_por_sobre" 
                                                value={form.unidades_por_sobre} 
                                                onChange={handleChange} 
                                                disabled={isLoading}
                                                placeholder="Ej: 10"
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label htmlFor="precio_por_sobre">Precio del Sobre:</label>
                                            <input 
                                                id="precio_por_sobre" 
                                                type="number" 
                                                step="0.01" 
                                                name="precio_por_sobre" 
                                                value={form.precio_por_sobre} 
                                                onChange={handleChange} 
                                                disabled={isLoading}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="form-field margen-small">
                                            <label>Margen (%):</label>
                                            <input 
                                                type="text" 
                                                name="margen_sobre" 
                                                value={form.margen_sobre} 
                                                readOnly 
                                                className="margen-field"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Vender por Caja */}
                            <div className="form-subsection">
                                <div className="checkbox-field">
                                    <input 
                                        type="checkbox" 
                                        name="vender_por_caja" 
                                        checked={form.vender_por_caja} 
                                        onChange={handleChange}
                                        disabled={isExclusiveMode || isLoading}
                                    />
                                    <span>Vender por Caja</span>
                                </div>
                                {form.vender_por_caja && (
                                    <div className="form-field-row sub-fields">
                                        <div className="form-field">
                                            <label htmlFor="unidades_por_caja">Unidades por Caja:</label>
                                            <input 
                                                id="unidades_por_caja" 
                                                type="number" 
                                                name="unidades_por_caja" 
                                                value={form.unidades_por_caja} 
                                                onChange={handleChange} 
                                                disabled={isLoading}
                                                placeholder="Ej: 24"
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label htmlFor="precio_por_caja">Precio de la Caja:</label>
                                            <input 
                                                id="precio_por_caja" 
                                                type="number" 
                                                step="0.01" 
                                                name="precio_por_caja" 
                                                value={form.precio_por_caja} 
                                                onChange={handleChange} 
                                                disabled={isLoading}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="form-field margen-small">
                                            <label>Margen (%):</label>
                                            <input 
                                                type="text" 
                                                name="margen_caja" 
                                                value={form.margen_caja} 
                                                readOnly 
                                                className="margen-field"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SEPARADOR VISUAL */}
                        <div className="mode-divider">
                            <span>O</span>
                        </div>

                        {/* OPCIONES EXCLUSIVAS - SEGUNDO (MENOS COMÚN) */}
                        <div className="mode-section exclusive-section">
                            <h4>🚫 Venta Exclusiva (Solo una opción)</h4>
                            
                            {/* Solo Sobre Exclusivo */}
                            <div className="form-subsection exclusive-option">
                                <div className="checkbox-field exclusive-checkbox">
                                    <input 
                                        type="checkbox" 
                                        name="venta_exclusiva_sobre" 
                                        checked={form.venta_exclusiva_sobre} 
                                        onChange={handleChange}
                                        disabled={isNormalMode || isLoading}
                                    />
                                    <span>
                                        <strong>Venta Exclusiva por Sobre</strong>
                                        <br/>
                                        <small>El producto solo se vende en presentación de sobre (1 sobre = 1 unidad)</small>
                                    </span>
                                </div>
                                {form.venta_exclusiva_sobre && (
                                    <div className="exclusive-fields">
                                        <div className="form-field-row">
                                            <div className="form-field">
                                                <label>Stock Disponible (Sobres):</label>
                                                <input 
                                                    type="text" 
                                                    value={form.stock_total || ''} 
                                                    readOnly 
                                                    className="readonly-field"
                                                />
                                                <small className="field-hint">
                                                    Cada sobre = 1 unidad
                                                </small>
                                            </div>
                                            <div className="form-field">
                                                <label htmlFor="precio_solo_sobre">Precio por Sobre:</label>
                                                <input 
                                                    id="precio_solo_sobre" 
                                                    type="number" 
                                                    step="0.01" 
                                                    name="precio_solo_sobre" 
                                                    value={form.precio_solo_sobre} 
                                                    onChange={handleChange} 
                                                    required 
                                                    disabled={isLoading}
                                                    placeholder="Precio de venta por sobre"
                                                />
                                            </div>
                                            <div className="form-field margen-small">
                                                <label>Margen (%):</label>
                                                <input 
                                                    type="text" 
                                                    name="margen_solo_sobre" 
                                                    value={form.margen_solo_sobre} 
                                                    readOnly 
                                                    className="margen-field"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Solo Caja Exclusivo */}
                            <div className="form-subsection exclusive-option">
                                <div className="checkbox-field exclusive-checkbox">
                                    <input 
                                        type="checkbox" 
                                        name="venta_exclusiva_caja" 
                                        checked={form.venta_exclusiva_caja} 
                                        onChange={handleChange}
                                        disabled={isNormalMode || isLoading}
                                    />
                                    <span>
                                        <strong>Venta Exclusiva por Caja</strong>
                                        <br/>
                                        <small>El producto solo se vende en presentación de caja (1 caja = 1 unidad)</small>
                                    </span>
                                </div>
                                {form.venta_exclusiva_caja && (
                                    <div className="exclusive-fields">
                                        <div className="form-field-row">
                                            <div className="form-field">
                                                <label>Stock Disponible (Cajas):</label>
                                                <input 
                                                    type="text" 
                                                    value={form.stock_total || ''} 
                                                    readOnly 
                                                    className="readonly-field"
                                                />
                                                <small className="field-hint">
                                                    Cada caja = 1 unidad
                                                </small>
                                            </div>
                                            <div className="form-field">
                                                <label htmlFor="precio_solo_caja">Precio por Caja:</label>
                                                <input 
                                                    id="precio_solo_caja" 
                                                    type="number" 
                                                    step="0.01" 
                                                    name="precio_solo_caja" 
                                                    value={form.precio_solo_caja} 
                                                    onChange={handleChange} 
                                                    required 
                                                    disabled={isLoading}
                                                    placeholder="Precio de venta por caja"
                                                />
                                            </div>
                                            <div className="form-field margen-small">
                                                <label>Margen (%):</label>
                                                <input 
                                                    type="text" 
                                                    name="margen_solo_caja" 
                                                    value={form.margen_solo_caja} 
                                                    readOnly 
                                                    className="margen-field"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <hr/>

                    {/* 4. FECHA DE VENCIMIENTO */}
                    <div className="form-section">
                        <h3>📅 Fecha de Vencimiento</h3>
                        <div className="form-field-row">
                            <div className="form-field">
                                <label htmlFor="fecha_vencimiento">Fecha de Vencimiento:</label>
                                <input 
                                    id="fecha_vencimiento" 
                                    type="date" 
                                    name="fecha_vencimiento" 
                                    value={formatDateForInput(form.fecha_vencimiento)} 
                                    onChange={handleChange} 
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="form-field">
                                <label htmlFor="dias_alerta_vencimiento">Días de Alerta:</label>
                                <input 
                                    id="dias_alerta_vencimiento" 
                                    type="number" 
                                    name="dias_alerta_vencimiento" 
                                    value={form.dias_alerta_vencimiento} 
                                    onChange={handleChange} 
                                    placeholder="Días antes para alertar" 
                                    disabled={isLoading}
                                />
                                <small className="field-hint">
                                    Ej: 7 (alertará 7 días antes del vencimiento)
                                </small>
                            </div>
                        </div>
                    </div>
                            
                    <div className="button-group">
                        <button type="submit" disabled={isLoading}>
                            {isLoading ? 'Procesando...' : (isEditing ? 'Actualizar Producto' : 'Guardar Producto')}
                        </button>
                        <button type="button" className="cancel-button" onClick={handleClear} disabled={isLoading}>
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductForm;