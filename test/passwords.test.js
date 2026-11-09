const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../utils/passwords');

test('password hashes verify only the matching password', () => {
    const hash = hashPassword('a long test password');

    assert.notEqual(hash, 'a long test password');
    assert.equal(verifyPassword('a long test password', hash), true);
    assert.equal(verifyPassword('a different password', hash), false);
});

test('legacy non-scrypt credential formats are rejected', () => {
    assert.equal(verifyPassword('admin', 'abcde'), false);
});