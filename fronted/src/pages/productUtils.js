export const calculateMargin = (costo, precio) => {
    const c = parseFloat(costo);
    const p = parseFloat(precio);
    if (!isNaN(c) && !isNaN(p) && p > 0) {
        return (((p - c) / p) * 100).toFixed(2);
    }
    return '';
};

export const getExpirationStatus = (fechaVencimiento, diasAlerta) => {
    if (!fechaVencimiento) return null;
    
    const today = new Date();
    const vencimiento = new Date(fechaVencimiento);
    today.setHours(0, 0, 0, 0); 
    vencimiento.setHours(0, 0, 0, 0); 
    
    const diffTime = vencimiento.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'expired';
    if (diasAlerta && diffDays <= diasAlerta) return 'warning';
    return 'ok';
};

export const formatDate = (dateString) => {
    if (!dateString) return 'No definida';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
};

export const formatPrice = (price) => {
    const parsedPrice = parseFloat(price);
    return isNaN(parsedPrice) || parsedPrice === 0 ? 'No registrado' : `$${parsedPrice}`;
};

export const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    
    // Si ya está en formato YYYY-MM-DD, devolverlo tal cual
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
    }
    
    // Si viene con timezone, extraer solo la parte de la fecha
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formateando fecha:', error);
        return '';
    }
};

export const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'No definida';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'No definida';
        
        return date.toLocaleDateString('es-ES');
    } catch (error) {
        return 'No definida';
    }
};

export const sanitizeFormData = (data) => {
    const sanitized = { ...data };
    
    // Convertir todos los valores null/undefined a string vacío
    Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === null || sanitized[key] === undefined) {
            sanitized[key] = '';
        }
        
        // Para campos numéricos, si están vacíos convertir a 0
        if ((key.includes('precio') || key.includes('costo') || key.includes('stock') || 
             key.includes('unidades') || key.includes('margen') || key.includes('dias') || 
             key.includes('cantidad')) && sanitized[key] === '') {
            sanitized[key] = 0;
        }
    });
    
    return sanitized;
};