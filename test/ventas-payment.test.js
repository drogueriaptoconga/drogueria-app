const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularDetalleVenta, validarDesglosePago } = require('../routes/ventas');

test('bloquea venta por Unidad en producto exclusivo de Caja', () => {
  assert.throws(
    () => calcularDetalleVenta({ venta_exclusiva_caja: true, precio_solo_caja: 8000 }, {
      tipo_venta: 'Unidad',
      cantidad_vendida: 1,
    }),
    /solo puede venderse por Solo Caja/
  );
});

test('permite venta exclusiva usando el precio de la presentación', () => {
  assert.deepEqual(
    calcularDetalleVenta({ venta_exclusiva_caja: true, precio_solo_caja: 8000 }, {
      tipo_venta: 'Solo Caja',
      cantidad_vendida: 1,
    }),
    { precioVentaPorItem: 8000, unidadesADescontar: 1 }
  );
});

test('acepta un pago mixto cuando ambas partes suman el total', () => {
  assert.doesNotThrow(() => validarDesglosePago('Mixto', 100000, 40000, 60000));
});

test('rechaza un pago mixto incompleto o con suma incorrecta', () => {
  assert.throws(
    () => validarDesglosePago('Mixto', 100000, 100000, 0),
    /debe incluir efectivo y transferencia/
  );
  assert.throws(
    () => validarDesglosePago('Mixto', 100000, 40000, 50000),
    /debe ser igual al total/
  );
});
