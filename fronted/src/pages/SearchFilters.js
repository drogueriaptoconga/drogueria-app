import React from 'react';

const SearchFilters = ({
    searchTerm,
    setSearchTerm,
    showLowStock,
    setShowLowStock,
    showExpired,
    setShowExpired,
    showWarning,
    setShowWarning,
    searchRef
}) => {
    return (
        <>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Buscar por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    ref={searchRef}
                />
            </div>
            
            <div className="filter-button-container">
                <button
                    className={showLowStock ? 'active' : ''}
                    onClick={() => {
                        setShowExpired(false);
                        setShowWarning(false);
                        setShowLowStock(!showLowStock);
                        setSearchTerm('');
                    }}
                >
                    {showLowStock ? 'Ver Todos' : 'Stock Bajo'}
                </button>
                
                <button
                    className={showExpired ? 'active' : ''}
                    onClick={() => {
                        setShowLowStock(false);
                        setShowWarning(false);
                        setShowExpired(!showExpired);
                        setSearchTerm('');
                    }}
                >
                    {showExpired ? 'Ver Todos' : 'Vencidos'}
                </button>
                
                <button
                    className={showWarning ? 'active' : ''}
                    onClick={() => {
                        setShowLowStock(false);
                        setShowExpired(false);
                        setShowWarning(!showWarning);
                        setSearchTerm('');
                    }}
                >
                    {showWarning ? 'Ver Todos' : 'Por Vencer'}
                </button>
            </div>
        </>
    );
};

export default SearchFilters;