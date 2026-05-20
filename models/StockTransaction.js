const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', required: true 
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
    required: true 
  },
  unitPrice: { 
    type: Number, 
    required: true 
  },
  supplierName: { 
    type: String, 
    required: true 
  },
  supplierPhone: String,
  factoryName: String,
  paymentStatus: { 
    type: String, 
    enum: ['cash', 'credit'], 
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
    ref: 'User' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

stockTransactionSchema.pre('save', function(next) {
  this.totalCost = this.quantityAdded * this.unitCost;
  this.balanceDue = this.totalCost - this.amountPaid;
  next();
});

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);