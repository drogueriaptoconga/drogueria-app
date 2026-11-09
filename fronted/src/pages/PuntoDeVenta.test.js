import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import PuntoDeVenta from './PuntoDeVenta';

jest.mock('axios');

describe('PuntoDeVenta scanner flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not trigger the sale confirmation when a new scan arrives immediately after adding an item', async () => {
    axios.get.mockResolvedValue({
      data: [
        {
          id: 1,
          nombre: 'Paracetamol',
          precio_unidad: 2000,
          precio_por_sobre: 18000,
          precio_por_caja: 150000,
          venta_exclusiva_sobre: false,
          venta_exclusiva_caja: false,
          unidades_por_sobre: 10,
          unidades_por_caja: 20,
          precio_solo_sobre: 0,
          precio_solo_caja: 0,
          cantidad_solo_sobre: 0,
          cantidad_solo_caja: 0,
        },
      ],
    });

    render(<PuntoDeVenta />);

    const input = screen.getByPlaceholderText('Buscar producto por nombre o código...');

    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', bubbles: true });

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    });
    expect(input).toHaveFocus();

    fireEvent(document, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(screen.queryByText('Confirmar Venta')).not.toBeInTheDocument();
  });

  it('keeps consecutive scans in the cart when their searches finish out of order', async () => {
    const firstSearch = Promise.resolve({
      data: [{
        id: 1,
        nombre: 'Paracetamol',
        precio_unidad: 2000,
        venta_exclusiva_sobre: false,
        venta_exclusiva_caja: false,
      }],
    });
    const secondSearch = Promise.resolve({
      data: [{
        id: 2,
        nombre: 'Ibuprofeno',
        precio_unidad: 3000,
        venta_exclusiva_sobre: false,
        venta_exclusiva_caja: false,
      }],
    });
    axios.get
      .mockResolvedValueOnce({ data: [] })
      .mockReturnValueOnce(secondSearch)
      .mockResolvedValueOnce({ data: [] })
      .mockReturnValueOnce(firstSearch);

    render(<PuntoDeVenta />);

    const input = screen.getByPlaceholderText('Buscar producto por nombre o código...');
    fireEvent.change(input, { target: { value: '111' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', bubbles: true });
    fireEvent.change(input, { target: { value: '222' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', bubbles: true });

    await waitFor(() => {
      expect(screen.getByText('Paracetamol')).toBeInTheDocument();
      expect(screen.getByText('Ibuprofeno')).toBeInTheDocument();
    });
  });

  it('only opens and confirms a sale through the visible buttons, not global Enter or Space', async () => {
    axios.get.mockResolvedValue({
      data: [{
        id: 1,
        nombre: 'Paracetamol',
        precio_unidad: 2000,
        venta_exclusiva_sobre: false,
        venta_exclusiva_caja: false,
      }],
    });
    axios.post.mockResolvedValue({ data: { venta_id: 10 } });

    render(<PuntoDeVenta />);

    const input = screen.getByPlaceholderText('Buscar producto por nombre o código...');
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', bubbles: true });

    await waitFor(() => expect(screen.getByText('Paracetamol')).toBeInTheDocument());

    fireEvent(document, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fireEvent(document, new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(screen.queryByText('Confirmar Venta')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Procesar Venta' }));
    expect(screen.getByText('Confirmar Venta')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Transferencia'));
    fireEvent(document, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getByText('Confirmar Venta')).toBeInTheDocument();
  });
});
