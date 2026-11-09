import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import './Usuarios.css';

const Usuarios = () => {
    const [users, setUsers] = useState([]);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [resetUser, setResetUser] = useState(null);
    const [resetPassword, setResetPassword] = useState('');
    const [renameUser, setRenameUser] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const loadUsers = useCallback(async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/usuarios');
            setUsers(response.data);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'No se pudieron cargar las cuentas.');
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const createSeller = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        setIsSaving(true);
        try {
            await axios.post('http://localhost:3001/api/usuarios', { username, password });
            setUsername('');
            setPassword('');
            setMessage('Vendedor creado. Deberá cambiar la contraseña al iniciar sesión.');
            await loadUsers();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'No se pudo crear el vendedor.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (user) => {
        setError('');
        setMessage('');
        try {
            await axios.patch(`http://localhost:3001/api/usuarios/${user.id}/active`, { active: !user.activo });
            await loadUsers();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'No se pudo actualizar la cuenta.');
        }
    };

    const resetSellerPassword = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        try {
            await axios.patch(`http://localhost:3001/api/usuarios/${resetUser.id}/password`, { password: resetPassword });
            setMessage(`Contraseña restablecida para ${resetUser.nombre_usuario}; deberá cambiarla al iniciar sesión.`);
            setResetUser(null);
            setResetPassword('');
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'No se pudo restablecer la contraseña.');
        }
    };

    const renameSeller = async (event) => {
        event.preventDefault();
        setError('');
        setMessage('');
        try {
            const { data } = await axios.patch(`http://localhost:3001/api/usuarios/${renameUser.id}/username`, { username: renameValue });
            setMessage(`Nombre actualizado a ${data.nombre_usuario}.`);
            setRenameUser(null);
            setRenameValue('');
            await loadUsers();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'No se pudo cambiar el nombre del vendedor.');
        }
    };

    return (
        <section className="users-page">
            <h1>Usuarios</h1>
            <form className="users-form" onSubmit={createSeller}>
                <h2>Crear vendedor</h2>
                <label htmlFor="seller-username">Nombre de usuario</label>
                <input id="seller-username" autoComplete="off" minLength="3" maxLength="40" value={username} onChange={event => setUsername(event.target.value)} required />
                <label htmlFor="seller-password">Contraseña inicial</label>
                <input id="seller-password" type="password" autoComplete="new-password" minLength="12" maxLength="128" value={password} onChange={event => setPassword(event.target.value)} required />
                <p>La contraseña debe tener al menos 12 caracteres y se solicitará cambiarla en el primer ingreso.</p>
                {error && <p className="users-error" role="alert">{error}</p>}
                {message && <p className="users-message" role="status">{message}</p>}
                <button type="submit" disabled={isSaving}>{isSaving ? 'Creando...' : 'Crear vendedor'}</button>
            </form>
            <div className="users-list">
                <h2>Cuentas existentes</h2>
                <table>
                    <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>{user.nombre_usuario}</td>
                                <td>{user.rol === 'admin' ? 'Administrador' : 'Vendedor'}</td>
                                <td>{user.activo ? 'Activo' : 'Inactivo'}</td>
                                <td>
                                    {user.rol === 'vendedor' && (
                                        <>
                                            <button type="button" onClick={() => toggleActive(user)}>{user.activo ? 'Desactivar' : 'Activar'}</button>{' '}
                                            <button type="button" onClick={() => { setResetUser(user); setResetPassword(''); setRenameUser(null); }}>Restablecer clave</button>{' '}
                                            <button type="button" onClick={() => { setRenameUser(user); setRenameValue(user.nombre_usuario); setResetUser(null); }}>Cambiar nombre</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {renameUser && (
                <form className="users-form" onSubmit={renameSeller}>
                    <h2>Cambiar nombre de {renameUser.nombre_usuario}</h2>
                    <label htmlFor="rename-seller-username">Nuevo nombre de usuario</label>
                    <input id="rename-seller-username" autoComplete="off" minLength="3" maxLength="40" value={renameValue} onChange={event => setRenameValue(event.target.value)} required />
                    <p>Entre 3 y 40 caracteres: letras, números, punto, guion o guion bajo.</p>
                    <button type="submit">Guardar nombre</button>
                    <button type="button" onClick={() => setRenameUser(null)}>Cancelar</button>
                </form>
            )}
            {resetUser && (
                <form className="users-form" onSubmit={resetSellerPassword}>
                    <h2>Nueva clave para {resetUser.nombre_usuario}</h2>
                    <label htmlFor="reset-seller-password">Contraseña temporal</label>
                    <input id="reset-seller-password" type="password" autoComplete="new-password" minLength="12" maxLength="128" value={resetPassword} onChange={event => setResetPassword(event.target.value)} required />
                    <button type="submit">Restablecer clave</button>
                    <button type="button" onClick={() => setResetUser(null)}>Cancelar</button>
                </form>
            )}
        </section>
    );
};

export default Usuarios;