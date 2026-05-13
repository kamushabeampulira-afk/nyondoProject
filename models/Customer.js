const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true, 
    unique: true 
  },
  nin: { 
    type: String 
  },
  email: {
    type: String,
  },
  address: { 
     type: String,
  },
  customerType: { 
    type: String, 
    enum: ['Walk-in', 'Contractor', 'Wholesale', 'Deposit Scheme'], default: 'Walk-in' 
  },
  creditLimit: { 
    type: Number, 
    default: 0 
  },
  totalPurchases: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);