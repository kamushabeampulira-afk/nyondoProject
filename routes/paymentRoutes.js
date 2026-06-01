const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Supplier = require("../models/Supplier");
const CreditInvoice = require("../models/CreditInvoice");
const Payment = require("../models/Payment");
const { isManagerOrAdmin } = require("../middleware/auth");

// GET /payments/record — show the payment recording form
router.get("/record", isManagerOrAdmin, async (req, res) => {
  try {
    const { supplierId } = req.query;
    const suppliers = await Supplier.find().sort({ companyName: 1 });
    let selectedSupplier = null;
    let outstandingInvoices = [];

    if (supplierId && supplierId.trim() !== "") {
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
      selectedSupplierId: supplierId || "",
      outstandingInvoices,
      today: new Date().toISOString().split("T")[0],
      user: req.user,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/supplier-credit");
  }
});

// POST /payments/record — save payment against an invoice
// BUG FIX: amount was never cast to Number() before comparison — "5000" > 100 is true in JS
//          string comparison which caused incorrect "exceeds outstanding" errors or allowed
//          wrong amounts through.
// BUG FIX: supplierId is now taken from the invoice itself (not req.body) so redirect is always correct.
// BUG FIX: Added validation for all required fields before starting the DB session.
router.post("/record", isManagerOrAdmin, async (req, res) => {
  // Validate before starting session to give cleaner error messages
  const { supplierId, invoiceId, amount, paymentMethod, paymentDate, reference } = req.body;

  // BUG FIX: Cast to Number immediately
  const payAmount = Number(amount);

  if (!invoiceId || invoiceId.trim() === "") {
    req.flash("error_msg", "Please select an invoice.");
    return res.redirect(`/payments/record?supplierId=${supplierId || ""}`);
  }
  if (!payAmount || payAmount <= 0) {
    req.flash("error_msg", "Payment amount must be greater than zero.");
    return res.redirect(`/payments/record?supplierId=${supplierId || ""}`);
  }
  if (!paymentMethod || paymentMethod.trim() === "") {
    req.flash("error_msg", "Please select a payment method.");
    return res.redirect(`/payments/record?supplierId=${supplierId || ""}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const invoice = await CreditInvoice.findById(invoiceId).session(session);
    if (!invoice) throw new Error("Invoice not found. It may have been deleted.");

    if (invoice.outstanding <= 0)
      throw new Error("This invoice is already fully paid.");

    // BUG FIX: Both sides are Numbers now — safe comparison
    if (payAmount > invoice.outstanding)
      throw new Error(`Payment amount (${payAmount.toLocaleString()} UGX) exceeds outstanding balance (${invoice.outstanding.toLocaleString()} UGX).`);

    // Validate payment date
    const pDate = paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(pDate.getTime()))
      throw new Error("Invalid payment date.");

    const payment = new Payment({
      supplierId: invoice.supplierId,   // BUG FIX: take from invoice, not from req.body
      invoiceId,
      amount: payAmount,
      paymentMethod: paymentMethod.trim(),
      paymentDate: pDate,
      reference: reference || "",
      recordedBy: req.user._id,
    });
    await payment.save({ session });

    // Update invoice — pre-save hook will recalculate outstanding and status
    invoice.paidAmount += payAmount;
    await invoice.save({ session });

    await session.commitTransaction();

    req.flash("success_msg", `Payment of ${payAmount.toLocaleString()} UGX recorded for invoice ${invoice.invoiceNumber}. Remaining: ${invoice.outstanding.toLocaleString()} UGX.`);
    res.redirect(`/supplier-credit?supplierId=${invoice.supplierId}`);
  } catch (err) {
    await session.abortTransaction();
    req.flash("error_msg", err.message);
    res.redirect(`/payments/record?supplierId=${supplierId || ""}`);
  } finally {
    session.endSession();
  }
});

module.exports = router;