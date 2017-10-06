const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const Event = require("./Event");
const BraintreeError = require("./BraintreeError");
const name = require("./name");
const addressProcessor = require("./addressProcessor");
const { get, pickBy, identity, curry } = require("lodash/fp");

function processorFields(customer, paymentMethod) {
    const response = {
        billingAddressId: ProcessorItem.getProcessorId(
            paymentMethod.billingAddressId,
            customer.addresses
        ),
        paymentMethodNonce: paymentMethod.nonce,
        options: customer.defaultPaymentMethodId === paymentMethod.id
            ? { makeDefault: true }
            : null,
    };

    return pickBy(identity, response);
}

function descriminatorFields(paymentMethod) {
    switch (paymentMethod.constructor.name) {
        case "CreditCard":
            return {
                __t: "CreditCard",
                maskedNumber: paymentMethod.maskedNumber,
                countryOfIssuance: paymentMethod.countryOfIssuance,
                issuingBank: paymentMethod.issuingBank,
                cardType: paymentMethod.cardType,
                cardholderName: paymentMethod.cardholderName,
                expirationMonth: paymentMethod.expirationMonth,
                expirationYear: paymentMethod.expirationYear,
            };

        case "PayPalAccount":
            return {
                __t: "PayPalAccount",
                payerInfo: paymentMethod.payerInfo,
                email: paymentMethod.email,
            };

        case "ApplePayCard":
            return {
                __t: "ApplePayCard",
                cardType: paymentMethod.cardType,
                paymentInstrumentName: paymentMethod.paymentInstrumentName,
                expirationMonth: paymentMethod.expirationMonth,
                expirationYear: paymentMethod.expirationYear,
            };

        case "AndroidPayCard":
            return {
                __t: "AndroidPayCard",
                sourceCardLast4: paymentMethod.sourceCardLast4,
                virtualCardLast4: paymentMethod.virtualCardLast4,
                sourceCardType: paymentMethod.sourceCardType,
                virtualCardType: paymentMethod.virtualCardType,
                expirationMonth: paymentMethod.expirationMonth,
                expirationYear: paymentMethod.expirationYear,
            };
    }
}

function fields(customer, paymentMethod) {
    const billingAddressId = get("billingAddress.id", paymentMethod);

    const response = Object.assign({}, descriminatorFields(paymentMethod), {
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

function isPaymentMethodChanged(customer, paymentMethod) {
    const original = paymentMethod.original || {};
    const originalCustomer = customer.original || {};
    const nonceChanged = paymentMethod.nonce !== original.nonce && paymentMethod.nonce;
    const billingAddressIdChanged = paymentMethod.billingAddressId !== original.billingAddressId;
    const defaultPaymentMethodChanged =
        customer.defaultPaymentMethodId !== originalCustomer.defaultPaymentMethodId &&
        customer.defaultPaymentMethodId === paymentMethod.id;

    return Boolean(nonceChanged || billingAddressIdChanged || defaultPaymentMethodChanged);
}

function save(processor, customer, paymentMethod, index) {
    const data = processorFields(customer, paymentMethod);

    function processSave(result) {
        processor.emit("event", new Event(Event.PAYMENT_METHOD, Event.SAVED, result));

        if (!paymentMethod.billingAddressId && result.paymentMethod.billingAddress) {
            const newAddress = customer.addresses.create(
                addressProcessor.fields(result.paymentMethod.billingAddress)
            );
            paymentMethod.billingAddressId = newAddress.id;
            customer.addresses.push(newAddress);
        }

        customer.paymentMethods[index] = customer.paymentMethods.create(
            Object.assign(paymentMethod.toObject(), fields(customer, result.paymentMethod), {
                nonce: null,
            })
        );
        customer.markModified(`paymentMethods.${index}`);

        return customer;
    }

    if (
        paymentMethod.processor.state === ProcessorItem.CHANGED &&
        isPaymentMethodChanged(customer, paymentMethod)
    ) {
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
    isPaymentMethodChanged: curry(isPaymentMethodChanged),
    save: curry(save),
};
