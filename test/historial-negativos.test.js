const { calcularGananciaLinea } = require('../routes/historial');

const producto = {
  costo_unidad: 120,
  unidades_por_sobre: 12,
  unidades_por_caja: 24,
  cantidad_solo_sobre: 8,
  cantidad_solo_caja: 16,
};

const resultadoUnidad = calcularGananciaLinea(producto, 100, 'Unidad', 2);
const resultadoSobre = calcularGananciaLinea(producto, 1300, 'Sobre', 2);
const resultadoNegativo = calcularGananciaLinea(producto, 100, 'Sobre', 2);
const resultadoSoloSobre = calcularGananciaLinea(producto, 1500, 'Solo Sobre', 2);
const resultadoSoloCaja = calcularGananciaLinea(producto, 3000, 'Solo Caja', 2);

if (resultadoUnidad !== 0) {
  throw new Error(`Se esperaba 0 en venta por Unidad, pero llegó a ${resultadoUnidad}`);
}

if (resultadoSobre !== 0) {
  throw new Error(`Se esperaba 0 en venta por Sobre con costo mayor, pero llegó a ${resultadoSobre}`);
}

if (resultadoNegativo !== 0) {
  throw new Error(`Se esperaba 0 cuando la ganancia sería negativa, pero llegó a ${resultadoNegativo}`);
}

if (resultadoSoloSobre !== 2760) {
  throw new Error(`Se esperaba 2760 en venta Solo Sobre, pero llegó a ${resultadoSoloSobre}`);
}

if (resultadoSoloCaja !== 5760) {
  throw new Error(`Se esperaba 5760 en venta Solo Caja, pero llegó a ${resultadoSoloCaja}`);
}

console.log('OK: la ganancia no puede quedar negativa en historial');
