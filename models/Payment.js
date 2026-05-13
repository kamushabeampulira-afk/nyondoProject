const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  supplierId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Supplier' 
  },
  invoiceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CreditInvoice' 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  paymentMethod: { 
    type: String, 
    enum: ['Cash', 'Bank Transfer', 'Mobile Money'] 
  },
  paymentDate: { 
    type: Date, default: Date.now 
  },
  reference: String,
  recordedBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' 
  }
});

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);