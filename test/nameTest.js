const assert = require('assert');
const name = require('../src/name');

describe('name', () => {
    it('last name', () => {
        assert.deepEqual(name.last('Pesho Peshev'), 'Peshev');
        assert.deepEqual(name.last('Pesho'), '');
        assert.deepEqual(name.last('Pesho Peshev Stoinov'), 'Peshev Stoinov');
    });

    it('first name', () => {
        assert.deepEqual(name.first(), '');
        assert.deepEqual(name.first('Pesho Peshev'), 'Pesho');
        assert.deepEqual(name.first('Pesho'), 'Pesho');
        assert.deepEqual(name.first('Pesho Peshev Stoinov'), 'Pesho');
    });

    it('full name', () => {
        assert.deepEqual(name.full('Pesho', 'Peshev'), 'Pesho Peshev');
        assert.deepEqual(name.full('Pesho', null), 'Pesho');
        assert.deepEqual(name.full('Pesho', 'Peshev Stoinov'), 'Pesho Peshev Stoinov');
    });
});
