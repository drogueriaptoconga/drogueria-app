import React from 'react';
import './Productos.css';
import useProductosLogic from './useProductosLogic';
import ProductForm from './ProductForm';
import ProductTable from './ProductTable';
import SearchFilters from './SearchFilters';
import ProductExistsModal from './ProductExistsModal';

const Productos = () => {
    const {
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
        handleCodigoBlur // Nueva función añadida
    } = useProductosLogic();

    return (
        <div className="productos-container">
            <h1>Gestión de Productos</h1>
            
            {/* Modal de producto existente */}
            <ProductExistsModal
                show={productExistsModal.show}
                product={productExistsModal.product}
                context={productExistsModal.context}
                onResponse={handleModalResponse}
                onClose={closeModal}
            />
            
            {/* Mensaje Global */}
            {globalMessage && (
                <div className={`global-message ${globalMessage.type}`}>
                    <span className="message-icon">
                        {globalMessage.type === 'success' && '✅'}
                        {globalMessage.type === 'error' && '❌'}
                        {globalMessage.type === 'warning' && '⚠️'}
                        {globalMessage.type === 'info' && 'ℹ️'}
                    </span>
                    {globalMessage.text}
                </div>
            )}
            
            {/* Loading Overlay */}
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Procesando...</p>
                </div>
            )}
            
            <div className="button-group-top">
                <button 
                    onClick={() => {
                        setShowForm(!showForm);
                        if (!showForm) resetFormState();
                    }}
                    disabled={isLoading}
                >
                    {showForm ? 'Ocultar Formulario' : 'Crear Nuevo Producto'}
                </button>
            </div>

            {showForm && (
                <ProductForm
                    form={form}
                    isEditing={isEditing}
                    formMessage={formMessage}
                    handleChange={handleChange}
                    handleSubmit={handleSubmit}
                    handleClear={handleClear}
                    isLoading={isLoading}
                    handleCodigoBlur={handleCodigoBlur} 
                />
            )}

            <SearchFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showLowStock={showLowStock}
                setShowLowStock={setShowLowStock}
                showExpired={showExpired}
                setShowExpired={setShowExpired}
                showWarning={showWarning}
                setShowWarning={setShowWarning}
                searchRef={searchRef}
                isLoading={isLoading}
            />

            <ProductTable
                productos={productos}
                showLowStock={showLowStock}
                handleEdit={handleEdit}
                handleDelete={handleDelete}
                isLoading={isLoading}
            />
        </div>
    );
};

export default Productos;