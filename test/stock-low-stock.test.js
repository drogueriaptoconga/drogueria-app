const test = require('node:test');
const assert = require('node:assert/strict');
const productosModule = require('../routes/productos');

test('el producto con stock 0 debe aparecer como faltante aunque no tenga fecha de vencimiento', () => {
  const producto = { stock_total: 0, stock_minimo_alerta: 5, fecha_vencimiento: null };
  assert.equal(productosModule.shouldShowInLowStockList(producto), true);
});

test('un producto con stock por encima del mínimo no debe aparecer como faltante', () => {
  const producto = { stock_total: 6, stock_minimo_alerta: 5, fecha_vencimiento: '2026-09-10' };
  assert.equal(productosModule.shouldShowInLowStockList(producto), false);
});
