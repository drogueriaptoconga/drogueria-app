const test = require('node:test');
const assert = require('node:assert/strict');
const reportesModule = require('../routes/reportes');

test('buildFinancialSummary calcula ingresos, gastos, ganancia y porcentajes correctos para un rango', () => {
  const summary = reportesModule.buildFinancialSummary({
    totalIngresos: 1000,
    totalGastos: 300,
    totalGanancia: 700,
  });

  assert.equal(summary.totalIngresos, 1000);
  assert.equal(summary.totalGastos, 300);
  assert.equal(summary.totalGananciaBruta, 700);
  assert.equal(summary.gananciaNeta, 400);
  assert.equal(summary.porcentajeGananciaBruta, 70);
  assert.equal(summary.porcentajeGananciaNeta, 40);
});
