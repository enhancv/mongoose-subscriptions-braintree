const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const braintree = require("braintree");
const Event = require("./Event");
const BraintreeError = require("./BraintreeError");
const transactionProcessor = require("./transactionProcessor");
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
    omit,
    uniqWith,
    isEqual,
} = require("lodash/fp");

function processorFieldsDiscounts(originalDiscounts, discounts) {
    const response = {
        update: flow(
            filter(get("processor.id")),
            map(item => ({
                existingId: item.__t,
                amount: item.amount,
                numberOfBillingCycles: item.numberOfBillingCycles,
            }))
        )(discounts),
        add: flow(
            filter(negate(get("processor.id"))),
            map(item => ({
                inheritedFromId: item.__t,
                amount: item.amount,
                numberOfBillingCycles: item.numberOfBillingCycles,
            }))
        )(discounts),
        remove: flow(
            filter(get("processor.id")),
            filter(original => !discounts.find(item => original.__t === item.__t)),
            map(get("processor.id"))
        )(originalDiscounts),
    };

    return pickBy(negate(isEmpty), response);
}

function processorFields(customer, subscription) {
    const originalDiscounts =
        get("snapshotOriginal.discounts", subscription) ||
        get("original.discounts", subscription) ||
        [];

    const processorDiscounts = processorFieldsDiscounts(originalDiscounts, subscription.discounts);

    const response = {
        planId: subscription.plan.processorId,
        paymentMethodToken: ProcessorItem.getProcessorId(
            subscription.paymentMethodId,
            customer.paymentMethods
        ),
        trialPeriod: subscription.isTrial,
        trialDuration: subscription.trialDuration,
        trialDurationUnit: subscription.trialDurationUnit,
        descriptor: pick(["name", "phone", "url"], subscription.descriptor),
        discounts: processorDiscounts,
        firstBillingDate: subscription.firstBillingDate,
    };

    return pickBy(identity, response);
}

function fieldsDiscounts(originalDiscounts, resultDiscounts) {
    return resultDiscounts.map(discount => {
        const original = originalDiscounts.find(
            item => item.processor.id === discount.id || item.__t === discount.id
        );

        const newDiscount = {
            __t: "DiscountAmount",
            amount: discount.amount,
            numberOfBillingCycles: discount.numberOfBillingCycles,
        };

        const mapped = original || newDiscount;

        mapped.processor = { id: discount.id, state: ProcessorItem.SAVED };
        mapped.currentBillingCycle = discount.currentBillingCycle;

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
        currentBillingCycle: subscription.currentBillingCycle,
        statusHistory: uniqWith(
            (a, b) => isEqual(a, b),
            map(pick(["timestamp", "status"]), subscription.statusHistory)
        ),
        discounts: fieldsDiscounts(originalDiscounts, subscription.discounts),
        firstBillingDate: subscription.firstBillingDate,
        isTrial: subscription.trialPeriod,
        trialDuration: subscription.trialDuration,
        trialDurationUnit: subscription.trialDurationUnit,
        paymentMethodId: ProcessorItem.getId(
            subscription.paymentMethodToken,
            customer.paymentMethods
        ),
        nextBillingDate: subscription.nextBillingDate,
        failureCount: subscription.failureCount,
        daysPastDue: subscription.daysPastDue,
        billingPeriodEndDate: subscription.billingPeriodEndDate,
        billingPeriodStartDate: subscription.billingPeriodStartDate,
        billingDayOfMonth: subscription.billingDayOfMonth,
    };

    return pickBy(identity, response);
}

function cancel(processor, customer, subscription) {
    ProcessorItem.validateIsSaved(customer, "Customer");
    ProcessorItem.validateIsSaved(subscription, "Subscription");

    processor.emit("event", new Event(Event.SUBSCRIPTION, Event.CANCELING, subscription));

    return processor.gateway.subscription.cancel(subscription.processor.id).then(result => {
        processor.emit("event", new Event(Event.SUBSCRIPTION, Event.CANCELED, result));
        Object.assign(subscription, fields(customer, subscription.discounts, result.subscription));

        return customer;
    });
}

function save(processor, customer, subscription, index) {
    const data = processorFields(customer, subscription);
    const originalStatus =
        get("snapshotOriginal.status", subscription) || get("original.status", subscription);

    function processSave(result) {
        processor.emit("event", new Event(Event.SUBSCRIPTION, Event.SAVED, result));

        Object.assign(subscription, fields(customer, subscription.discounts, result.subscription));
        customer.markModified(`subscriptions.${index}.discounts`);

        const transactions = map(
            transactionProcessor.fields(customer),
            result.subscription.transactions
        );

        const newTransactions = differenceBy(get("_id"), transactions, customer.transactions);

        customer.transactions = concat(customer.transactions, newTransactions);

        return customer;
    }

    if (
        subscription.processor.state === ProcessorItem.CHANGED &&
        originalStatus !== braintree.Subscription.Status.Canceled &&
        subscription.status === braintree.Subscription.Status.Canceled
    ) {
        processor.emit("event", new Event(Event.SUBSCRIPTION, Event.CANCELING, data));
        return processor.gateway.subscription
            .cancel(subscription.processor.id)
            .then(BraintreeError.guard)
            .then(processSave);
    } else if (subscription.processor.state === ProcessorItem.LOCAL) {
        return Promise.resolve(customer);
    } else if (
        subscription.processor.state === ProcessorItem.CHANGED &&
        subscription.status !== braintree.Subscription.Status.Canceled
    ) {
        processor.emit("event", new Event(Event.SUBSCRIPTION, Event.UPDATING, data));
        return processor.gateway.subscription
            .update(subscription.processor.id, omit(["firstBillingDate"], data))
            .then(BraintreeError.guard)
            .then(processSave);
    } else if (subscription.processor.state === ProcessorItem.INITIAL) {
        processor.emit("event", new Event(Event.SUBSCRIPTION, Event.CREATING, data));
        return processor.gateway.subscription
            .create(data)
            .then(BraintreeError.guard)
            .then(processSave);
    } else {
        return Promise.resolve(customer);
    }
}

module.exports = {
    processorFieldsDiscounts: curry(processorFieldsDiscounts),
    processorFields: curry(processorFields),
    fieldsDiscounts: curry(fieldsDiscounts),
    fields: curry(fields),
    cancel: curry(cancel),
    save: curry(save),
};
