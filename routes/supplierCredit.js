// routes/supplierCredit.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CreditInvoice = require('../models/CreditInvoice');
const Supplier = require('../models/Supplier');
const Payment = require('../models/Payment'); // for recent payments
const { ensureAuthenticated } = require('../middleware/auth');

// GET /supplier-credit – show main page
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Fetch all invoices with supplier details
    const invoices = await CreditInvoice.find()
      .populate('supplierId')
      .sort({ createdAt: -1 });

    // Fetch all suppliers (for the new credit purchase dropdown)
    const suppliers = await Supplier.find().sort({ companyName: 1 });

    // Fetch recent payments (last 10, with supplier and invoice details)
    const recentPayments = await Payment.find()
      .populate('supplierId', 'companyName')
      .populate('invoiceId', 'invoiceNumber')
      .sort({ paymentDate: -1 })
      .limit(10);

    // Calculate aggregates
    let totalCredit = 0;
    let pendingCredit = 0;
    let overdueCredit = 0;
    const now = new Date();
    invoices.forEach(inv => {
      totalCredit += inv.totalAmount;
      if (inv.outstanding > 0) {
        if (inv.dueDate && new Date(inv.dueDate) < now) {
          overdueCredit += inv.outstanding;
        } else {
          pendingCredit += inv.outstanding;
        }
      }
    });

    // Paid this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paymentsThisMonth = await Payment.find({ paymentDate: { $gte: startOfMonth } });
    const paidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);

    // Default dates for new credit purchase form
    const purchaseDateDefault = now.toISOString().split('T')[0];
    const dueDateDefault = new Date(now.setDate(now.getDate() + 15)).toISOString().split('T')[0];

    res.render('supplier-credit', {
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
      success_msg: req.session.success_msg,
      error_msg: req.session.error_msg
    });

    // Clear flash messages after rendering
    req.session.success_msg = null;
    req.session.error_msg = null;
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

// POST /supplier-credit/invoices – create new credit purchase (with optional initial payment)
router.post('/invoices', ensureAuthenticated, async (req, res) => {
  try {
    const {
      supplierId,
      invoiceNumber,
      purchaseDate,
      dueDate,
      totalAmount,
      description,
      paymentTerms,
      initialPayment
    } = req.body;

    if (!supplierId || !invoiceNumber || !totalAmount) {
      throw new Error('Missing required fields');
    }

    const paidAmount = Number(initialPayment) || 0;
    if (paidAmount > totalAmount) {
      throw new Error('Initial payment cannot exceed total amount');
    }

    const outstanding = totalAmount - paidAmount;
    let status = 'Pending';
    if (outstanding === 0) status = 'Paid';
    else if (paidAmount > 0) status = 'Partially Paid';

    const invoice = new CreditInvoice({
      supplierId,
      invoiceNumber,
      purchaseDate: purchaseDate || new Date(),
      dueDate: dueDate || new Date(Date.now() + 15*24*60*60*1000),
      totalAmount,
      paidAmount,
      outstanding,
      description,
      paymentTerms,
      status
    });

    await invoice.save();

    // If initial payment > 0, record a payment automatically
    if (paidAmount > 0) {
      const Payment = require('../models/Payment');
      const payment = new Payment({
        supplierId,
        invoiceId: invoice._id,
        amount: paidAmount,
        paymentMethod: 'Cash', // default, can be changed later
        paymentDate: new Date(),
        reference: 'Initial payment',
        recordedBy: req.user._id
      });
      await payment.save();
    }

    req.session.success_msg = `Credit purchase ${invoiceNumber} recorded successfully.`;
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/supplier-credit');
});

// Keep the JSON endpoints for compatibility (optional – comment if not needed)
router.get('/api/invoices', ensureAuthenticated, async (req, res) => {
  const invoices = await CreditInvoice.find().populate('supplierId');
  res.json(invoices);
});

router.get('/api/suppliers/:id/outstanding', ensureAuthenticated, async (req, res) => {
  const invoices = await CreditInvoice.find({
    supplierId: req.params.id,
    status: { $ne: 'Paid' }
  });
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
  res.json({ supplierId: req.params.id, totalOutstanding, invoices });
});

module.exports = router;