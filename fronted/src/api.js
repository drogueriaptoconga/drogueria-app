// URL base del backend. Se puede sobreescribir con la variable de entorno
// REACT_APP_API_URL (ej. en Vercel o en otra máquina).
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default API_BASE;