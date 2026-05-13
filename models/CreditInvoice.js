const mongoose = require("mongoose");

const creditInvoiceSchema = new mongoose.Schema({
  invoiceNumber: { 
    type: String, 
    unique: true, 
    required: true 
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: true,
  },
  purchaseDate: {
    type: Date,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
  outstanding: {
    type: Number,
    default: function () {
      return this.totalAmount - this.paidAmount;
    },
  },
  description: String,
  paymentTerms: String,
  status: {
    type: String,
    enum: ["Pending", "Partially Paid", "Paid", "Overdue"],
    default: "Pending",
  },
  createdAt: { type: Date, default: Date.now },
});

creditInvoiceSchema.pre("save", function (next) {
  this.outstanding = this.totalAmount - this.paidAmount;
  next();
});

module.exports =
  mongoose.models.CreditInvoice ||
  mongoose.model("CreditInvoice", creditInvoiceSchema);
