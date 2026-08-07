// Simple auth helper that reads current user from localStorage
export function getCurrentUser() {
    try {
        const raw = window.localStorage.getItem('currentUser');
        if (raw) return JSON.parse(raw);
    } catch (e) {
        // ignore
    }
    // default for backward compatibility in dev
    return { id: 1, role: 'admin' };
}

export function getAuthHeaders() {
    const user = getCurrentUser();
    return {
        'x-user-role': (user.role || '').toString(),
        'x-user-id': (user.id || '').toString()
    };
}
