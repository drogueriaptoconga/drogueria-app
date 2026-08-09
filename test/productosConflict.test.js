const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProductConflict } = require('../routes/productosConflict');

test('devuelve acción de creación cuando no existe un producto duplicado', () => {
  const result = resolveProductConflict(null, false);
  assert.deepEqual(result, { action: 'create' });
});

test('rechaza la creación cuando ya existe un producto duplicado y no se permite sobrescribir', () => {
  const result = resolveProductConflict({ id: 7, codigo_producto: 'ABC123' }, false);
  assert.deepEqual(result, { action: 'reject', existingProduct: { id: 7, codigo_producto: 'ABC123' } });
});

test('sobrescribe el producto existente cuando el usuario confirma', () => {
  const result = resolveProductConflict({ id: 7, codigo_producto: 'ABC123' }, true);
  assert.deepEqual(result, { action: 'update', existingProductId: 7 });
});
