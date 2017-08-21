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

function saveCollection(name, saveItem, customer) {
    return some(isChanged, customer[name])
        ? Promise.all(customer[name].map(saveItem(customer))).then(() => customer.save())
        : Promise.resolve();
}

function saveCustomer(saveItem, customer) {
    return isChanged(customer) ? saveItem(customer).then(() => customer.save()) : Promise.resolve();
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
            .then(() => saveCollection("addresses", addressProcessor.save(this), customer))
            .then(() =>
                saveCollection("paymentMethods", paymentMethodProcessor.save(this), customer)
            )
            .then(() => saveCollection("subscriptions", subscriptionProcessor.save(this), customer))
            .then(() => customer);
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
