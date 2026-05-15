const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CreditInvoice = require('../models/CreditInvoice');
const Supplier = require('../models/Supplier');
const Payment = require('../models/Payment');
const { isAdmin } = require('../middleware/auth');

router.get('/', isAdmin, async (req, res) => {
  try {
    const invoices = await CreditInvoice.find().populate('supplierId').sort({ createdAt: -1 });
    const suppliers = await Supplier.find().sort({ companyName: 1 });
    const recentPayments = await Payment.find()
      .populate('supplierId', 'companyName')
      .populate('invoiceId', 'invoiceNumber')
      .sort({ paymentDate: -1 })
      .limit(10);
    let totalCredit = 0, pendingCredit = 0, overdueCredit = 0;
    const now = new Date();
    invoices.forEach(inv => {
      totalCredit += inv.totalAmount;
      if (inv.outstanding > 0) {
        if (inv.dueDate && new Date(inv.dueDate) < now) overdueCredit += inv.outstanding;
        else pendingCredit += inv.outstanding;
      }
    });
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paymentsThisMonth = await Payment.find({ paymentDate: { $gte: startOfMonth } });
    const paidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);
    const purchaseDateDefault = now.toISOString().split('T')[0];
    const dueDateDefault = new Date(now.setDate(now.getDate() + 15)).toISOString().split('T')[0];
    res.render('supplier-credit', {
      invoices, suppliers, recentPayments,
      totalCredit, pendingCredit, overdueCredit, paidThisMonth,
      totalInvoices: invoices.length,
      purchaseDateDefault, dueDateDefault,
      user: req.user,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/dashboard');
  }
});

router.post('/invoices', isAdmin, async (req, res) => {
  try {
    const { supplierId, invoiceNumber, purchaseDate, dueDate, totalAmount, description, paymentTerms, initialPayment } = req.body;
    if (!supplierId || !invoiceNumber || !totalAmount) throw new Error('Missing required fields');
    const paidAmount = Number(initialPayment) || 0;
    if (paidAmount > totalAmount) throw new Error('Initial payment cannot exceed total amount');
    const outstanding = totalAmount - paidAmount;
    let status = 'Pending';
    if (outstanding === 0) status = 'Paid';
    else if (paidAmount > 0) status = 'Partially Paid';
    const invoice = new CreditInvoice({
      supplierId, invoiceNumber, purchaseDate: purchaseDate || new Date(),
      dueDate: dueDate || new Date(Date.now() + 15*24*60*60*1000),
      totalAmount, paidAmount, outstanding, description, paymentTerms, status
    });
    await invoice.save();
    if (paidAmount > 0) {
      const payment = new Payment({
        supplierId, invoiceId: invoice._id, amount: paidAmount,
        paymentMethod: 'Cash', paymentDate: new Date(),
        reference: 'Initial payment', recordedBy: req.user._id
      });
      await payment.save();
    }
    req.flash('success_msg', `Credit purchase ${invoiceNumber} recorded.`);
  } catch (err) {
    req.flash('error_msg', err.message);
  }
  res.redirect('/supplier-credit');
});

module.exports = router;