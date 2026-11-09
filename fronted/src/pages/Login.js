import API_BASE from '../api';
import React, { useState } from 'react';
import axios from 'axios';
import { saveAuthSession } from '../auth';
import './Login.css';

const UserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="8" r="4" />
    </svg>
);

const LockIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
);

const EyeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.1 12S5.5 5.5 12 5.5 21.9 12 21.9 12 18.5 18.5 12 18.5 2.1 12 2.1 12Z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const EyeOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.9 5.7A10.8 10.8 0 0 1 12 5.5c6.5 0 9.9 6.5 9.9 6.5a17 17 0 0 1-2.4 3.2M6.4 6.4A17.3 17.3 0 0 0 2.1 12S5.5 18.5 12 18.5a10.6 10.6 0 0 0 4.3-.9" />
        <path d="M3 3l18 18" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
    </svg>
);

const AlertIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
    </svg>
);

const ArrowIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
    </svg>
);

const CrossIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
    </svg>
);

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            const { data } = await axios.post(`${API_BASE}/api/auth/login`, { username, password });
            saveAuthSession(data.token, data.user);
            onLogin(data.user);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'No se pudo conectar con el servidor.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="login-shell">
            <section className="login-brand" aria-label="Droguería Puerto Conga">
                <div className="login-brand__glow login-brand__glow--one" aria-hidden="true" />
                <div className="login-brand__glow login-brand__glow--two" aria-hidden="true" />

                <header className="login-brand__header">
                    <span className="login-brand__mark">
                        <CrossIcon />
                    </span>
                    <div>
                        <p className="login-brand__name">Droguería</p>
                        <p className="login-brand__subname">Puerto Conga</p>
                    </div>
                </header>

                <div className="login-brand__body">
                    <span className="login-brand__badge">Sistema de gestión farmacéutica</span>
                    <h1>
                        Tu farmacia,
                        <br />
                        <em>siempre en orden.</em>
                    </h1>
                    <p className="login-brand__lead">
                        Inventario, ventas y reportes en un solo lugar, con la tranquilidad
                        de tener cada movimiento bajo control.
                    </p>
                    <ul className="login-brand__features">
                        <li>
                            <CheckIcon />
                            Inventario y stock en tiempo real
                        </li>
                        <li>
                            <CheckIcon />
                            Ventas ágiles y seguras
                        </li>
                        <li>
                            <CheckIcon />
                            Reportes claros para decidir mejor
                        </li>
                    </ul>
                </div>

                <p className="login-brand__footer">Puerto Conga · Colombia</p>
            </section>

            <section className="login-panel">
                <div className="login-card">
                    <header className="login-card__header">
                        <p className="login-card__eyebrow">Bienvenido de nuevo</p>
                        <h2>Inicia sesión</h2>
                        <p className="login-card__subtitle">
                            Ingresa tus credenciales para acceder al sistema.
                        </p>
                    </header>

                    <form className="login-card__form" onSubmit={handleSubmit}>
                        <div className="login-field">
                            <label htmlFor="login-username">Usuario</label>
                            <div className="login-input">
                                <span className="login-input__icon">
                                    <UserIcon />
                                </span>
                                <input
                                    id="login-username"
                                    name="username"
                                    autoComplete="username"
                                    autoFocus
                                    placeholder="Escribe tu usuario"
                                    value={username}
                                    onChange={event => setUsername(event.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="login-field">
                            <label htmlFor="login-password">Contraseña</label>
                            <div className="login-input">
                                <span className="login-input__icon">
                                    <LockIcon />
                                </span>
                                <input
                                    id="login-password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    placeholder="Escribe tu contraseña"
                                    value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="login-input__toggle"
                                    onClick={() => setShowPassword(visible => !visible)}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="login-alert" role="alert">
                                <AlertIcon />
                                <span>{error}</span>
                            </div>
                        )}

                        <button className="login-submit" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <span className="login-spinner" aria-hidden="true" />
                                    Ingresando...
                                </>
                            ) : (
                                <>
                                    Iniciar sesión
                                    <span className="login-submit__arrow">
                                        <ArrowIcon />
                                    </span>
                                </>
                            )}
                        </button>
                    </form>

                    <p className="login-card__help">
                        ¿Olvidaste tu contraseña? Contacta al administrador del sistema.
                    </p>
                </div>

                <p className="login-legal">
                    © {new Date().getFullYear()} Droguería Puerto Conga · Acceso seguro
                </p>
            </section>
        </main>
    );
};

export default Login;
