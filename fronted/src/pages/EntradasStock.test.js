import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import EntradasStock from './EntradasStock';

jest.mock('axios');

const product = {
  id: 1,
  codigo_producto: '12345',
  nombre: 'Paracetamol',
  stock_total: 10,
  costo_unidad: 1000,
  precio_unidad: 2000,
  venta_exclusiva_sobre: false,
  venta_exclusiva_caja: false,
};

describe('EntradasStock barcode search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: {} });
  });

  it('selects a product when the scanned code has one exact match', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('codigo_exacto=true')) return Promise.resolve({ data: [product] });
      return Promise.resolve({ data: [] });
    });

    render(<EntradasStock />);

    const input = screen.getByPlaceholderText('🔍 Buscar producto por código o nombre...');
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(screen.getByText(/Registrar Entrada de Stock/)).toBeInTheDocument());
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('query=12345&codigo_exacto=true'));
    expect(screen.getByText('Paracetamol', { exact: false })).toBeInTheDocument();
  });

  it('does not auto-select when an exact code has duplicate products', async () => {
    const duplicate = { ...product, id: 2, nombre: 'Paracetamol 500 mg' };
    axios.get.mockImplementation((url) => {
      if (url.includes('codigo_exacto=true')) return Promise.resolve({ data: [product, duplicate] });
      return Promise.resolve({ data: [] });
    });

    render(<EntradasStock />);

    const input = screen.getByPlaceholderText('🔍 Buscar producto por código o nombre...');
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText(/Hay varios productos con ese código/)).toBeInTheDocument();
    expect(screen.queryByText(/Registrar Entrada de Stock/)).not.toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500 mg', { exact: false })).toBeInTheDocument();
  });

  it('keeps partial matches available for manual selection when there is no exact code', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('codigo_exacto=true')) return Promise.resolve({ data: [] });
      if (url.includes('query=12345')) return Promise.resolve({ data: [product] });
      return Promise.resolve({ data: {} });
    });

    render(<EntradasStock />);

    const input = screen.getByPlaceholderText('🔍 Buscar producto por código o nombre...');
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Paracetamol', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/Registrar Entrada de Stock/)).not.toBeInTheDocument();
  });

  it('ignores older search responses when a newer query has already completed', async () => {
    let resolveOlderSearch;
    let resolveNewerSearch;
    axios.get.mockImplementation((url) => {
      if (url.includes('estadisticas')) return Promise.resolve({ data: {} });
      if (url.includes('query=111')) {
        return new Promise((resolve) => { resolveOlderSearch = resolve; });
      }
      if (url.includes('query=222')) {
        return new Promise((resolve) => { resolveNewerSearch = resolve; });
      }
      return Promise.resolve({ data: {} });
    });

    render(<EntradasStock />);

    const input = screen.getByPlaceholderText('🔍 Buscar producto por código o nombre...');
    fireEvent.change(input, { target: { value: '111' } });
    fireEvent.change(input, { target: { value: '222' } });

    resolveNewerSearch({ data: [{ ...product, id: 2, codigo_producto: '222', nombre: 'Producto nuevo' }] });
    expect(await screen.findByText('Producto nuevo', { exact: false })).toBeInTheDocument();

    resolveOlderSearch({ data: [{ ...product, codigo_producto: '111', nombre: 'Producto anterior' }] });
    expect(screen.queryByText('Producto anterior', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText('Producto nuevo', { exact: false })).toBeInTheDocument();
  });
});