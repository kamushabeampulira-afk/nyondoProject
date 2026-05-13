// models/StockTransaction.js
const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: String,
  quantityAdded: { type: Number, required: true, min: 1 },
  unitCost: { type: Number, required: true },
  totalPaid: { type: Number, required: true },   // quantityAdded * unitCost
  unitPrice: { type: Number, required: true },   // new selling price (must be > unitCost)
  supplierName: { type: String, required: true },
  supplierPhone: String,
  factoryName: String,
  paymentStatus: { type: String, enum: ['cash', 'credit'], required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Auto‑calculate totalPaid
stockTransactionSchema.pre('save', function(next) {
  this.totalPaid = this.quantityAdded * this.unitCost;
  next();
});

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);