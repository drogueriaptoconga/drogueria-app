const test = require('node:test');
const assert = require('node:assert/strict');
const reportesModule = require('../routes/reportes');

test('buildFinancialSummary calcula ingresos, gastos, ganancia y porcentajes correctos para un rango', () => {
  const summary = reportesModule.buildFinancialSummary({
    totalIngresos: 1000,
    ventasEfectivo: 600,
    ventasTransferencia: 400,
    ventasMixto: 100,
    totalGastos: 300,
    totalGanancia: 700,
  });

  assert.equal(summary.totalIngresos, 1000);
  assert.equal(summary.ventasEfectivo, 600);
  assert.equal(summary.ventasTransferencia, 400);
  assert.equal(summary.ventasMixto, 100);
  assert.equal(summary.totalGastos, 300);
  assert.equal(summary.totalGananciaBruta, 700);
  assert.equal(summary.gananciaNeta, 400);
  assert.equal(summary.porcentajeGananciaBruta, 70);
  assert.equal(summary.porcentajeGananciaNeta, 40);
});

test('buildEntrySummary calcula productos y unidades ingresadas en un rango de fechas', () => {
  const summary = reportesModule.buildEntrySummary({
    totalProductos: 6,
    totalUnidades: 90,
    totalInversion: 4500,
  });

  assert.equal(summary.totalProductos, 6);
  assert.equal(summary.totalUnidades, 90);
  assert.equal(summary.totalInversion, 4500);
});

test('calculateMonthlyAverages incluye los días en cero y separa los días con ventas', () => {
  const averages = reportesModule.calculateMonthlyAverages(3000, 10, 3);

  assert.equal(averages.promedioMensual, 300);
  assert.equal(averages.promedioDiaConVenta, 1000);
});

test('calculateMonthlyAverages devuelve cero cuando no hay ventas', () => {
  const averages = reportesModule.calculateMonthlyAverages('', 12, 0);

  assert.equal(averages.promedioMensual, 0);
  assert.equal(averages.promedioDiaConVenta, 0);
});
