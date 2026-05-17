const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  company: {
    name: { type: String, default: "NYONDO General Hardware LTD" },
    phone: String,
    email: String,
    address: String,
    tin: String,
  },
  financial: {
    taxRate: { 
      type: Number, 
      default: 18 
    },
    currency: { 
      type: String, 
      default: "UGX" 
    },
    lowStockThreshold: { 
      type: Number, 
      default: 15 
    },
    defaultPaymentTerms: { 
      type: String, 
      default: "Net 15" 
    },
  },
  delivery: {
    freeThreshold: {
      type: Number,
      default: 500000,
    },
    baseFee: {
      type: Number,
      default: 30000,
    },
    freeDistance: {
      type: Number,
      default: 10,
    },
  },
  security: {
    twoFactor: {
      type: Boolean,
      default: true,
    },
    sessionTimeout: {
      type: Number,
      default: 30,
    },
    minPasswordLength: {
      type: Number,
      default: 8,
    },
  },
});

module.exports =
  mongoose.models.Setting || mongoose.model("Setting", settingSchema);
