class BraintreeError extends Error {
    constructor(result) {
        super(result.message);
        this.errors = result.errors;
        this.transaction = result.transaction;
    }
}

BraintreeError.guard = function(result) {
    if (!result || !result.success) {
        throw new BraintreeError(result);
    }

    return result;
};

module.exports = BraintreeError;
