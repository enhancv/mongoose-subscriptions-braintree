const AbstractProcessor = require("mongoose-subscriptions").AbstractProcessor;
const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const customerProcessor = require("./customerProcessor");
const BraintreeError = require("./BraintreeError");
const addressProcessor = require("./addressProcessor");
const paymentMethodProcessor = require("./paymentMethodProcessor");
const subscriptionProcessor = require("./subscriptionProcessor");
const transactionProcessor = require("./transactionProcessor");
const { some } = require("lodash/fp");

function isChanged(item) {
    return [ProcessorItem.CHANGED, ProcessorItem.INITIAL].includes(item.processor.state);
}

async function saveCollection(name, saveItem, customer) {
    if (!some(isChanged, customer[name])) {
        return Promise.resolve(customer);
    }

    let _customer = customer;

    for (let index = 0; index < _customer[name].length; index++) {
        _customer = await saveItem(_customer, _customer[name][index], index);
    }

    return _customer.save();
}

function saveCustomer(saveItem, customer) {
    if (!isChanged(customer)) {
        return Promise.resolve(customer);
    }

    return saveItem(customer).then(customer => customer.save());
}

class BraintreeProcessor extends AbstractProcessor {
    constructor(gateway, plans) {
        super();
        this.gateway = gateway;
        this.plans = plans || [];
    }

    load(customer) {
        return customerProcessor.load(this, customer);
    }

    save(customer) {
        return saveCustomer(customerProcessor.save(this), customer)
            .then(customer => saveCollection("addresses", addressProcessor.save(this), customer))
            .then(customer =>
                saveCollection("paymentMethods", paymentMethodProcessor.save(this), customer)
            )
            .then(customer =>
                saveCollection("subscriptions", subscriptionProcessor.save(this), customer)
            );
    }

    cancelSubscription(customer, subscriptionId) {
        return subscriptionProcessor.cancel(
            this,
            customer,
            customer.subscriptions.id(subscriptionId)
        );
    }

    refundTransaction(customer, transactionId, amount) {
        return transactionProcessor.refund(
            this,
            customer,
            customer.transactions.id(transactionId),
            amount
        );
    }

    voidTransaction(customer, transactionId) {
        return transactionProcessor.void(this, customer, customer.transactions.id(transactionId));
    }

    plan(processorId) {
        return this.plans.find(plan => plan.processorId === processorId);
    }
}

BraintreeProcessor.BraintreeError = BraintreeError;
BraintreeProcessor.customer = customerProcessor;
BraintreeProcessor.address = addressProcessor;
BraintreeProcessor.paymentMethod = paymentMethodProcessor;
BraintreeProcessor.subscription = subscriptionProcessor;
BraintreeProcessor.transaction = transactionProcessor;

module.exports = BraintreeProcessor;
