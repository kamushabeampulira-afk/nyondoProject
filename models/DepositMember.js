const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', required: true 
  },
  productName: { 
    type: String, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true 
  },
  unitPrice: { 
    type: Number, 
    required: true 
  },
  targetAmount: { 
    type: Number, 
    required: true 
  },
  savedAmount: { 
    type: Number, 
    default: 0 
  },
  requiresDelivery: { 
    type: Boolean, 
    default: true 
  },
  deliveryFee: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ['Saving', 'Goal Reached', 'Picked Up'], 
    default: 'Saving' },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const depositMemberSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true 
  },
  nin: { 
    type: String, 
    required: true, 
    match: [/^[A-Za-z]{2}\d{14}$/, "NIN must have 2 letters followed by 14 digits"]
  },
  phone: { 
    type: String, 
    required: true,
    match: [/^0\d{9}$/, "Phone number must be 10 digits and start with 0"] 
  },
  address: String,
  employer: String,
  balance: { 
    type: Number, 
    default: 0 },
  goals: [goalSchema],
  joinedAt: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  }
});

module.exports = mongoose.models.DepositMember || mongoose.model('DepositMember', depositMemberSchema);