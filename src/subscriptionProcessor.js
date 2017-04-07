const ProcessorItem = require('mongoose-subscriptions').Schema.ProcessorItem;
const braintree = require('braintree');
const Event = require('./Event');
const BraintreeError = require('./BraintreeError');
const transactionProcessor = require('./transactionProcessor');
const {
    pick,
    pickBy,
    identity,
    flow,
    filter,
    map,
    negate,
    get,
    isEmpty,
    concat,
    differenceBy,
    curry,
} = require('lodash/fp');

function processorFieldsDiscounts(originalDiscounts, discounts) {
    const response = {
        update: flow(
                filter(get('processor.id')),
                map(item => ({
                    existingId: item.__t,
                    amount: item.amount,
                    numberOfBillingCycles: item.numberOfBillingCycles,
                }))
            )(discounts),
        add: flow(
                filter(negate(get('processor.id'))),
                map(item => ({
                    inheritedFromId: item.__t,
                    amount: item.amount,
                    numberOfBillingCycles: item.numberOfBillingCycles,
                }))
            )(discounts),
        remove: flow(
                filter(get('processor.id')),
                filter(original => !discounts.find(item => original.__t === item.__t)),
                map(get('processor.id'))
            )(originalDiscounts),
    };

    return pickBy(negate(isEmpty), response);
}

function processorFields(customer, subscription) {
    const paymentMethod = customer.paymentMethods.id(subscription.paymentMethodId);
    const processorDiscounts = processorFieldsDiscounts(
        subscription.original.discounts,
        subscription.discounts
    );

    const response = {
        planId: subscription.plan.processorId,
        paymentMethodToken: paymentMethod
            ? ProcessorItem.validateIsSaved(paymentMethod).processor.id
            : null,
        descriptor: pick(['name', 'phone', 'url'], subscription.descriptor),
        discounts: processorDiscounts,
    };

    return pickBy(identity, response);
}

function fieldsDiscounts(originalDiscounts, resultDiscounts) {
    return resultDiscounts.map((discount) => {
        const original = originalDiscounts.find(
            item => item.processor.id === discount.id || item.__t === discount.id
        );

        const newDiscount = {
            __t: 'DiscountAmount',
            amount: discount.amount,
            numberOfBillingCycles: discount.numberOfBillingCycles,
        };

        const mapped = original || newDiscount;

        mapped.processor = { id: discount.id, state: ProcessorItem.SAVED };

        return mapped;
    });
}

function fields(customer, originalDiscounts, subscription) {
    const response = {
        processor: {
            id: subscription.id,
            state: ProcessorItem.SAVED,
        },
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        paidThroughDate: subscription.paidThroughDate,
        descriptor: subscription.descriptor,
        status: subscription.status,
        price: subscription.price,
        statusHistory: map(pick(['timestamp', 'status']), subscription.statusHistory),
        discounts: fieldsDiscounts(originalDiscounts, subscription.discounts),
        firstBillingDate: subscription.firstBillingDate,
        nextBillingDate: subscription.nextBillingDate,
        paymentMethodId: ProcessorItem.getId(
            subscription.paymentMethodToken,
            customer.paymentMethods
        ),
    };

    return pickBy(identity, response);
}

function cancel(processor, customer, subscription) {
    ProcessorItem.validateIsSaved(customer, 'Customer');
    ProcessorItem.validateIsSaved(subscription, 'Subscription');

    return new Promise((resolve, reject) => {
        processor.emit('event', new Event(Event.SUBSCRIPTION, Event.CANCELING, subscription));
        processor.gateway.subscription.cancel(subscription.processor.id, (err, result) => {
            if (err) {
                reject(err);
            } else {
                processor.emit('event', new Event(Event.SUBSCRIPTION, Event.CANCELED, result));
                Object.assign(
                    subscription,
                    fields(customer, subscription.discounts, result.subscription)
                );

                resolve(customer);
            }
        });
    });
}

function save(processor, customer, subscription) {
    const data = processorFields(customer, subscription);

    return new Promise((resolve, reject) => {
        function callback(err, result) {
            if (err) {
                reject(err);
            } else if (result.success) {
                processor.emit('event', new Event(Event.SUBSCRIPTION, Event.SAVED, result));

                Object.assign(
                    subscription,
                    fields(customer, subscription.discounts, result.subscription)
                );

                const transactions = map(
                    transactionProcessor.fields(customer),
                    result.subscription.transactions
                );

                const newTransactions = differenceBy(
                    get('_id'),
                    transactions,
                    customer.transactions
                );

                customer.transactions = concat(customer.transactions, newTransactions);

                resolve(customer);
            } else {
                reject(new BraintreeError(result));
            }
        }

        if (
            subscription.processor.state === ProcessorItem.CHANGED
            && subscription.status === braintree.Subscription.Status.Canceled
        ) {
            processor.emit('event', new Event(Event.SUBSCRIPTION, Event.CANCELING, data));
            processor.gateway.subscription.cancel(subscription.processor.id, callback);
        } else if (subscription.processor.state === ProcessorItem.LOCAL) {
            resolve(customer);
        } else if (subscription.processor.state === ProcessorItem.CHANGED) {
            processor.emit('event', new Event(Event.SUBSCRIPTION, Event.UPDATING, data));
            processor.gateway.subscription.update(subscription.processor.id, data, callback);
        } else if (subscription.processor.state === ProcessorItem.INITIAL) {
            processor.emit('event', new Event(Event.SUBSCRIPTION, Event.CREATING, data));
            processor.gateway.subscription.create(data, callback);
        } else {
            resolve(customer);
        }
    });
}

module.exports = {
    processorFieldsDiscounts: curry(processorFieldsDiscounts),
    processorFields: curry(processorFields),
    fieldsDiscounts: curry(fieldsDiscounts),
    fields: curry(fields),
    cancel: curry(cancel),
    save: curry(save),
};
