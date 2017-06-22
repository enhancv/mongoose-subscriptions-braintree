Mongoose Subscriptions Braintree
================================

[![Build Status](https://travis-ci.org/enhancv/mongoose-subscriptions-braintree.svg?branch=master)](https://travis-ci.org/enhancv/mongoose-subscriptions-braintree)
[![Code Climate](https://codeclimate.com/github/enhancv/mongoose-subscriptions-braintree/badges/gpa.svg)](https://codeclimate.com/github/enhancv/mongoose-subscriptions-braintree)
[![Test Coverage](https://codeclimate.com/github/enhancv/mongoose-subscriptions-braintree/badges/coverage.svg)](https://codeclimate.com/github/enhancv/mongoose-subscriptions-braintree/coverage)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

Braintree processor for https://github.com/enhancv/mongoose-subscriptions

Useage
------

```
yarn add mongoose-subscription-braintree
```

```javascript
const braintree = require("braintree");
const Customer = require("mongoose-subscriptions").Customer;
const BraintreeProcessor = require("mongoose-subscriptions-braintree");

const gateway = braintree.connect({ ... });
const plan = {
    processorId: 'id-plan',
    price: 4,
    billingFrequency: 3,
    level: 2,
};

// Define a processor using braintree gateway and some existing plans
// Currently the plans need to be input as plain objects to the processor
// and kept in sync with braintree plans
const processor = new BraintreeProcessor(gateway, [plan]);

const customer = new Customer({ ... });
customer.save().then(customer => customer.saveProcessor(processor));
```
