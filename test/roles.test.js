const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAdmin, requireSellerOrAdmin } = require('../middleware/roles');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test('a client-supplied admin header cannot grant admin permissions', () => {
    const req = { user: { role: 'vendedor' }, get: () => 'admin' };
    const res = createResponse();
    let passed = false;

    requireAdmin(req, res, () => { passed = true; });

    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
});

test('a seller may use routes available to sellers and admins', () => {
    const req = { user: { role: 'vendedor' } };
    const res = createResponse();
    let passed = false;

    requireSellerOrAdmin(req, res, () => { passed = true; });

    assert.equal(passed, true);
    assert.equal(res.statusCode, 200);
});

test('an unauthenticated request is rejected', () => {
    const res = createResponse();
    let passed = false;

    requireSellerOrAdmin({}, res, () => { passed = true; });

    assert.equal(passed, false);
    assert.equal(res.statusCode, 401);
});