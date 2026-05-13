// routes/suppliers.js
const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const CreditInvoice = require('../models/CreditInvoice'); // for outstanding calculation
const { ensureAuthenticated } = require('../middleware/auth');

// GET /suppliers – show list
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ companyName: 1 });
    const totalSuppliers = suppliers.length;

    // Calculate total outstanding and per‑supplier outstanding
    let totalOutstanding = 0;
    let overduePayments = 0; // you can calculate based on overdue invoices
    const suppliersWithOutstanding = await Promise.all(suppliers.map(async (sup) => {
      const invoices = await CreditInvoice.find({ supplierId: sup._id, status: { $ne: 'Paid' } });
      const outstanding = invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
      totalOutstanding += outstanding;
      // For simplicity, set overduePayments as part of total outstanding that is past due (implement as needed)
      return { ...sup.toObject(), outstandingBalance: outstanding };
    }));

    // Placeholder for active orders (you can replace with real data if you have an "orders" model)
    const activeOrders = 4;

    res.render('suppliers', {
      suppliers: suppliersWithOutstanding,
      totalSuppliers,
      totalOutstanding,
      totalOutstandingDisplay: totalOutstanding,
      overduePayments,
      activeOrders,
      user: req.user
    });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

// POST /suppliers – add new supplier
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { companyName, contactPerson, phone, email, address, paymentTerms, creditLimit, productsSupplied } = req.body;
    const existing = await Supplier.findOne({ companyName });
    if (existing) throw new Error('Supplier with that company name already exists');
    const supplier = new Supplier({
      companyName, contactPerson, phone, email, address, paymentTerms, creditLimit, productsSupplied
    });
    await supplier.save();
    req.session.success_msg = `Supplier ${companyName} added successfully!`;
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/suppliers');
});

// Optional: GET /suppliers/:id/edit – show edit form (create later)
router.get('/:id/edit', ensureAuthenticated, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw new Error('Supplier not found');
    res.render('supplier-edit', { supplier, user: req.user });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/suppliers');
  }
});

// Optional: POST /suppliers/:id – update supplier
router.post('/:id', ensureAuthenticated, async (req, res) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, req.body, { runValidators: true });
    req.session.success_msg = 'Supplier updated successfully';
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/suppliers');
});

module.exports = router;