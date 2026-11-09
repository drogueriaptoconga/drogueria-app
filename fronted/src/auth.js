import axios from 'axios';

if (axios.interceptors?.request?.use) {
    axios.interceptors.request.use((config) => {
        const token = window.localStorage.getItem('authToken');
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });
}

export function getCurrentUser() {
    try {
        const raw = window.localStorage.getItem('currentUser');
        if (raw) return JSON.parse(raw);
    } catch (error) {
        window.localStorage.removeItem('currentUser');
    }
    return null;
}

export function getAuthToken() {
    return window.localStorage.getItem('authToken');
}

export function saveAuthSession(token, user) {
    window.localStorage.setItem('authToken', token);
    window.localStorage.setItem('currentUser', JSON.stringify(user));
}

export function clearAuthSession() {
    window.localStorage.removeItem('authToken');
    window.localStorage.removeItem('currentUser');
}

export function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
