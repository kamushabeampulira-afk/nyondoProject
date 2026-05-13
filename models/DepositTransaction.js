const mongoose = require("mongoose");

const depositTransactionSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DepositMember",
    required: true,
  },
  type: {
    type: String,
    enum: ["deposit", "pickup"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: String,
  productDetails: {
    productName: String,
    quantity: Number,
    unitPrice: Number,
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports =
  mongoose.models.DepositTransaction ||
  mongoose.model("DepositTransaction", depositTransactionSchema);
