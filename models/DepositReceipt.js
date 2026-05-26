const mongoose = require('mongoose');

const depositReceiptSchema = new mongoose.Schema({
  memberId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DepositMember', required: true },
  goalId: { type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  productName: { 
    type: String, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true 
  },
  amountDeposited: { 
    type: Number, 
    required: true 
  },
  savedAmount: { 
    type: Number, 
    required: true 
  },
  targetAmount: { 
    type: Number, 
    required: true 
  },
  remainingAmount: { 
    type: Number, 
    required: true 
  },
  deliveryFee: { 
    type: Number, 
    default: 0 
  },
  requiresDelivery: { 
    type: Boolean, 
    default: false 
  },
  paymentMethod: { 
    type: String, 
    default: 'Cash' 
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

module.exports = mongoose.models.DepositReceipt || mongoose.model('DepositReceipt', depositReceiptSchema);