const assert = require('assert');
const sinon = require('sinon');
const Customer = require('mongoose-subscriptions').Customer;
const ProcessorItem = require('mongoose-subscriptions').Schema.ProcessorItem;
const addressProcessor = require('../src/addressProcessor');

describe('addressProcessor', () => {
    beforeEach(function () {
        this.customer = new Customer({
            name: 'Pesho',
            email: 'seer@example.com',
            ipAddress: '10.0.0.2',
            processor: { id: '64601260', state: 'saved' },
            defaultPaymentMethodId: 'three',
            addresses: [
                {
                    _id: 'one',
                    processor: { id: 'test-id', state: 'saved' },
                    name: 'Pesho Stanchev',
                },
            ],
        });

        this.addressResult = {
            success: true,
            address: {
                id: 'test-id',
                company: 'Example company',
                firstName: 'Pesho',
                lastName: 'Peshev Stoevski',
                countryCodeAlpha2: 'BG',
                locality: 'Sofia',
                streetAddress: 'Tsarigradsko Shose 4',
                extendedAddress: 'floor 3',
                postalCode: '1000',
                createdAt: '2016-09-29T16:12:26Z',
                updatedAt: '2016-09-30T12:25:18Z',
            },
        };
    });


    it('processorFields should map models to braintree data', () => {
        const address = {
            processor: {
                id: 'test',
                state: ProcessorItem.SAVED,
            },
            company: 'Example company',
            name: 'Pesho Peshev Stoevski',
            country: 'BG',
            locality: 'Sofia',
            streetAddress: 'Tsarigradsko Shose 4',
            extendedAddress: 'floor 3',
            postalCode: '1000',
        };

        const fields = addressProcessor.processorFields(address);

        const expected = {
            company: 'Example company',
            firstName: 'Pesho',
            lastName: 'Peshev Stoevski',
            countryCodeAlpha2: 'BG',
            locality: 'Sofia',
            streetAddress: 'Tsarigradsko Shose 4',
            extendedAddress: 'floor 3',
            postalCode: '1000',
        };

        assert.deepEqual(fields, expected);
    });

    it('fields should map result data into a model', function () {
        const fields = addressProcessor.fields(this.addressResult.address);

        const expected = {
            processor: {
                id: 'test-id',
                state: ProcessorItem.SAVED,
            },
            company: 'Example company',
            name: 'Pesho Peshev Stoevski',
            country: 'BG',
            locality: 'Sofia',
            streetAddress: 'Tsarigradsko Shose 4',
            extendedAddress: 'floor 3',
            postalCode: '1000',
            createdAt: '2016-09-29T16:12:26Z',
            updatedAt: '2016-09-30T12:25:18Z',
        };

        assert.deepEqual(fields, expected);
    });

    it('save should call create endpoint on new address', function () {
        const gateway = {
            address: {
                create: sinon.stub().callsArgWith(1, null, this.addressResult),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        this.customer.addresses[0].processor = { id: null, state: ProcessorItem.INITIAL };

        return addressProcessor.save(processor, this.customer, this.customer.addresses[0])
            .then((customer) => {
                const address = customer.addresses[0];
                sinon.assert.calledWith(processor.emit, 'event', sinon.match.has('name', 'address').and(sinon.match.has('action', 'saved')));
                sinon.assert.calledOnce(gateway.address.create);
                sinon.assert.calledWith(gateway.address.create, sinon.match.has('customerId', '64601260'));
                assert.deepEqual(address.processor.toObject(), { id: 'test-id', state: ProcessorItem.SAVED });
            });
    });

    it('save should call update endpoint on existing address', function () {
        const gateway = {
            address: {
                update: sinon.stub().callsArgWith(3, null, this.addressResult),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        this.customer.addresses[0].processor.state = ProcessorItem.CHANGED;

        return addressProcessor.save(processor, this.customer, this.customer.addresses[0])
            .then((customer) => {
                const address = customer.addresses[0];
                sinon.assert.calledWith(processor.emit, 'event', sinon.match.has('name', 'address').and(sinon.match.has('action', 'saved')));
                sinon.assert.calledOnce(gateway.address.update);
                sinon.assert.calledWith(gateway.address.update, '64601260', 'test-id', sinon.match.object);
                assert.deepEqual('Example company', address.company);
            });
    });

    it('save should be a noop if the state has not changed', function () {
        const gateway = { };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        return addressProcessor.save(processor, this.customer, this.customer.addresses[0])
            .then((customer) => {
                assert.equal(customer, this.customer);
                sinon.assert.neverCalledWith(processor.emit, 'event', sinon.match.has('name', 'address'));
            });
    });

    it('save should send a rejection on api error', function () {
        const apiError = new Error('error');

        const gateway = {
            address: {
                update: sinon.stub().callsArgWith(3, apiError),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        this.customer.addresses[0].processor.state = ProcessorItem.CHANGED;

        return addressProcessor.save(processor, this.customer, this.customer.addresses[0])
            .catch((error) => {
                sinon.assert.neverCalledWith(processor.emit, 'event', sinon.match.has('action', 'saved'));
                assert.equal(error, apiError);
            });
    });

    it('save should send a rejection on api result failure', function () {
        const gateway = {
            address: {
                update: sinon.stub().callsArgWith(3, null, { success: false, message: 'some error' }),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        this.customer.addresses[0].processor.state = ProcessorItem.CHANGED;

        return addressProcessor.save(processor, this.customer, this.customer.addresses[0])
            .catch((error) => {
                sinon.assert.neverCalledWith(processor.emit, 'event', sinon.match.has('action', 'saved'));
                assert.equal(error.message, 'some error');
            });
    });
});
