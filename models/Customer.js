const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true, 
    match: [/^0\d{9}$/, "Phone number must be 10 digits and start with 0"] 
  },
  nin: {
    type: String,
    trim: true,
    validate: {
      validator: function (value) {
        if (!value) return true;
        const normalized = value.replace(/\s+/g, '').toUpperCase();
        return /^[A-Z]{2}\d{14}$/.test(normalized);
      },
      message: "NIN must be a valid NIRA-style number with 2 letters followed by 14 digits"
    }
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: "Please enter a valid email address"
    },
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