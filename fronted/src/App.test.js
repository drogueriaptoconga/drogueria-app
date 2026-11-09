import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import App from './App';

jest.mock('axios');

beforeEach(() => {
  window.localStorage.setItem('authToken', 'a'.repeat(64));
  window.localStorage.setItem('currentUser', JSON.stringify({ id: 1, role: 'admin', username: 'admin' }));
  axios.get.mockResolvedValue({ data: { user: { id: 1, role: 'admin', username: 'admin' } } });
});

afterEach(() => {
  window.localStorage.removeItem('authToken');
  window.localStorage.removeItem('currentUser');
});

test('focuses the first field when navigating to a module without its own autofocus', async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole('link', { name: 'Gastos' }));
  await screen.findByRole('heading', { name: 'Gestión de Gastos' });

  await waitFor(() => {
    expect(document.querySelector('.gastos-container input')).toHaveFocus();
  });
});
