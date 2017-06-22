const { getOr } = require("lodash/fp");

const MESSAGES = {
    2000: "Your bank is unwilling to accept the transaction. You will need to contact your bank for more details regarding this generic decline.",
    2001: "The account did not have sufficient funds to cover the transaction amount at the time of the transaction – subsequent attempts at a later date may be successful.",
    2002: "The attempted transaction exceeds the withdrawal limit of the account. You will need to contact your bank to change the account limits or use a different payment method.",
    2003: "The attempted transaction exceeds the activity limit of the account. You will need to contact your bank to change the account limits or use a different payment method.",
    2004: "Card is expired. You will need to use a different payment method.",
    2005: "You entered an invalid payment method or made a typo in your credit card information. Please correct your payment information and attempt the transaction again – if the decline persists, they will need to contact your bank.",
    2006: "You entered an invalid payment method or made a typo in your card expiration date. Please correct your payment information and attempt the transaction again – if the decline persists, they will need to contact your bank.",
    2007: "The submitted card number is not on file with the card-issuing bank. You will need to contact your bank.",
    2008: "The submitted card number does not include the proper number of digits. Please attempt the transaction again – if the decline persists, you will need to contact your bank.",
    2009: "This decline code could indicate that the submitted card number does not correlate to an existing card-issuing bank or that there is a connectivity error with the issuer. Please attempt the transaction again – if the decline persists, you will need to contact your bank.",
    2010: "You entered in an invalid security code or made a typo in your card information. Please attempt the transaction again – if the decline persists, you will need to contact your bank.",
    2011: "You’s bank is requesting that the merchant (you) call to obtain a special authorization code in order to complete this transaction. This can result in a lengthy process – we recommend obtaining a new payment method instead. Contact our Support team for more details.",
    2012: "The card used has likely been reported as lost. You will need to contact your bank for more information.",
    2013: "The card used has likely been reported as stolen. You will need to contact your bank for more information.",
    2014: "You’s bank suspects fraud – they will need to contact your bank for more information.",
    2015: "Your bank is declining the transaction for unspecified reasons, possibly due to an issue with the card itself. They will need to contact your bank or use an alternative payment method.",
    2016: "The submitted transaction appears to be a duplicate of a previously submitted transaction and was declined to prevent charging the same card twice for the same service.",
    2017: "You requested a cancellation of a single transaction – reach out to them for more information.",
    2018: "You requested the cancellation of a recurring transaction or subscription – reach out to them for more information.",
    2019: "You’s bank declined the transaction, typically because the card in question does not support this type of transaction – for example, you used an FSA debit card for a non-healthcare related purchase. They will need to contact your bank for more information.",
    2020: "You will need to contact your bank for more information.",
    2021: "Please attempt the transaction again – if the decline persists, contact our Support team for more information.",
    2022: "The submitted card has expired or been reported lost and a new card has been issued. Reach out to your customer to obtain updated card information.",
    2023: "Your account cannot process transactions with the intended feature – for example, 3D Secure or Level 2/Level 3 data. If you believe your merchant account should be set up to accept this type of transaction, contact our Support team.",
    2024: "Your account cannot process the attempted card type. If you believe your merchant account should be set up to accept this type of card, contact our Support team.",
    2025: "Depending on your region, this response could indicate a connectivity or setup issue. Contact our Support team for more information regarding this error message.",
    2026: "Depending on your region, this response could indicate a connectivity or setup issue. Contact our Support team for more information regarding this error message.",
    2027: "This rare decline code indicates an issue with processing the amount of the transaction. You will need to contact your bank for more details.",
    2028: "There is a setup issue with your account. Contact our Support team for more information.",
    2029: "This response generally indicates that there is a problem with the submitted card. You will need to use a different payment method.",
    2030: "There is a setup issue with your account. Contact our Support team for more information.",
    2031: "The cardholder’s bank does not support $0.00 card verifications. Enable the Retry All Failed $0 option to resolve this error. Contact our Support team with questions.",
    2032: "Surcharge amount not permitted on this card. You will need to use a different payment method.",
    2033: "An error occurred when communicating with the processor. Attempt the transaction again.",
    2034: "An error occurred and the intended transaction was not completed. Attempt the transaction again.",
    2035: "Refer to the AVS response for further details.",
    2036: "An error occurred when trying to process the authorization. This response could indicate an issue with your card – contact our Support team for more information.",
    2037: "The indicated authorization has already been reversed. If you believe this to be false, contact our Support team for more information.",
    2038: "Your bank is unwilling to accept the transaction. The reasons for this response can vary – customer will need to contact your bank for more details.",
    2039: "The authorization code was not found or not provided. Please attempt the transaction again – if the decline persists, they will need to contact your bank.",
    2040: "There may be an issue with the configuration of your account. Please attempt the transaction again – if the decline persists, contact our Support team for more information.",
    2041: "The card used for this transaction requires customer approval – they will need to contact your bank.",
    2042: "There may be an issue with the configuration of your account. Please attempt the transaction again – if the decline persists, contact our Support team for more information.",
    2043: "The card-issuing bank will not allow this transaction. You will need to contact your bank for more information.",
    2044: "The card-issuing bank has declined this transaction. Please attempt the transaction again – if the decline persists, they will need to contact your bank for more information.",
    2045: "There is a setup issue with your account. Contact our Support team for more information.",
    2046: "Your bank is unwilling to accept the transaction. For credit/debit card transactions, you will need to contact your bank for more details regarding this generic decline; if this is a PayPal transaction, you will need to contact PayPal.",
    2047: "You’s card has been reported as lost or stolen by the cardholder and the card-issuing bank has requested that merchants keep the card and call the number on the back to report it. As an online merchant, you don’t have the physical card and cannot complete this request – obtain a different payment method from you.",
    2048: "The authorized amount is set to zero, is unreadable, or exceeds the allowable amount. Make sure the amount is greater than zero and in a suitable format.",
    2049: "A non-numeric value was sent with the attempted transaction. Fix errors and resubmit with the transaction with the proper SKU Number.",
    2050: "There may be an issue with your card or a temporary issue at the card-issuing bank. Please attempt the transaction again – if the decline persists, ask for an alternative payment method.",
    2051: "There may be an issue with your credit card or a temporary issue at the card-issuing bank. Please attempt the transaction again – if the decline persists, ask for an alternative payment method.",
    2053: "The card used was reported lost or stolen. You will need to contact your bank for more information or use an alternative payment method.",
    2054: "There may be an issue with your card or a temporary issue at the card-issuing bank. Please attempt the transaction again – if the decline persists, ask for an alternative payment method.",
    2055: "Contact our Support team for more information regarding this error message.",
    2056: "Contact our Support team for more information regarding this error message.",
    2057: "You will need to contact your issuing bank for more information.",
    2058: "The attempted card cannot be processed without enabling 3D Secure for your account. Contact our Support team for more information regarding this feature or contact you for an alternative payment method.",
    2059: "PayPal was unable to verify that the transaction qualifies for Seller Protection because the address was improperly formatted. You should contact PayPal for more information or use an alternative payment method.",
    2060: "Both the AVS and CVV checks failed for this transaction. You should contact PayPal for more information or use an alternative payment method.",
    2061: "There may be an issue with your card or a temporary issue at the card-issuing bank. Please attempt the transaction again – if the decline persists, ask for an alternative payment method.",
    2062: "There may be an issue with your card or a temporary issue at the card-issuing bank. Please attempt the transaction again – if the decline persists, ask for an alternative payment method.",
    2063: "You cannot process this transaction because your account is set to block certain payment types, such as eChecks or foreign currencies. If you believe you have received this decline in error, contact our Support team.",
    2064: "There may be an issue with the configuration of your account for the currency specified. Contact our Support team for more information.",
    2065: "PayPal requires that refunds are issued within 180 days of the sale. This refund cannot be successfully processed.",
    2066: "Contact PayPal’s Support team to resolve this issue with your account. Then, you can attempt the transaction again.",
    2067: "The PayPal authorization is no longer valid.",
    2068: "You'll need to contact PayPal’s Support team to resolve an issue with your account. Once resolved, you can attempt to process the transaction again.",
    2069: "The submitted PayPal transaction appears to be a duplicate of a previously submitted transaction. This decline code indicates an attempt to prevent charging the same PayPal account twice for the same service.",
    2070: "You requested a cancellation of all future transactions on your PayPal account. Please provide for more information or an alternative payment method.",
    2071: "Customer has not finalized setup of your PayPal account. Please provide for more information or an alternative payment method.",
    2072: "Customer made a typo or is attempting to use an invalid PayPal account.",
    2073: "PayPal cannot validate this transaction. This decline code will be triggered if you attempt a transaction using the email address registered with your PayPal Business account.",
    2074: "You’s payment method associated with your PayPal account was declined. Please provide for more information or an alternative payment method.",
    2075: "You’s PayPal account cannot be used for transactions at this time. You will need to contact PayPal for more information or use an alternative payment method.",
    2076: "You should contact PayPal for more information or use an alternative payment method. You may also receive this response if you create transactions using the email address registered with your PayPal Business account.",
    2077: "PayPal has declined this transaction due to risk limitations. You'll need to contact PayPal’s Support team to resolve this issue.",
    2079: "You'll need to contact our Support team to resolve an issue with your account. Once resolved, you can attempt to process the transaction again.",
    2081: "Braintree received an unsupported Pending Verification response from PayPal. Contact Braintree’s Support team to resolve a potential issues with your account settings. If there is no issue with your account, have you reach out to PayPal for more information.",
    2082: "This transaction requires you to be a resident of the same country as the merchant. Please provide for an alternative payment method.",
    2083: "This transaction requires the payer to provide a valid phone number. You should contact PayPal for more information or use an alternative payment method.",
    2084: "You must complete your PayPal account information, including submitting your phone number and all required tax information.",
    2085: "Fraud settings on your PayPal business account are blocking payments from this customer. These can be adjusted in the Block Payments section of your PayPal business account.",
    2086: "The settings on your account do not allow a transaction amount this large. They will need to contact PayPal to resolve this issue.",
    2087: "The fraud settings on your PayPal business account are blocking payments from this customer. You can adjust these settings in the Block Payments section of your PayPal business account.",
    2088: "This currency is not currently supported by your PayPal account. You can accept additional currencies by updating your PayPal profile.",
    2089: "PayPal API permissions are not set up between your PayPal business accounts. Contact our Support team for more details.",
    2090: "Your PayPal account is not set up to refund amounts higher than the original transaction amount. Contact PayPal's Support team for information on how to enable this.",
    2091: "Your PayPal account can only process transactions in the currency of your home country. Contact PayPal's Support team for more information.",
    3000: "This response could indicate a problem with the back-end processing network, not necessarily a problem with the payment method. Please attempt the transaction again – if the decline persists, contact our Support team for more information.",
};

const DEFAULT_MESSAGE =
    "Your bank is unwilling to accept the transaction. You will need to contact your bank for more details regarding this generic decline.";

class BraintreeError extends Error {
    constructor(result) {
        super(result.message);
        this.errors = result.errors;
        this.transaction = result.transaction;

        if (result.verification) {
            this.verification = result.verification;
            this.verification.processorResponseDescription = getOr(
                DEFAULT_MESSAGE,
                this.verification.processorResponseCode,
                MESSAGES
            );
        }
    }
}

BraintreeError.guard = function(result) {
    if (!result || !result.success) {
        throw new BraintreeError(result);
    }

    return result;
};

BraintreeError.MESSAGES = MESSAGES;
BraintreeError.DEFAULT_MESSAGE = DEFAULT_MESSAGE;

module.exports = BraintreeError;
