const test = require('node:test');
const assert = require('node:assert/strict');
const trasladosModule = require('../routes/traslados');

test('buildTrasladoObservacion genera el formato estructurado correcto', () => {
    const obs = trasladosModule.buildTrasladoObservacion('Estante A', 'Estante B', 'Reorganización');
    assert.equal(obs, 'TRASLADO|Origen:Estante A|Destino:Estante B|Observación:Reorganización');
});

test('buildTrasladoObservacion funciona sin observación', () => {
    const obs = trasladosModule.buildTrasladoObservacion('Principal', 'Secundario', '');
    assert.equal(obs, 'TRASLADO|Origen:Principal|Destino:Secundario');
    assert.ok(obs.startsWith('TRASLADO'));
});

test('buildTrasladoObservacion usa "Sin especificar" cuando falta origen', () => {
    const obs = trasladosModule.buildTrasladoObservacion(null, 'Destino X', null);
    assert.equal(obs, 'TRASLADO|Origen:Sin especificar|Destino:Destino X');
});

test('parseTrasladoObservacion extrae origen, destino y observación', () => {
    const parsed = trasladosModule.parseTrasladoObservacion(
        'TRASLADO|Origen:Estante A|Destino:Estante B|Observación:Mover urgente'
    );
    assert.equal(parsed.punto_origen, 'Estante A');
    assert.equal(parsed.punto_destino, 'Estante B');
    assert.equal(parsed.observacion, 'Mover urgente');
});

test('parseTrasladoObservacion retorna nulls para observación vacía', () => {
    const parsed = trasladosModule.parseTrasladoObservacion(null);
    assert.equal(parsed.punto_origen, null);
    assert.equal(parsed.punto_destino, null);
    assert.equal(parsed.observacion, null);
});

test('parseTrasladoObservacion funciona sin observación', () => {
    const parsed = trasladosModule.parseTrasladoObservacion(
        'TRASLADO|Origen:Almacén|Destino:Vitrina'
    );
    assert.equal(parsed.punto_origen, 'Almacén');
    assert.equal(parsed.punto_destino, 'Vitrina');
    assert.equal(parsed.observacion, null);
});

test('round-trip: build + parse es consistento', () => {
    const original = trasladosModule.buildTrasladoObservacion('Casa Matriz', 'Sucursal Norte', 'Stock de seguridad');
    const parsed = trasladosModule.parseTrasladoObservacion(original);
    assert.equal(parsed.punto_origen, 'Casa Matriz');
    assert.equal(parsed.punto_destino, 'Sucursal Norte');
    assert.equal(parsed.observacion, 'Stock de seguridad');
});
