const crypto = require('crypto');

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex');
    return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password, encodedPassword) {
    if (typeof encodedPassword !== 'string') return false;
    const [algorithm, salt, encodedKey] = encodedPassword.split('$');
    if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/i.test(salt || '') || !/^[a-f0-9]{128}$/i.test(encodedKey || '')) {
        return false;
    }

    const expectedKey = Buffer.from(encodedKey, 'hex');
    const actualKey = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return crypto.timingSafeEqual(actualKey, expectedKey);
}

module.exports = { hashPassword, verifyPassword };