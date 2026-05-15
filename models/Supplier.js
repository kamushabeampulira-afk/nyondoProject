const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  companyName: { 
    type: String, 
    required: true, 
    unique: true 
  },
  contactPerson: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true 
  },
  email: String,
  address: String,
  paymentStatus: { 
    type: String, 
    enum: ['Fully Paid','Credit'], 
    default: 'Fully Paid' 
  },
  creditLimit: { 
    type: Number, 
    default: 0 
  },
  productsSupplied: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);