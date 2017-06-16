const AbstractProcessor = require("mongoose-subscriptions").AbstractProcessor;
const customerProcessor = require("./customerProcessor");
const addressProcessor = require("./addressProcessor");
const paymentMethodProcessor = require("./paymentMethodProcessor");
const subscriptionProcessor = require("./subscriptionProcessor");
const transactionProcessor = require("./transactionProcessor");

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
        const saveAddress = addressProcessor.save(this, customer);
        const savePaymentMethod = paymentMethodProcessor.save(this, customer);
        const saveSubscription = subscriptionProcessor.save(this, customer);

        return customerProcessor
            .save(this, customer)
            .then(() => Promise.all(customer.addresses.map(saveAddress)))
            .then(() => Promise.all(customer.paymentMethods.map(savePaymentMethod)))
            .then(() => Promise.all(customer.subscriptions.map(saveSubscription)))
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

BraintreeProcessor.customer = customerProcessor;
BraintreeProcessor.address = addressProcessor;
BraintreeProcessor.paymentMethod = paymentMethodProcessor;
BraintreeProcessor.subscription = subscriptionProcessor;
BraintreeProcessor.transaction = transactionProcessor;

module.exports = BraintreeProcessor;
