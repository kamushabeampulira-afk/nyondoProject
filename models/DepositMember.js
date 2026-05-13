const mongoose = require('mongoose');

const depositMemberSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true 
  },
  nin: { 
    type: String, 
    required: true, 
    unique: true 
  },
  phone: { 
    type: String, 
    required: true 
  },
  address: String,
  employer: String,
  balance: { 
    type: Number, 
    default: 0
  },
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