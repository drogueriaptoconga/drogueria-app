import React, { useState } from 'react';
import axios from 'axios';

const CambiarContrasena = ({ onSaved }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        if (newPassword !== confirmation) {
            setError('Las contraseñas nuevas no coinciden.');
            return;
        }
        setIsSaving(true);
        try {
            await axios.post('http://localhost:3001/api/auth/change-password', { currentPassword, newPassword });
            onSaved();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'No se pudo cambiar la contraseña.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <main className="login-page">
            <form className="login-form" onSubmit={handleSubmit}>
                <h1>Cambiar contraseña</h1>
                <label htmlFor="current-password">Contraseña actual</label>
                <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
                <label htmlFor="new-password">Nueva contraseña</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength="12" value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
                <label htmlFor="confirm-password">Confirmar contraseña</label>
                <input id="confirm-password" type="password" autoComplete="new-password" minLength="12" value={confirmation} onChange={event => setConfirmation(event.target.value)} required />
                {error && <p className="login-error" role="alert">{error}</p>}
                <button type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Actualizar contraseña'}</button>
            </form>
        </main>
    );
};

export default CambiarContrasena;