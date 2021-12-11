const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: String,
    phoneNumber: String,
    check_in: Date,
    check_out: Date,
    Email: String,
    special_requests: String,
    numberOrder: Number,
    price: Number,
    createdAt: { type: Date, default: Date.now() }
});

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;