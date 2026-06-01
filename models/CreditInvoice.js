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
    default: 0,
  },
  description: String,
  paymentTerms: String,
  status: {
    type: String,
    enum: ["Pending", "Partially Paid", "Paid", "Overdue"],
    default: "Pending",
  },
  stockTransactionId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "StockTransaction",
  default: null,
},
  createdAt: { type: Date, default: Date.now },
});

creditInvoiceSchema.pre("save", async function () {
  this.totalAmount = Number(this.totalAmount) || 0;
  this.paidAmount  = Number(this.paidAmount)  || 0;
  this.outstanding = this.totalAmount - this.paidAmount;

  if (this.outstanding <= 0) {
    this.status = "Paid";
  } else if (this.paidAmount > 0) {
    this.status = "Partially Paid";
  }
  // Note: "Overdue" is set by date logic in the routes/views, not here
});

module.exports = mongoose.models.CreditInvoice
  || mongoose.model("CreditInvoice", creditInvoiceSchema);