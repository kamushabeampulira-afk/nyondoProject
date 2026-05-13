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
  paymentTerms: { 
    type: String, 
    enum: ['Net 30', 'Net 15', 'Net 7', 'Cash on Delivery'], 
    default: 'Net 30' 
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