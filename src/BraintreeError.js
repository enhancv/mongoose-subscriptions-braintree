class BraintreeError extends Error {
    constructor(result) {
        super(result.message);
        this.errors = result.errors;
        this.transaction = result.transaction;
    }
}

module.exports = BraintreeError;
