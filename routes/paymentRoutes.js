const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Supplier = require("../models/Supplier");
const CreditInvoice = require("../models/CreditInvoice");
const Payment = require("../models/Payment");
const { isManagerOrAdmin } = require("../middleware/auth");

router.get("/record", isManagerOrAdmin, async (req, res) => {
  try {
    const { supplierId } = req.query;
    const suppliers = await Supplier.find().sort({ companyName: 1 });
    let selectedSupplier = null;
    let outstandingInvoices = [];
    if (supplierId) {
      selectedSupplier = await Supplier.findById(supplierId);
      if (selectedSupplier) {
        outstandingInvoices = await CreditInvoice.find({
          supplierId: selectedSupplier._id,
          outstanding: { $gt: 0 },
        }).sort({ dueDate: 1 });
      }
    }
    res.render("record-payment", {
      suppliers,
      selectedSupplier,
      selectedSupplierId: supplierId,
      outstandingInvoices,
      today: new Date().toISOString().split("T")[0],
      user: req.user,
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/supplier-credit");
  }
});

router.post("/record", isManagerOrAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { supplierId, invoiceId, amount, paymentMethod, paymentDate, reference } = req.body;
    if (!invoiceId || !amount || amount <= 0) throw new Error("Invalid payment data");
    const invoice = await CreditInvoice.findById(invoiceId).session(session);
    if (!invoice) throw new Error("Invoice not found");
    if (amount > invoice.outstanding) throw new Error("Payment amount exceeds outstanding balance");
    const payment = new Payment({
      supplierId: invoice.supplierId,
      invoiceId,
      amount,
      paymentMethod,
      paymentDate: paymentDate || new Date(),
      reference,
      recordedBy: req.user._id,
    });
    await payment.save({ session });
    invoice.paidAmount += Number(amount);
    invoice.outstanding = invoice.totalAmount - invoice.paidAmount;
    invoice.status = invoice.outstanding === 0 ? "Paid" : "Partially Paid";
    await invoice.save({ session });
    await session.commitTransaction();
    req.flash("success_msg", `Payment of ${Number(amount).toLocaleString()} UGX recorded for invoice ${invoice.invoiceNumber}.`);
    res.redirect(`/supplier-credit?supplierId=${invoice.supplierId}`);
  } catch (err) {
    await session.abortTransaction();
    req.flash("error_msg", err.message);
    res.redirect(`/payments/record?supplierId=${req.body.supplierId || ""}`);
  } finally {
    session.endSession();
  }
});

module.exports = router;