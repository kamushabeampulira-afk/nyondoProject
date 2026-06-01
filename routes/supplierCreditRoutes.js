const express = require("express");
const router = express.Router();
const CreditInvoice = require("../models/CreditInvoice");
const Supplier = require("../models/Supplier");
const Payment = require("../models/Payment");
const { isManagerOrAdmin } = require("../middleware/auth");

// MAIN SUPPLIER CREDIT PAGE
router.get("/", isManagerOrAdmin, async (req, res) => {
  try {
    const invoices = await CreditInvoice.find()
      .populate("supplierId")
      .sort({ createdAt: -1 });
    const suppliers = await Supplier.find().sort({ companyName: 1 });
    const recentPayments = await Payment.find()
      .populate("supplierId", "companyName")
      .populate("invoiceId", "invoiceNumber")
      .sort({ paymentDate: -1 })
      .limit(10);

    let totalCredit = 0, pendingCredit = 0, overdueCredit = 0;
    const now = new Date();
    invoices.forEach((inv) => {
      totalCredit += inv.totalAmount;
      if (inv.outstanding > 0) {
        if (inv.dueDate && new Date(inv.dueDate) < now)
          overdueCredit += inv.outstanding;
        else
          pendingCredit += inv.outstanding;
      }
    });

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paymentsThisMonth = await Payment.find({ paymentDate: { $gte: startOfMonth } });
    const paidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);

    const purchaseDateDefault = new Date().toISOString().split("T")[0];
    const dueDateDefault = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    res.render("supplier-credit", {
      invoices,
      suppliers,
      recentPayments,
      totalCredit,
      pendingCredit,
      overdueCredit,
      paidThisMonth,
      totalInvoices: invoices.length,
      purchaseDateDefault,
      dueDateDefault,
      user: req.user,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/dashboard");
  }
});

// CREATE NEW CREDIT INVOICE
router.post("/invoices", isManagerOrAdmin, async (req, res) => {
  try {
    const {
      supplierId, invoiceNumber, purchaseDate, dueDate,
      totalAmount, description, paymentTerms, initialPayment
    } = req.body;

    // Validate required fields
    if (!supplierId || supplierId.trim() === "")
      throw new Error("Please select a supplier.");
    if (!invoiceNumber || invoiceNumber.trim() === "")
      throw new Error("Invoice number is required.");
    if (!totalAmount || Number(totalAmount) <= 0)
      throw new Error("Total amount must be greater than zero.");
    if (!purchaseDate)
      throw new Error("Purchase date is required.");
    if (!dueDate)
      throw new Error("Due date is required.");

    // Validate that due date is not before purchase date
    if (new Date(dueDate) < new Date(purchaseDate))
      throw new Error("Due date cannot be before the purchase date.");

    // Check for duplicate invoice number
    const duplicateInvoice = await CreditInvoice.findOne({ invoiceNumber: invoiceNumber.trim() });
    if (duplicateInvoice)
      throw new Error(`Invoice number "${invoiceNumber}" already exists. Please use a unique invoice number.`);

    // Check supplier exists
    const supplier = await Supplier.findById(supplierId);
    if (!supplier)
      throw new Error("Selected supplier not found. Please refresh and try again.");

    const total = Number(totalAmount);
    // BUG FIX: initialPayment from a form comes as "" when empty — must default to 0
    const paidAmount = Number(initialPayment) || 0;

    if (paidAmount < 0)
      throw new Error("Initial payment cannot be negative.");
    if (paidAmount > total)
      throw new Error(`Initial payment (${paidAmount.toLocaleString()} UGX) cannot exceed total amount (${total.toLocaleString()} UGX).`);

    // Status logic (pre-save hook will also set outstanding, this is for clarity)
    let status = "Pending";
    if (paidAmount >= total) status = "Paid";
    else if (paidAmount > 0) status = "Partially Paid";

    const invoice = new CreditInvoice({
      supplierId,
      invoiceNumber: invoiceNumber.trim(),
      purchaseDate: new Date(purchaseDate),
      dueDate: new Date(dueDate),
      totalAmount: total,
      paidAmount,
      // outstanding is calculated by pre-save hook: totalAmount - paidAmount
      description: description || "",
      paymentTerms: paymentTerms || "",
      status,
    });
    await invoice.save();

    // If there was an initial payment, record it in the Payment collection too
    if (paidAmount > 0) {
      const payment = new Payment({
        supplierId,
        invoiceId: invoice._id,
        amount: paidAmount,
        paymentMethod: "Cash",
        paymentDate: new Date(),
        reference: "Initial payment on invoice creation",
        recordedBy: req.user._id,
      });
      await payment.save();
    }

    req.flash("success_msg", `Credit invoice "${invoiceNumber}" recorded successfully for ${supplier.companyName}. Outstanding: ${(total - paidAmount).toLocaleString()} UGX.`);
  } catch (err) {
    req.flash("error_msg", err.message);
  }
  res.redirect("/supplier-credit");
});

// RECORD PAYMENT AGAINST INVOICE (quick pay from the supplier credit page)
router.post("/pay/:invoiceId", isManagerOrAdmin, async (req, res) => {
  try {
    const { amount, paymentMethod, reference } = req.body;

    const payAmount = Number(amount);

    if (!payAmount || payAmount <= 0)
      throw new Error("Payment amount must be greater than zero.");

    const invoice = await CreditInvoice.findById(req.params.invoiceId).populate("supplierId", "companyName");
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.outstanding <= 0)
      throw new Error("This invoice is already fully paid.");

    
    if (payAmount > invoice.outstanding)
      throw new Error(`Payment amount (${payAmount.toLocaleString()} UGX) exceeds outstanding balance (${invoice.outstanding.toLocaleString()} UGX).`);

    if (!paymentMethod || paymentMethod.trim() === "")
      throw new Error("Please select a payment method.");

    // Update invoice — pre-save hook recalculates outstanding and status
    invoice.paidAmount += payAmount;
    // outstanding and status are recalculated by the pre-save hook on invoice.save()
    await invoice.save();

    // Record the payment
    const payment = new Payment({
      supplierId: invoice.supplierId,
      invoiceId: invoice._id,
      amount: payAmount,
      paymentMethod: paymentMethod.trim(),
      paymentDate: new Date(),
      reference: reference || "",
      recordedBy: req.user._id,
    });
    await payment.save();

    req.flash("success_msg", `Payment of ${payAmount.toLocaleString()} UGX recorded for invoice ${invoice.invoiceNumber}. Remaining: ${invoice.outstanding.toLocaleString()} UGX.`);
  } catch (err) {
    req.flash("error_msg", err.message);
  }
  res.redirect("/supplier-credit");
});

module.exports = router;