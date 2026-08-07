import React from 'react';
import './ProductExistsModal.css';

const ProductExistsModal = ({ 
    show, 
    product, 
    context = 'create',
    onResponse,
    onClose 
}) => {
    if (!show || !product) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>⚠️ Producto Ya Existe</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    <p>
                        El producto con código <strong>{product.codigo_producto}</strong> 
                        ya existe en el sistema:
                    </p>
                    
                    <div className="product-details">
                        <div className="detail-row">
                            <span className="detail-label">Nombre:</span>
                            <span className="detail-value">{product.nombre}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Stock Actual:</span>
                            <span className="detail-value">{product.stock_total}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Precio Unitario:</span>
                            <span className="detail-value">${product.precio_unidad}</span>
                        </div>
                        {product.categoria && (
                            <div className="detail-row">
                                <span className="detail-label">Categoría:</span>
                                <span className="detail-value">{product.categoria}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="modal-question">
                        <p>
                            {context === 'search' 
                                ? '¿Quieres editar este producto?' 
                                : '¿Qué quieres hacer?'}
                        </p>
                    </div>
                </div>
                
                <div className="modal-footer">
                    <button 
                        className="modal-btn modal-btn-modify"
                        onClick={() => onResponse('modify')}
                    >
                        ✏️ Editar Producto Existente
                    </button>
                    
                    {context === 'create' && (
                        <button 
                            className="modal-btn modal-btn-create"
                            onClick={() => onResponse('create')}
                        >
                            🆕 Crear Nuevo (Sobrescribir)
                        </button>
                    )}
                    
                    <button 
                        className="modal-btn modal-btn-cancel"
                        onClick={() => onResponse('cancel')}
                    >
                        {context === 'search' ? '❌ Cancelar y Buscar Otro' : '❌ Cancelar y Cambiar Código'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductExistsModal;