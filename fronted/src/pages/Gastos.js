// src/pages/Gastos.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Gastos.css';
import { getCurrentUser, getAuthHeaders } from '../auth';

const Gastos = () => {
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');
    const [gastos, setGastos] = useState([]);
    const [editingGasto, setEditingGasto] = useState(null);

    const currentUser = getCurrentUser();

    const fetchGastos = useCallback(async () => {
        try {
            const response = await axios.get('http://localhost:3001/api/gastos', { headers: getAuthHeaders() });
            setGastos(response.data);
        } catch (error) {
            console.error('Error al obtener los gastos:', error);
        }
    }, []);

    const role = (currentUser.role || '').toLowerCase();

    useEffect(() => {
        if (role === 'asesor') return;
        fetchGastos();
    }, [role, fetchGastos]);

    if ((currentUser.role || '').toLowerCase() === 'asesor') {
        return (
            <div className="gastos-container">
                <h2>403 - No autorizado</h2>
                <p>No tienes permisos para gestionar gastos.</p>
            </div>
        );
    }

    const startEditGasto = (gasto) => {
        setEditingGasto(gasto);
        setConcepto(gasto.concepto);
        setMonto(gasto.monto.toString());
    };

    const cancelEdit = () => {
        setEditingGasto(null);
        setConcepto('');
        setMonto('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!concepto.trim()) {
            alert('El concepto es obligatorio.');
            return;
        }

        const montoValue = parseFloat(monto);
        if (isNaN(montoValue) || montoValue <= 0) {
            alert('El monto debe ser un número mayor a cero.');
            return;
        }

        try {
            const newGasto = { concepto: concepto.trim(), monto: montoValue };
            if (editingGasto) {
                await axios.put(`http://localhost:3001/api/gastos/${editingGasto.id}`, newGasto, { headers: getAuthHeaders() });
                alert('Gasto actualizado con éxito!');
            } else {
                await axios.post('http://localhost:3001/api/gastos', newGasto, { headers: getAuthHeaders() });
                alert('Gasto registrado con éxito!');
            }
            setConcepto('');
            setMonto('');
            setEditingGasto(null);
            fetchGastos(); // Vuelve a cargar la lista de gastos
        } catch (error) {
            console.error('Error al guardar el gasto:', error);
            alert('Error al guardar el gasto. Por favor, intente de nuevo.');
        }
    };

    return (
        <div className="gastos-container">
            <h1>Gestión de Gastos</h1>

            <div className="form-section">
                <h2>{editingGasto ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Concepto:</label>
                        <input
                            type="text"
                            value={concepto}
                            onChange={(e) => setConcepto(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Monto:</label>
                        <input
                            type="number"
                            step="0.01"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-buttons">
                        <button type="submit">{editingGasto ? 'Actualizar Gasto' : 'Registrar Gasto'}</button>
                        {editingGasto && (
                            <button type="button" className="cancel-button" onClick={cancelEdit}>Cancelar</button>
                        )}
                    </div>
                </form>
            </div>
            
            <hr />

            <div className="list-section">
                <h2>Historial de Gastos</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th>Monto</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gastos.map(gasto => (
                            <tr key={gasto.id}>
                                <td>{gasto.concepto}</td>
                                <td>${parseFloat(gasto.monto)}</td>
                                <td>{new Date(gasto.fecha_gasto).toLocaleDateString()}</td>
                                <td>
                                    <button className="edit-button" onClick={() => startEditGasto(gasto)}>Editar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Gastos;