const mongoose = require("mongoose");

const stockTransactionSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  productName: String,
  quantityAdded: {
    type: Number,
    required: true,
    min: 1
  },
  unitCost: {
    type: Number,
    required: true
  },
  totalCost: {
    type: Number,
    default: 0
  },
  unitPrice: {
    type: Number,
    required: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    default: null
  },
  supplierName: {   
    type: String,
    default: ""
  },
  supplierPhone: String,
  factoryName: String,
  paymentStatus: {
    type: String,
    enum: ["cash", "credit"],
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balanceDue: {
    type: Number,
    default: 0
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

stockTransactionSchema.pre("save", async function () {
  this.quantityAdded = Number(this.quantityAdded) || 0;
  this.unitCost      = Number(this.unitCost)      || 0;
  this.amountPaid    = Number(this.amountPaid)    || 0;
  this.totalCost     = this.quantityAdded * this.unitCost;
  this.balanceDue    = this.totalCost - this.amountPaid;
});

module.exports = mongoose.models.StockTransaction
  || mongoose.model("StockTransaction", stockTransactionSchema);