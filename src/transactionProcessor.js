const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const Event = require("./Event");
const BraintreeError = require("./BraintreeError");
const name = require("./name");
const addressProcessor = require("./addressProcessor");
const { curry, pick, map, pickBy, identity, get } = require("lodash/fp");

function descriminatorFields(braintreeTransaction) {
    switch (braintreeTransaction.paymentInstrumentType) {
        case "credit_card":
            return {
                __t: "TransactionCreditCard",
                maskedNumber: get("creditCard.maskedNumber", braintreeTransaction),
                countryOfIssuance: get("creditCard.countryOfIssuance", braintreeTransaction),
                issuingBank: get("creditCard.issuingBank", braintreeTransaction),
                cardType: get("creditCard.cardType", braintreeTransaction),
                cardholderName: get("creditCard.cardholderName", braintreeTransaction),
                expirationMonth: get("creditCard.expirationMonth", braintreeTransaction),
                expirationYear: get("creditCard.expirationYear", braintreeTransaction),
            };

        case "paypal_account":
            return {
                __t: "TransactionPayPalAccount",
                name: name.full(
                    get("paypalAccount.payerFirstName", braintreeTransaction),
                    get("paypalAccount.payerLastName", braintreeTransaction)
                ),
                payerId: get("paypalAccount.payerId", braintreeTransaction),
                email: get("paypalAccount.payerEmail", braintreeTransaction),
            };

        case "apple_pay_card":
            return {
                __t: "TransactionApplePayCard",
                cardType: get("applePayCard.cardType", braintreeTransaction),
                paymentInstrumentName: get(
                    "applePayCard.paymentInstrumentName",
                    braintreeTransaction
                ),
                expirationMonth: get("applePayCard.expirationMonth", braintreeTransaction),
                expirationYear: get("applePayCard.expirationYear", braintreeTransaction),
            };

        case "android_pay_card":
            return {
                __t: "AndroidPayCard",
                sourceCardLast4: get("androidPayCard.sourceCardLast4", braintreeTransaction),
                virtualCardLast4: get("androidPayCard.virtualCardLast4", braintreeTransaction),
                sourceCardType: get("androidPayCard.sourceCardType", braintreeTransaction),
                virtualCardType: get("androidPayCard.virtualCardType", braintreeTransaction),
                expirationMonth: get("androidPayCard.expirationMonth", braintreeTransaction),
                expirationYear: get("androidPayCard.expirationYear", braintreeTransaction),
            };
    }
}

function fields(customer, braintreeTransaction) {
    const response = {
        _id: braintreeTransaction.id,
        processor: {
            id: braintreeTransaction.id,
            state: ProcessorItem.SAVED,
        },
        amount: braintreeTransaction.amount,
        refundedTransactionId: braintreeTransaction.refundedTransactionId,
        subscriptionId: ProcessorItem.getId(
            braintreeTransaction.subscriptionId,
            customer.subscriptions
        ),
        planProcessorId: braintreeTransaction.planId,
        billing: braintreeTransaction.billing
            ? addressProcessor.fields(braintreeTransaction.billing)
            : null,
        customer: braintreeTransaction.customer
            ? {
                  name: name.full(
                      braintreeTransaction.customer.firstName,
                      braintreeTransaction.customer.lastName
                  ),
                  phone: braintreeTransaction.customer.phone,
                  company: braintreeTransaction.customer.company,
                  email: braintreeTransaction.customer.email,
              }
            : null,
        currency: braintreeTransaction.currencyIsoCode,
        status: braintreeTransaction.status,
        statusHistory: braintreeTransaction.statusHistory,
        descriptor: pick(["name", "phone", "url"], braintreeTransaction.descriptor),
        createdAt: braintreeTransaction.createdAt,
        updatedAt: braintreeTransaction.updatedAt,
        discounts: map(
            discount => ({
                amount: discount.amount,
                name: discount.name,
            }),
            braintreeTransaction.discounts
        ),
    };

    Object.assign(response, descriminatorFields(braintreeTransaction));

    return pickBy(identity, response);
}

function refund(processor, customer, transaction, amount) {
    ProcessorItem.validateIsSaved(customer);
    ProcessorItem.validateIsSaved(transaction);

    function processRefund(result) {
        processor.emit("event", new Event(Event.TRANSACTION, Event.REFUNDED, result));

        customer.transactions.unshift(fields(customer, result.transaction));
        return customer;
    }

    processor.emit("event", new Event(Event.TRANSACTION, Event.REFUND, amount));

    if (amount) {
        return processor.gateway.transaction
            .refund(transaction.processor.id, amount)
            .then(BraintreeError.guard)
            .then(processRefund);
    } else {
        return processor.gateway.transaction
            .refund(transaction.processor.id)
            .then(BraintreeError.guard)
            .then(processRefund);
    }
}

module.exports = {
    fields: curry(fields),
    refund: curry(refund),
};
