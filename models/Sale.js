const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product' 
  },
  productName: String,
  quantity: Number,
  unitPrice: Number,
  total: Number
});

const saleSchema = new mongoose.Schema({
  invoiceNumber: { 
    type: String, 
    unique: true 
  },
  customerName: { 
    type: String, 
    default: 'Walk-in Customer' 
  },
  customerPhone: String,
  items: [saleItemSchema],
  subtotal: Number,
  deliveryFee: { 
    type: Number, 
    default: 0 
  },
  tax: { 
    type: Number, 
    default: 0 
  },
  grandTotal: Number,
  paymentMethod: { 
    type: String, 
    enum: ['Cash', 'Mobile Money', 'Credit', 'Deposit Scheme'] 
  },
  status: { 
    type: String, 
    enum: ['Paid', 'Pending', 'Completed'], 
    default: 'Paid' 
  },
  attendant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.models.Sale || mongoose.model('Sale', saleSchema);