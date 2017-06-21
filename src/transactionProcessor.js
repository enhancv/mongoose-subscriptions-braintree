const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const Event = require("./Event");
const BraintreeError = require("./BraintreeError");
const name = require("./name");
const addressProcessor = require("./addressProcessor");
const { curry, pick, map, pickBy, identity } = require("lodash/fp");

function descriminatorFields(braintreeTransaction) {
    switch (braintreeTransaction.paymentInstrumentType) {
        case "credit_card":
            return {
                __t: "TransactionCreditCard",
                maskedNumber: braintreeTransaction.creditCard.maskedNumber,
                countryOfIssuance: braintreeTransaction.creditCard.countryOfIssuance,
                issuingBank: braintreeTransaction.creditCard.issuingBank,
                cardType: braintreeTransaction.creditCard.cardType,
                cardholderName: braintreeTransaction.creditCard.cardholderName,
                expirationMonth: braintreeTransaction.creditCard.expirationMonth,
                expirationYear: braintreeTransaction.creditCard.expirationYear,
            };

        case "paypal_account":
            return {
                __t: "TransactionPayPalAccount",
                name: name.full(
                    braintreeTransaction.paypalAccount.payerFirstName,
                    braintreeTransaction.paypalAccount.payerLastName
                ),
                payerId: braintreeTransaction.paypalAccount.payerId,
                email: braintreeTransaction.paypalAccount.payerEmail,
            };

        case "apple_pay_card":
            return {
                __t: "TransactionApplePayCard",
                cardType: braintreeTransaction.applePayCard.cardType,
                paymentInstrumentName: braintreeTransaction.applePayCard.paymentInstrumentName,
                expirationMonth: braintreeTransaction.applePayCard.expirationMonth,
                expirationYear: braintreeTransaction.applePayCard.expirationYear,
            };

        case "android_pay_card":
            return {
                __t: "AndroidPayCard",
                sourceCardLast4: braintreeTransaction.androidPayCard.sourceCardLast4,
                virtualCardLast4: braintreeTransaction.androidPayCard.virtualCardLast4,
                sourceCardType: braintreeTransaction.androidPayCard.sourceCardType,
                virtualCardType: braintreeTransaction.androidPayCard.virtualCardType,
                expirationMonth: braintreeTransaction.androidPayCard.expirationMonth,
                expirationYear: braintreeTransaction.androidPayCard.expirationYear,
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
