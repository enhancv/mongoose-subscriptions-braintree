const main = require("mongoose-subscriptions");
const Event = require("./Event");
const BraintreeError = require("./BraintreeError");
const name = require("./name");
const addressProcessor = require("./addressProcessor");
const paymentMethodProcessor = require("./paymentMethodProcessor");
const subscriptionProcessor = require("./subscriptionProcessor");
const transactionProcessor = require("./transactionProcessor");
const {
    getOr,
    uniqBy,
    get,
    flatten,
    map,
    orderBy,
    curry,
    set
} = require("lodash/fp");

const ProcessorItem = main.Schema.ProcessorItem;

function processorFields(customer) {
    return {
        firstName: name.first(customer.name),
        lastName: name.last(customer.name),
        email: customer.email,
        phone: customer.phone,
        customFields: {
            ipAddress: customer.ipAddress,
            additionalEvidenceCountry: customer.defaultPaymentMethod
                ? customer.defaultPaymentMethod()
                  ? customer.defaultPaymentMethod().countryCode
                  : null
                : null
        }
    };
}

function fields(customer) {
    const response = {
        name: name.full(customer.firstName, customer.lastName),
        email: customer.email,
        phone: customer.phone,
        ipAddress: customer.customFields.ipAddress,
        processor: {
            id: customer.id,
            state: ProcessorItem.SAVED
        }
    };

    return response;
}

function save(processor, customer) {
    const data = processorFields(customer);

    function processSave(result) {
        processor.emit("event", new Event(Event.CUSTOMER, Event.SAVED, result));
        return Object.assign(customer, fields(result.customer));
    }

    if (customer.processor.state === ProcessorItem.CHANGED) {
        processor.emit(
            "event",
            new Event(Event.CUSTOMER, Event.UPDATING, data)
        );
        return processor.gateway.customer
            .update(customer.processor.id, data)
            .then(BraintreeError.guard)
            .then(processSave);
    } else if (customer.processor.state === ProcessorItem.INITIAL) {
        processor.emit(
            "event",
            new Event(Event.CUSTOMER, Event.CREATING, data)
        );
        return processor.gateway.customer
            .create(data)
            .then(BraintreeError.guard)
            .then(processSave);
    } else {
        return Promise.resolve(customer);
    }
}

function extractFromCollection(innerName, collection) {
    const nested = map(get(innerName), collection);
    return uniqBy(get("id"), flatten(nested));
}

function mergeCollection(collection, braintreeCollection, customizer) {
    braintreeCollection.forEach(braintreeItem => {
        const index = collection.findIndex(
            item => item.processor.id === braintreeItem.id
        );

        if (index !== -1) {
            Object.assign(
                collection[index],
                customizer(braintreeItem, collection[index])
            );
        } else {
            collection.push(customizer(braintreeItem));
        }
    });
}

function load(processor, customer) {
    ProcessorItem.validateIsSaved(customer);
    processor.emit("event", new Event(Event.CUSTOMER, Event.LOADING, customer));

    return processor.gateway.customer
        .find(customer.processor.id)
        .then(customerResult => {
            processor.emit(
                "event",
                new Event(Event.CUSTOMER, Event.LOADED, customerResult)
            );
            Object.assign(customer, fields(customerResult));

            const subscriptionsResult = extractFromCollection(
                "subscriptions",
                customerResult.paymentMethods
            );

            const transactionsResult = orderBy(
                "desc",
                "createdAt",
                extractFromCollection("transactions", subscriptionsResult)
            );

            mergeCollection(
                customer.addresses,
                customerResult.addresses,
                addressProcessor.fields
            );

            mergeCollection(
                customer.paymentMethods,
                customerResult.paymentMethods,
                paymentMethodProcessor.fields(customer)
            );

            mergeCollection(
                customer.subscriptions,
                subscriptionsResult,
                (subscription, original) => {
                    const plan = processor.plan(subscription.planId);

                    const item = subscriptionProcessor.fields(
                        customer,
                        getOr([], "discounts", original),
                        subscription
                    );

                    return set("plan", plan, item);
                }
            );

            mergeCollection(
                customer.transactions,
                transactionsResult,
                transactionProcessor.fields(customer)
            );

            customer.subscriptions = uniqBy(
                subscription => subscription.processor.id || subscription._id,
                customer.subscriptions
            );
            customer.paymentMethods = uniqBy(
                paymentMethod =>
                    paymentMethod.processor.id || paymentMethod._id,
                customer.paymentMethods
            );
            customer.transactions = uniqBy(
                transaction => transaction._id,
                customer.transactions
            );

            return customer;
        });
}

module.exports = {
    fields: curry(fields),
    processorFields: curry(processorFields),
    save: curry(save),
    load: curry(load)
};
