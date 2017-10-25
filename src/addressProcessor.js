const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const Event = require("./Event");
const BraintreeError = require("./BraintreeError");
const name = require("./name");
const { curry } = require("lodash/fp");

function processorFields(address) {
    return {
        company: address.company,
        firstName: name.first(address.name),
        lastName: name.last(address.name),
        countryCodeAlpha2: address.country,
        locality: address.locality,
        streetAddress: address.streetAddress,
        extendedAddress: address.extendedAddress,
        postalCode: address.postalCode,
    };
}

function fields(address) {
    const response = {
        processor: {
            id: address.id,
            state: ProcessorItem.SAVED,
        },
        name: name.full(address.firstName, address.lastName),
        company: address.company,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt,
        country: address.countryCodeAlpha2,
        locality: address.locality,
        streetAddress: address.streetAddress,
        extendedAddress: address.extendedAddress,
        postalCode: address.postalCode,
    };

    return response;
}

function save(processor, customer, address) {
    const data = processorFields(address);

    function processSave(result) {
        processor.emit("event", new Event(Event.ADDRESS, Event.SAVED, result));
        Object.assign(address, fields(result.address));

        return customer;
    }

    if (address.processor.state === ProcessorItem.CHANGED) {
        processor.emit("event", new Event(Event.ADDRESS, Event.UPDATING, data));
        return processor.gateway.address
            .update(customer.processor.id, address.processor.id, data)
            .then(BraintreeError.guard)
            .then(processSave);
    } else if (address.processor.state === ProcessorItem.INITIAL) {
        data.customerId = customer.processor.id;
        processor.emit("event", new Event(Event.ADDRESS, Event.CREATING, data));
        return processor.gateway.address
            .create(data)
            .then(BraintreeError.guard)
            .then(processSave);
    } else {
        return Promise.resolve(customer);
    }
}

module.exports = {
    fields: curry(fields),
    processorFields: curry(processorFields),
    save: curry(save),
};
