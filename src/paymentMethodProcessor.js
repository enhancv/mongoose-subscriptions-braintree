const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const Event = require("./Event");
const BraintreeError = require("./BraintreeError");
const name = require("./name");
const { get, pickBy, identity, curry } = require("lodash/fp");

function processorFields(customer, paymentMethod) {
    const response = {
        billingAddressId: paymentMethod.billingAddressId
            ? get("processor.id", customer.addresses.id(paymentMethod.billingAddressId))
            : null,
        paymentMethodNonce: paymentMethod.nonce,
        options: customer.defaultPaymentMethodId === paymentMethod.id
            ? { makeDefault: true }
            : null,
    };

    return pickBy(identity, response);
}

function fields(customer, paymentMethod) {
    const response = {};

    if (paymentMethod.constructor.name === "CreditCard") {
        Object.assign(response, {
            __t: "CreditCard",
            maskedNumber: paymentMethod.maskedNumber,
            countryOfIssuance: paymentMethod.countryOfIssuance,
            issuingBank: paymentMethod.issuingBank,
            cardType: paymentMethod.cardType,
            cardholderName: paymentMethod.cardholderName,
            expirationMonth: paymentMethod.expirationMonth,
            expirationYear: paymentMethod.expirationYear,
        });
    } else if (paymentMethod.constructor.name === "PayPalAccount") {
        Object.assign(response, {
            __t: "PayPalAccount",
            payerInfo: paymentMethod.payerInfo,
            email: paymentMethod.email,
        });
    } else if (paymentMethod.constructor.name === "ApplePayCard") {
        Object.assign(response, {
            __t: "ApplePayCard",
            cardType: paymentMethod.cardType,
            paymentInstrumentName: paymentMethod.paymentInstrumentName,
            expirationMonth: paymentMethod.expirationMonth,
            expirationYear: paymentMethod.expirationYear,
        });
    } else if (paymentMethod.constructor.name === "AndroidPayCard") {
        Object.assign(response, {
            __t: "AndroidPayCard",
            sourceCardLast4: paymentMethod.sourceCardLast4,
            virtualCardLast4: paymentMethod.virtualCardLast4,
            sourceCardType: paymentMethod.sourceCardType,
            virtualCardType: paymentMethod.virtualCardType,
            expirationMonth: paymentMethod.expirationMonth,
            expirationYear: paymentMethod.expirationYear,
        });
    }

    const billingAddressId = get("billingAddress.id", paymentMethod);

    Object.assign(response, {
        processor: {
            id: paymentMethod.token,
            state: ProcessorItem.SAVED,
        },
        billingAddressId: ProcessorItem.getId(billingAddressId, customer.addresses),
        createdAt: paymentMethod.createdAt,
        updatedAt: paymentMethod.updatedAt,
    });

    return pickBy(identity, response);
}

function save(processor, customer, paymentMethod, index) {
    const data = processorFields(customer, paymentMethod);

    function processSave(result) {
        processor.emit("event", new Event(Event.PAYMENT_METHOD, Event.SAVED, result));

        customer.paymentMethods[index] = customer.paymentMethods.create(
            Object.assign(paymentMethod.toObject(), fields(customer, result.paymentMethod), {
                nonce: null,
            })
        );
        customer.markModified(`paymentMethods.${index}`);

        return customer;
    }

    if (paymentMethod.processor.state === ProcessorItem.CHANGED) {
        processor.emit("event", new Event(Event.PAYMENT_METHOD, Event.UPDATING, data));
        return processor.gateway.paymentMethod
            .update(paymentMethod.processor.id, data)
            .then(BraintreeError.guard)
            .then(processSave);
    } else if (paymentMethod.processor.state === ProcessorItem.INITIAL) {
        data.customerId = customer.processor.id;
        processor.emit("event", new Event(Event.PAYMENT_METHOD, Event.CREATING, data));
        return processor.gateway.paymentMethod
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
