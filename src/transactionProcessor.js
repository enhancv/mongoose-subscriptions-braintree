const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const Event = require("./Event");
const BraintreeError = require("./BraintreeError");
const name = require("./name");
const addressProcessor = require("./addressProcessor");
const { curry, pick, map, pickBy, identity, get } = require("lodash/fp");

function descriminatorFields(braintreeTransaction) {
    switch (braintreeTransaction.paymentInstrumentType) {
        case "credit_card":
            const creditCard = braintreeTransaction.creditCard;
            return {
                __t: "TransactionCreditCard",
                maskedNumber:
                    creditCard.maskedNumber || `${creditCard.bin}******${creditCard.last4}`,
                countryOfIssuance: creditCard.countryOfIssuance,
                issuingBank: creditCard.issuingBank,
                cardType: creditCard.cardType,
                cardholderName: creditCard.cardholderName,
                expirationMonth: creditCard.expirationMonth,
                expirationYear: creditCard.expirationYear,
            };

        case "paypal_account":
            const paypal = braintreeTransaction.paypal || braintreeTransaction.paypalAccount || {};
            return {
                __t: "TransactionPayPalAccount",
                name: name.full(paypal.payerFirstName, paypal.payerLastName),
                payerId: paypal.payerId,
                email: paypal.payerEmail,
            };

        case "apple_pay_card":
            const applePayCard = braintreeTransaction;
            return {
                __t: "TransactionApplePayCard",
                cardType: applePayCard.cardType,
                paymentInstrumentName: get("paymentInstrumentName", applePayCard),
                expirationMonth: applePayCard.expirationMonth,
                expirationYear: applePayCard.expirationYear,
            };

        case "android_pay_card":
            const androidPayCard = braintreeTransaction;
            return {
                __t: "AndroidPayCard",
                sourceCardLast4: androidPayCard.sourceCardLast4,
                virtualCardLast4: androidPayCard.virtualCardLast4,
                sourceCardType: androidPayCard.sourceCardType,
                virtualCardType: androidPayCard.virtualCardType,
                expirationMonth: androidPayCard.expirationMonth,
                expirationYear: androidPayCard.expirationYear,
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

function voidTransaction(processor, customer, transaction) {
    ProcessorItem.validateIsSaved(customer);
    ProcessorItem.validateIsSaved(transaction);

    function processRefund(result) {
        processor.emit("event", new Event(Event.TRANSACTION, Event.VOIDED, result));

        customer.transactions = customer.transactions.map(transaction =>
            transaction.id === result.transaction.id
                ? fields(customer, result.transaction)
                : transaction
        );
        return customer;
    }

    processor.emit("event", new Event(Event.TRANSACTION, Event.VOID));

    return processor.gateway.transaction
        .void(transaction.processor.id)
        .then(BraintreeError.guard)
        .then(processRefund);
}

module.exports = {
    fields: curry(fields),
    refund: curry(refund),
    void: curry(voidTransaction),
};
