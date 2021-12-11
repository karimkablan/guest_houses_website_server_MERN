const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OpinionSchema = new Schema({
    name: String,
    textOpinion : String,
    createdAt: String,
    createdAt2:String,
    numberOrder: Number,
    rating: Number
});

const Opinions = mongoose.model('Opinions',OpinionSchema);

module.exports = Opinions ; 