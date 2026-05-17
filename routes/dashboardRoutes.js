const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const DepositMember = require('../models/DepositMember');
const CreditInvoice = require('../models/CreditInvoice');

router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    const todaySalesAgg = await Sale.aggregate([
      { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);
    const todaySales = todaySalesAgg[0]?.total || 0;

    const products = await Product.find();
    const stockValue = products.reduce((sum, p) => sum + (p.currentStock * p.unitCost), 0);

    const creditAgg = await CreditInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$outstanding' } } }
    ]);
    const creditBalance = creditAgg[0]?.total || 0;

    const depositMembers = await DepositMember.countDocuments();
    const lowStockCount = products.filter(p => p.currentStock <= (p.reorderLevel || 15) && p.currentStock > 0).length;
    const transactionsToday = await Sale.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });
    const pendingInvoices = await CreditInvoice.countDocuments({ outstanding: { $gt: 0 } });

    res.render('dashboard', {
      user: req.user,
      todaySales,
      stockValue,
      creditBalance,
      depositMembers,
      lowStockCount,
      transactionsToday,
      pendingInvoices
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to load dashboard data');
    res.redirect('/dashboard');
  }
});

module.exports = router;