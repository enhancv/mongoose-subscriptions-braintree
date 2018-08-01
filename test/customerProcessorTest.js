const assert = require("assert");
const sinon = require("sinon");
const braintree = require("braintree");
const Customer = require("mongoose-subscriptions").Customer;
const ProcessorItem = require("mongoose-subscriptions").Schema.ProcessorItem;
const customerProcessor = require("../src/customerProcessor");

describe("customerProcessor", () => {
    beforeEach(function() {
        this.customer = new Customer({
            name: "Pesho",
            email: "seer@example.com",
            ipAddress: "10.0.0.2",
            processor: {
                id: "64601260",
                state: "saved",
            },
            defaultPaymentMethodId: "three",
        });

        this.customerResult = {
            success: true,
            customer: {
                id: "64601260",
                firstName: "Pesho",
                lastName: "Peshev",
                email: "seer@example.com",
                phone: "+3593809324",
                customFields: {
                    ipAddress: "10.0.0.2",
                },
            },
        };
    });

    it("processorFields should map models to braintree data", () => {
        const customer = {
            name: "Pesho Peshev",
            email: "seer@example.com",
            phone: "+3593809324",
            ipAddress: "10.0.0.2",
            defaultPaymentMethodId: "three",
        };

        const fields = customerProcessor.processorFields(customer);

        const expected = {
            firstName: "Pesho",
            lastName: "Peshev",
            email: "seer@example.com",
            phone: "+3593809324",
            customFields: {
                ipAddress: "10.0.0.2",
                additionalEvidenceCountry: null,
                additionalEvidenceType: null,
            },
        };

        assert.deepEqual(fields, expected);
    });

    it("fields should map result data into a model", function() {
        const fields = customerProcessor.fields(this.customerResult.customer);

        const expected = {
            processor: {
                id: "64601260",
                state: "saved",
            },
            name: "Pesho Peshev",
            email: "seer@example.com",
            phone: "+3593809324",
            ipAddress: "10.0.0.2",
        };

        assert.deepEqual(fields, expected);
    });

    it("save should call create endpoint on new address", function() {
        const gateway = {
            customer: {
                create: sinon.stub().resolves(this.customerResult),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        this.customer.processor = { id: null, state: ProcessorItem.INITIAL };

        return customerProcessor.save(processor, this.customer).then(customer => {
            sinon.assert.calledWith(
                processor.emit,
                "event",
                sinon.match.has("name", "customer").and(sinon.match.has("action", "saved"))
            );
            sinon.assert.calledOnce(gateway.customer.create);
            sinon.assert.calledWith(gateway.customer.create, sinon.match.object);
            assert.deepEqual(customer.processor.toObject(), {
                id: "64601260",
                state: ProcessorItem.SAVED,
            });
        });
    });

    it("save should be a noop if the state has not changed", function() {
        const gateway = {};
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        return customerProcessor.save(processor, this.customer).then(customer => {
            assert.equal(customer, this.customer);
            sinon.assert.neverCalledWith(
                processor.emit,
                "event",
                sinon.match.has("name", "customer")
            );
        });
    });

    it("save should call update endpoint on existing address", function() {
        const gateway = {
            customer: {
                update: sinon.stub().resolves(this.customerResult),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        this.customer.processor.state = ProcessorItem.CHANGED;

        return customerProcessor.save(processor, this.customer).then(customer => {
            sinon.assert.calledWith(
                processor.emit,
                "event",
                sinon.match.has("name", "customer").and(sinon.match.has("action", "saved"))
            );
            sinon.assert.calledOnce(gateway.customer.update);
            sinon.assert.calledWith(gateway.customer.update, "64601260", sinon.match.object);
            assert.deepEqual("Pesho Peshev", customer.name);
        });
    });

    it("save should send a rejection on api error", function() {
        const apiError = new Error("error");

        const gateway = {
            customer: {
                update: sinon.stub().rejects(apiError),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        this.customer.processor.state = ProcessorItem.CHANGED;

        return customerProcessor.save(processor, this.customer).catch(error => {
            sinon.assert.neverCalledWith(
                processor.emit,
                "event",
                sinon.match.has("action", "saved")
            );
            assert.equal(error, apiError);
        });
    });

    it("save should send a rejection on api result failure", function() {
        const gateway = {
            customer: {
                update: sinon.stub().resolves({ success: false, message: "some error" }),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        this.customer.processor.state = ProcessorItem.CHANGED;

        return customerProcessor.save(processor, this.customer).catch(error => {
            sinon.assert.neverCalledWith(
                processor.emit,
                "event",
                sinon.match.has("action", "saved")
            );
            sinon.assert.match(error, { message: "some error" });
        });
    });

    it("save should load customer information correctly", () => {
        const result = {
            id: "54243350",
            merchantId: "535ykvjyw9zkrkhw",
            firstName: "Pesho",
            lastName: "Peshev",
            company: null,
            email: "seer@example.com",
            phone: "+35988911111",
            fax: null,
            website: null,
            createdAt: "2017-03-21T16:05:38Z",
            updatedAt: "2017-03-21T16:05:40Z",
            customFields: { ipAddress: "10.0.0.2" },
            addresses: [
                {
                    id: "mk",
                    customerId: "54243350",
                    firstName: "Pesho",
                    lastName: "Peshev Stoevski",
                    company: "Example company",
                    streetAddress: "Tsarigradsko Shose 4",
                    extendedAddress: "floor 3",
                    locality: "Sofia",
                    region: null,
                    postalCode: "1000",
                    countryCodeAlpha2: "BG",
                    countryCodeAlpha3: "BGR",
                    countryCodeNumeric: "100",
                    countryName: "Bulgaria",
                    createdAt: "2017-03-21T16:05:39Z",
                    updatedAt: "2017-03-21T16:05:39Z",
                },
            ],
            paymentMethods: [
                new braintree.CreditCard({
                    billingAddress: {
                        id: "mk",
                        customerId: "54243350",
                        firstName: "Pesho",
                        lastName: "Peshev Stoevski",
                        company: "Example company",
                        streetAddress: "Tsarigradsko Shose 4",
                        extendedAddress: "floor 3",
                        locality: "Sofia",
                        region: null,
                        postalCode: "1000",
                        countryCodeAlpha2: "BG",
                        countryCodeAlpha3: "BGR",
                        countryCodeNumeric: "100",
                        countryName: "Bulgaria",
                        createdAt: "2017-03-21T16:05:39Z",
                        updatedAt: "2017-03-21T16:05:39Z",
                    },
                    bin: "401288",
                    cardType: "Visa",
                    cardholderName: null,
                    commercial: "Unknown",
                    countryOfIssuance: "",
                    createdAt: "2017-03-21T16:05:40Z",
                    customerId: "54243350",
                    customerLocation: "International",
                    debit: "Unknown",
                    default: true,
                    durbinRegulated: "Unknown",
                    expirationMonth: "12",
                    expirationYear: "2020",
                    healthcare: "Unknown",
                    issuingBank: "Unknown",
                    last4: "1881",
                    payroll: "Unknown",
                    prepaid: "No",
                    productId: "Unknown",
                    subscriptions: [
                        {
                            addOns: [],
                            balance: "0.00",
                            billingDayOfMonth: 21,
                            billingPeriodEndDate: "2017-04-20",
                            billingPeriodStartDate: "2017-03-21",
                            createdAt: "2017-03-21T16:05:41Z",
                            updatedAt: "2017-03-21T16:05:42Z",
                            currentBillingCycle: 1,
                            daysPastDue: null,
                            discounts: [
                                {
                                    amount: "1.49",
                                    currentBillingCycle: 1,
                                    id: "DiscountCoupon",
                                    name: "DiscountCoupon",
                                    neverExpires: false,
                                    numberOfBillingCycles: 1,
                                    quantity: 1,
                                },
                            ],
                            failureCount: 0,
                            firstBillingDate: "2017-03-21",
                            id: "8ddgnr",
                            merchantAccountId: "enhancv",
                            neverExpires: true,
                            nextBillAmount: "14.90",
                            nextBillingPeriodAmount: "14.90",
                            nextBillingDate: "2017-04-21",
                            numberOfBillingCycles: null,
                            paidThroughDate: "2017-04-20",
                            paymentMethodToken: "78vfpd",
                            planId: "monthly",
                            price: "14.90",
                            status: "Canceled",
                            trialDuration: null,
                            trialDurationUnit: null,
                            trialPeriod: false,
                            descriptor: {
                                name: "Enhancv*Pro Plan",
                                phone: "0888415433",
                                url: "enhancv.com",
                            },
                            transactions: [
                                {
                                    id: "mejztshp",
                                    status: "settled",
                                    type: "sale",
                                    currencyIsoCode: "USD",
                                    amount: "14.90",
                                    merchantAccountId: "enhancvUSD",
                                    subMerchantAccountId: null,
                                    masterMerchantAccountId: null,
                                    orderId: null,
                                    createdAt: "2016-11-26T11:30:42Z",
                                    updatedAt: "2016-11-26T15:20:18Z",
                                    customer: {
                                        id: "631665305",
                                        firstName: "Galya",
                                        lastName: "Titova",
                                        company: null,
                                        email: "galya.titova@example.com",
                                        website: null,
                                        phone: "998866527",
                                        fax: null,
                                    },
                                    billing: {
                                        id: null,
                                        firstName: null,
                                        lastName: null,
                                        company: null,
                                        streetAddress: null,
                                        extendedAddress: null,
                                        locality: null,
                                        region: null,
                                        postalCode: null,
                                        countryName: null,
                                        countryCodeAlpha2: null,
                                        countryCodeAlpha3: null,
                                        countryCodeNumeric: null,
                                    },
                                    refundId: null,
                                    refundIds: [],
                                    refundedTransactionId: null,
                                    partialSettlementTransactionIds: [],
                                    authorizedTransactionId: null,
                                    settlementBatchId: "2016-11-26_enhancvUSD_2",
                                    shipping: {
                                        id: null,
                                        firstName: null,
                                        lastName: null,
                                        company: null,
                                        streetAddress: null,
                                        extendedAddress: null,
                                        locality: null,
                                        region: null,
                                        postalCode: null,
                                        countryName: null,
                                        countryCodeAlpha2: null,
                                        countryCodeAlpha3: null,
                                        countryCodeNumeric: null,
                                    },
                                    customFields: "",
                                    avsErrorResponseCode: null,
                                    avsPostalCodeResponseCode: "I",
                                    avsStreetAddressResponseCode: "I",
                                    cvvResponseCode: "I",
                                    gatewayRejectionReason: null,
                                    processorAuthorizationCode: null,
                                    processorResponseCode: "1000",
                                    processorResponseText: "Approved",
                                    additionalProcessorResponse: null,
                                    voiceReferralNumber: null,
                                    purchaseOrderNumber: null,
                                    taxAmount: null,
                                    taxExempt: false,
                                    creditCard: {
                                        token: "gx532ng",
                                        bin: null,
                                        last4: null,
                                        cardType: null,
                                        expirationMonth: "",
                                        expirationYear: "",
                                        customerLocation: null,
                                        cardholderName: null,
                                        imageUrl:
                                            "https://assets.braintreegateway.com/payment_method_logo/unknown.png?environment=production",
                                        prepaid: "Unknown",
                                        healthcare: "Unknown",
                                        debit: "Unknown",
                                        durbinRegulated: "Unknown",
                                        commercial: "Unknown",
                                        payroll: "Unknown",
                                        issuingBank: "Unknown",
                                        countryOfIssuance: "Unknown",
                                        productId: "Unknown",
                                        uniqueNumberIdentifier: null,
                                        venmoSdk: false,
                                        maskedNumber: "null******null",
                                        expirationDate: "/",
                                    },
                                    statusHistory: [
                                        {
                                            timestamp: "2016-11-26T11:30:47Z",
                                            status: "authorized",
                                            amount: "14.90",
                                            user: null,
                                            transactionSource: "recurring",
                                        },
                                        {
                                            timestamp: "2016-11-26T11:30:47Z",
                                            status: "submitted_for_settlement",
                                            amount: "14.90",
                                            user: null,
                                            transactionSource: "recurring",
                                        },
                                        {
                                            timestamp: "2016-11-26T11:30:51Z",
                                            status: "settling",
                                            amount: "14.90",
                                            user: null,
                                            transactionSource: "recurring",
                                        },
                                        {
                                            timestamp: "2016-11-26T15:20:18Z",
                                            status: "settled",
                                            amount: "14.90",
                                            user: null,
                                            transactionSource: "",
                                        },
                                    ],
                                    planId: "monthly",
                                    subscriptionId: "kmkrs6",
                                    subscription: {
                                        billingPeriodEndDate: "2016-12-25",
                                        billingPeriodStartDate: "2016-11-26",
                                    },
                                    addOns: [],
                                    discounts: [],
                                    descriptor: {
                                        name: "Enhancv*Pro Plan",
                                        phone: "0888415433",
                                        url: "enhancv.com",
                                    },
                                    recurring: true,
                                    channel: null,
                                    serviceFeeAmount: null,
                                    escrowStatus: null,
                                    disbursementDetails: {
                                        disbursementDate: null,
                                        settlementAmount: null,
                                        settlementCurrencyIsoCode: null,
                                        settlementCurrencyExchangeRate: null,
                                        fundsHeld: null,
                                        success: null,
                                    },
                                    disputes: [],
                                    paymentInstrumentType: "paypal_account",
                                    processorSettlementResponseCode: "4000",
                                    processorSettlementResponseText: "Confirmed",
                                    threeDSecureInfo: null,
                                    paypal: {
                                        token: "gx532ng",
                                        payerEmail: "galya.titova@example.com",
                                        paymentId: "PAY-81203918203918023981238",
                                        authorizationId: "6B074018L74681356",
                                        imageUrl:
                                            "https://assets.braintreegateway.com/payment_method_logo/paypal.png?environment=production",
                                        debugId: "f240a8f49f74b",
                                        payeeEmail: null,
                                        customField: null,
                                        payerId: "9R3DZ2WGPDSVF",
                                        payerFirstName: "Galina",
                                        payerLastName: "Titova",
                                        payerStatus: null,
                                        sellerProtectionStatus: "INELIGIBLE",
                                        captureId: "3E974735W36687313",
                                        refundId: null,
                                        transactionFeeAmount: "0.81",
                                        transactionFeeCurrencyIsoCode: "USD",
                                        description: null,
                                    },
                                    paypalAccount: {
                                        token: "gx532ng",
                                        payerEmail: "galya.titova@gmail.com",
                                        paymentId: "PAY-86028987VJ577132LLA4XEYY",
                                        authorizationId: "6B074018L74681356",
                                        imageUrl:
                                            "https://assets.braintreegateway.com/payment_method_logo/paypal.png?environment=production",
                                        debugId: "f240a8f49f74b",
                                        payeeEmail: null,
                                        customField: null,
                                        payerId: "9R3DZ2WGPDSVC",
                                        payerFirstName: "Galina",
                                        payerLastName: "Titova",
                                        payerStatus: null,
                                        sellerProtectionStatus: "INELIGIBLE",
                                        captureId: "3E974735W36687313",
                                        refundId: null,
                                        transactionFeeAmount: "0.81",
                                        transactionFeeCurrencyIsoCode: "USD",
                                        description: null,
                                    },
                                    coinbaseAccount: {},
                                    applePayCard: {},
                                    androidPayCard: {},
                                },
                                {
                                    id: "bz4dxms9",
                                    status: "submitted_for_settlement",
                                    type: "credit",
                                    currencyIsoCode: "USD",
                                    amount: "9.91",
                                    merchantAccountId: "enhancv",
                                    subMerchantAccountId: null,
                                    masterMerchantAccountId: null,
                                    orderId: null,
                                    createdAt: "2017-03-21T16:05:46Z",
                                    updatedAt: "2017-03-21T16:05:46Z",
                                    customer: {
                                        id: "54243350",
                                        firstName: "Pesho",
                                        lastName: "Peshev",
                                        company: null,
                                        email: "seer@example.com",
                                        website: null,
                                        phone: "+35988911111",
                                        fax: null,
                                    },
                                    billing: {
                                        id: "mk",
                                        firstName: "Pesho",
                                        lastName: "Peshev Stoevski",
                                        company: "Example company",
                                        streetAddress: "Tsarigradsko Shose 4",
                                        extendedAddress: "floor 3",
                                        locality: "Sofia",
                                        region: null,
                                        postalCode: "1000",
                                        countryName: "Bulgaria",
                                        countryCodeAlpha2: "BG",
                                        countryCodeAlpha3: "BGR",
                                        countryCodeNumeric: "100",
                                    },
                                    refundId: null,
                                    refundIds: [],
                                    refundedTransactionId: "9j8kpk4c",
                                    partialSettlementTransactionIds: [],
                                    authorizedTransactionId: null,
                                    settlementBatchId: null,
                                    shipping: {
                                        id: null,
                                        firstName: null,
                                        lastName: null,
                                        company: null,
                                        streetAddress: null,
                                        extendedAddress: null,
                                        locality: null,
                                        region: null,
                                        postalCode: null,
                                        countryName: null,
                                        countryCodeAlpha2: null,
                                        countryCodeAlpha3: null,
                                        countryCodeNumeric: null,
                                    },
                                    customFields: "",
                                    avsErrorResponseCode: null,
                                    avsPostalCodeResponseCode: "A",
                                    avsStreetAddressResponseCode: "A",
                                    cvvResponseCode: "A",
                                    gatewayRejectionReason: null,
                                    processorAuthorizationCode: null,
                                    processorResponseCode: "1002",
                                    processorResponseText: "Processed",
                                    additionalProcessorResponse: null,
                                    voiceReferralNumber: null,
                                    purchaseOrderNumber: null,
                                    taxAmount: null,
                                    taxExempt: false,
                                    creditCard: {
                                        token: "78vfpd",
                                        bin: "401288",
                                        last4: "1881",
                                        cardType: "Visa",
                                        expirationMonth: "12",
                                        expirationYear: "2020",
                                        customerLocation: "International",
                                        cardholderName: null,
                                        imageUrl:
                                            "https://assets.braintreegateway.com/payment_method_logo/visa.png?environment=sandbox",
                                        prepaid: "No",
                                        healthcare: "Unknown",
                                        debit: "Unknown",
                                        durbinRegulated: "Unknown",
                                        commercial: "Unknown",
                                        payroll: "Unknown",
                                        issuingBank: "Unknown",
                                        countryOfIssuance: "",
                                        productId: "Unknown",
                                        uniqueNumberIdentifier: "c120b95808f3883e808397f5c7eec515",
                                        venmoSdk: false,
                                    },
                                    statusHistory: [
                                        {
                                            timestamp: "2017-03-21T16:05:46Z",
                                            status: "submitted_for_settlement",
                                            amount: "9.91",
                                            user: "kerin@enhancv.com",
                                            transactionSource: "api",
                                        },
                                    ],
                                    planId: null,
                                    subscriptionId: "8ddgnr",
                                    subscription: {
                                        billingPeriodEndDate: null,
                                        billingPeriodStartDate: null,
                                    },
                                    addOns: [],
                                    discounts: [],
                                    descriptor: {
                                        name: null,
                                        phone: null,
                                        url: null,
                                    },
                                    recurring: null,
                                    channel: null,
                                    serviceFeeAmount: null,
                                    escrowStatus: null,
                                    disbursementDetails: {
                                        disbursementDate: null,
                                        settlementAmount: null,
                                        settlementCurrencyIsoCode: null,
                                        settlementCurrencyExchangeRate: null,
                                        fundsHeld: null,
                                        success: null,
                                    },
                                    disputes: [],
                                    paymentInstrumentType: "credit_card",
                                    processorSettlementResponseCode: "",
                                    processorSettlementResponseText: "",
                                    threeDSecureInfo: null,
                                },
                                {
                                    id: "k5qwjsr0",
                                    status: "submitted_for_settlement",
                                    type: "credit",
                                    currencyIsoCode: "USD",
                                    amount: "3.50",
                                    merchantAccountId: "enhancv",
                                    subMerchantAccountId: null,
                                    masterMerchantAccountId: null,
                                    orderId: null,
                                    createdAt: "2017-03-21T16:05:45Z",
                                    updatedAt: "2017-03-21T16:05:45Z",
                                    customer: {
                                        id: "54243350",
                                        firstName: "Pesho",
                                        lastName: "Peshev",
                                        company: null,
                                        email: "seer@example.com",
                                        website: null,
                                        phone: "+35988911111",
                                        fax: null,
                                    },
                                    billing: {
                                        id: "mk",
                                        firstName: "Pesho",
                                        lastName: "Peshev Stoevski",
                                        company: "Example company",
                                        streetAddress: "Tsarigradsko Shose 4",
                                        extendedAddress: "floor 3",
                                        locality: "Sofia",
                                        region: null,
                                        postalCode: "1000",
                                        countryName: "Bulgaria",
                                        countryCodeAlpha2: "BG",
                                        countryCodeAlpha3: "BGR",
                                        countryCodeNumeric: "100",
                                    },
                                    refundId: null,
                                    refundIds: [],
                                    refundedTransactionId: "9j8kpk4c",
                                    partialSettlementTransactionIds: [],
                                    authorizedTransactionId: null,
                                    settlementBatchId: null,
                                    shipping: {
                                        id: null,
                                        firstName: null,
                                        lastName: null,
                                        company: null,
                                        streetAddress: null,
                                        extendedAddress: null,
                                        locality: null,
                                        region: null,
                                        postalCode: null,
                                        countryName: null,
                                        countryCodeAlpha2: null,
                                        countryCodeAlpha3: null,
                                        countryCodeNumeric: null,
                                    },
                                    customFields: "",
                                    avsErrorResponseCode: null,
                                    avsPostalCodeResponseCode: "A",
                                    avsStreetAddressResponseCode: "A",
                                    cvvResponseCode: "A",
                                    gatewayRejectionReason: null,
                                    processorAuthorizationCode: null,
                                    processorResponseCode: "1002",
                                    processorResponseText: "Processed",
                                    additionalProcessorResponse: null,
                                    voiceReferralNumber: null,
                                    purchaseOrderNumber: null,
                                    taxAmount: null,
                                    taxExempt: false,
                                    creditCard: {
                                        token: "78vfpd",
                                        bin: "401288",
                                        last4: "1881",
                                        cardType: "Visa",
                                        expirationMonth: "12",
                                        expirationYear: "2020",
                                        customerLocation: "International",
                                        cardholderName: null,
                                        imageUrl:
                                            "https://assets.braintreegateway.com/payment_method_logo/visa.png?environment=sandbox",
                                        prepaid: "No",
                                        healthcare: "Unknown",
                                        debit: "Unknown",
                                        durbinRegulated: "Unknown",
                                        commercial: "Unknown",
                                        payroll: "Unknown",
                                        issuingBank: "Unknown",
                                        countryOfIssuance: "",
                                        productId: "Unknown",
                                        uniqueNumberIdentifier: "c120b95808f3883e808397f5c7eec515",
                                        venmoSdk: false,
                                    },
                                    statusHistory: [
                                        {
                                            timestamp: "2017-03-21T16:05:45Z",
                                            status: "submitted_for_settlement",
                                            amount: "3.50",
                                            user: "kerin@enhancv.com",
                                            transactionSource: "api",
                                        },
                                    ],
                                    planId: null,
                                    subscriptionId: "8ddgnr",
                                    subscription: {
                                        billingPeriodEndDate: null,
                                        billingPeriodStartDate: null,
                                    },
                                    addOns: [],
                                    discounts: [],
                                    descriptor: {
                                        name: null,
                                        phone: null,
                                        url: null,
                                    },
                                    recurring: null,
                                    channel: null,
                                    serviceFeeAmount: null,
                                    escrowStatus: null,
                                    disbursementDetails: {
                                        disbursementDate: null,
                                        settlementAmount: null,
                                        settlementCurrencyIsoCode: null,
                                        settlementCurrencyExchangeRate: null,
                                        fundsHeld: null,
                                        success: null,
                                    },
                                    disputes: [],
                                    paymentInstrumentType: "credit_card",
                                    processorSettlementResponseCode: "",
                                    processorSettlementResponseText: "",
                                    threeDSecureInfo: null,
                                },
                                {
                                    id: "9j8kpk4c",
                                    status: "settled",
                                    type: "sale",
                                    currencyIsoCode: "USD",
                                    amount: "13.41",
                                    merchantAccountId: "enhancv",
                                    subMerchantAccountId: null,
                                    masterMerchantAccountId: null,
                                    orderId: null,
                                    createdAt: "2017-03-21T16:05:41Z",
                                    updatedAt: "2017-03-21T16:05:44Z",
                                    customer: {
                                        id: "54243350",
                                        firstName: "Pesho",
                                        lastName: "Peshev",
                                        company: null,
                                        email: "seer@example.com",
                                        website: null,
                                        phone: "+35988911111",
                                        fax: null,
                                    },
                                    billing: {
                                        id: "mk",
                                        firstName: "Pesho",
                                        lastName: "Peshev Stoevski",
                                        company: "Example company",
                                        streetAddress: "Tsarigradsko Shose 4",
                                        extendedAddress: "floor 3",
                                        locality: "Sofia",
                                        region: null,
                                        postalCode: "1000",
                                        countryName: "Bulgaria",
                                        countryCodeAlpha2: "BG",
                                        countryCodeAlpha3: "BGR",
                                        countryCodeNumeric: "100",
                                    },
                                    refundId: "k5qwjsr0",
                                    refundIds: ["k5qwjsr0", "bz4dxms9"],
                                    refundedTransactionId: null,
                                    partialSettlementTransactionIds: [],
                                    authorizedTransactionId: null,
                                    settlementBatchId: "2017-03-21_enhancv_70",
                                    shipping: {
                                        id: null,
                                        firstName: null,
                                        lastName: null,
                                        company: null,
                                        streetAddress: null,
                                        extendedAddress: null,
                                        locality: null,
                                        region: null,
                                        postalCode: null,
                                        countryName: null,
                                        countryCodeAlpha2: null,
                                        countryCodeAlpha3: null,
                                        countryCodeNumeric: null,
                                    },
                                    customFields: "",
                                    avsErrorResponseCode: null,
                                    avsPostalCodeResponseCode: "M",
                                    avsStreetAddressResponseCode: "M",
                                    cvvResponseCode: "I",
                                    gatewayRejectionReason: null,
                                    processorAuthorizationCode: "084R16",
                                    processorResponseCode: "1000",
                                    processorResponseText: "Approved",
                                    additionalProcessorResponse: null,
                                    voiceReferralNumber: null,
                                    purchaseOrderNumber: null,
                                    taxAmount: null,
                                    taxExempt: false,
                                    creditCard: {
                                        token: "78vfpd",
                                        bin: "401288",
                                        last4: "1881",
                                        cardType: "Visa",
                                        expirationMonth: "12",
                                        expirationYear: "2020",
                                        customerLocation: "International",
                                        cardholderName: null,
                                        imageUrl:
                                            "https://assets.braintreegateway.com/payment_method_logo/visa.png?environment=sandbox",
                                        prepaid: "No",
                                        healthcare: "Unknown",
                                        debit: "Unknown",
                                        durbinRegulated: "Unknown",
                                        commercial: "Unknown",
                                        payroll: "Unknown",
                                        issuingBank: "Unknown",
                                        countryOfIssuance: "",
                                        productId: "Unknown",
                                        uniqueNumberIdentifier: "c120b95808f3883e808397f5c7eec515",
                                        venmoSdk: false,
                                    },
                                    statusHistory: [
                                        {
                                            timestamp: "2017-03-21T16:05:41Z",
                                            status: "authorized",
                                            amount: "13.41",
                                            user: "kerin@enhancv.com",
                                            transactionSource: "recurring",
                                        },
                                        {
                                            timestamp: "2017-03-21T16:05:41Z",
                                            status: "submitted_for_settlement",
                                            amount: "13.41",
                                            user: "kerin@enhancv.com",
                                            transactionSource: "recurring",
                                        },
                                        {
                                            timestamp: "2017-03-21T16:05:44Z",
                                            status: "settled",
                                            amount: "13.41",
                                            user: null,
                                            transactionSource: "",
                                        },
                                    ],
                                    planId: "monthly",
                                    subscriptionId: "8ddgnr",
                                    subscription: {
                                        billingPeriodEndDate: "2017-04-20",
                                        billingPeriodStartDate: "2017-03-21",
                                    },
                                    addOns: [],
                                    discounts: [
                                        {
                                            amount: "1.49",
                                            currentBillingCycle: 1,
                                            id: "DiscountCoupon",
                                            name: "DiscountCoupon",
                                            neverExpires: false,
                                            numberOfBillingCycles: 1,
                                            quantity: 1,
                                        },
                                    ],
                                    descriptor: {
                                        name: "Enhancv*Pro Plan",
                                        phone: "0888415433",
                                        url: "enhancv.com",
                                    },
                                    recurring: true,
                                    channel: null,
                                    serviceFeeAmount: null,
                                    escrowStatus: null,
                                    disbursementDetails: {
                                        disbursementDate: null,
                                        settlementAmount: null,
                                        settlementCurrencyIsoCode: null,
                                        settlementCurrencyExchangeRate: null,
                                        fundsHeld: null,
                                        success: null,
                                    },
                                    disputes: [],
                                    paymentInstrumentType: "credit_card",
                                    processorSettlementResponseCode: "",
                                    processorSettlementResponseText: "",
                                    threeDSecureInfo: null,
                                },
                            ],
                            statusHistory: [
                                {
                                    timestamp: "2017-03-21T16:05:42Z",
                                    status: "Canceled",
                                    user: "kerin@enhancv.com",
                                    subscriptionSource: "api",
                                    balance: "0.00",
                                    price: "14.90",
                                    currencyIsoCode: "USD",
                                    planId: "monthly",
                                },
                                {
                                    timestamp: "2017-03-21T16:05:42Z",
                                    status: "Canceled",
                                    user: "kerin@enhancv.com",
                                    subscriptionSource: "api",
                                    balance: "0.00",
                                    price: "14.90",
                                    currencyIsoCode: "USD",
                                    planId: "monthly",
                                },
                                {
                                    timestamp: "2017-03-21T16:05:41Z",
                                    status: "Active",
                                    user: "kerin@enhancv.com",
                                    subscriptionSource: "api",
                                    balance: "0.00",
                                    price: "14.90",
                                    currencyIsoCode: "USD",
                                    planId: "monthly",
                                },
                                {
                                    timestamp: "2017-03-21T16:05:41Z",
                                    status: "Active",
                                    user: "kerin@enhancv.com",
                                    subscriptionSource: "api",
                                    balance: "0.00",
                                    price: "14.90",
                                    currencyIsoCode: "USD",
                                    planId: "monthly",
                                },
                            ],
                        },
                    ],
                    token: "78vfpd",
                    uniqueNumberIdentifier: "c120b95808f3883e808397f5c7eec515",
                    updatedAt: "2017-03-21T16:05:40Z",
                    venmoSdk: false,
                    verifications: [],
                    maskedNumber: "401288******1881",
                    expirationDate: "12/2020",
                }),
            ],
        };

        const gateway = {
            customer: {
                find: sinon.stub().resolves(result),
            },
        };
        const plan = {
            processorId: "monthly",
            price: 14.9,
            level: 1,
            billingFrequency: 1,
        };
        const processor = {
            gateway,
            plan: sinon.stub().returns(plan),
            emit: sinon.spy(),
        };

        const customer = new Customer({
            processor: { id: "123", state: "saved" },
        });

        return customerProcessor
            .load(processor, customer)
            .then(customer => {
                assert.equal(
                    customer.paymentMethods[0].billingAddressId,
                    customer.addresses[0]._id
                );
                assert.equal(
                    customer.subscriptions[0].paymentMethodId,
                    customer.paymentMethods[0]._id
                );
                assert.equal(
                    customer.subscriptions[0].processor.id,
                    result.paymentMethods[0].subscriptions[0].id
                );
                assert.equal(
                    customer.paymentMethods[0].processor.id,
                    result.paymentMethods[0].token
                );

                assert.deepEqual(
                    customer.transactions.map(item => item._id),
                    result.paymentMethods[0].subscriptions[0].transactions.map(item => item.id)
                );

                assert.equal("9R3DZ2WGPDSVF", customer.transactions[0].payerId);
                assert.equal("401288******1881", customer.transactions[1].maskedNumber);

                return customerProcessor.load(processor, customer);
            })
            .then(customer => {
                assert.equal(
                    customer.paymentMethods[0].billingAddressId,
                    customer.addresses[0]._id
                );
                assert.equal(
                    customer.subscriptions[0].paymentMethodId,
                    customer.paymentMethods[0]._id
                );
                assert.equal(
                    customer.subscriptions[0].processor.id,
                    result.paymentMethods[0].subscriptions[0].id
                );
                assert.equal(
                    customer.paymentMethods[0].processor.id,
                    result.paymentMethods[0].token
                );

                assert.deepEqual(
                    customer.transactions.map(item => item._id),
                    result.paymentMethods[0].subscriptions[0].transactions.map(item => item.id)
                );
            });
    });

    it("save should send a rejection on api error", function() {
        const apiError = new Error("error");

        const gateway = {
            customer: {
                find: sinon.stub().rejects(apiError),
            },
        };
        const processor = {
            gateway,
            emit: sinon.spy(),
        };

        return customerProcessor.load(processor, this.customer).catch(error => {
            sinon.assert.neverCalledWith(
                processor.emit,
                "event",
                sinon.match.has("action", "loaded")
            );
            assert.equal(error, apiError);
        });
    });
});
