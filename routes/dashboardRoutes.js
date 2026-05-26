const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const DepositMember = require('../models/DepositMember');
const CreditInvoice = require('../models/CreditInvoice');
const StockTransaction = require('../models/StockTransaction');
const DepositTransaction = require('../models/DepositTransaction');

router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

    // KPIs
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
    const lowStockCount = products.filter(p => p.currentStock < 15 && p.currentStock > 0).length;
    const transactionsToday = await Sale.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });
    const pendingInvoices = await CreditInvoice.countDocuments({ outstanding: { $gt: 0 } });

    // Daily sales for last 7 days (table, not chart)
    const dailySales = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      const salesData = await Sale.aggregate([
        { $match: { createdAt: { $gte: d, $lt: nextDay } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]);
      dailySales.push({
        date: d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
        total: salesData[0]?.total || 0
      });
    }

    // Sales attendant specific data
    let productsInStock = [];
    let recentSalesAttendant = [];
    if (req.user.role === 'sales' || req.user.role === 'attendant') {
      productsInStock = await Product.find({ currentStock: { $gt: 0 } })
        .select('productName currentStock unitPrice')
        .limit(20);
      recentSalesAttendant = await Sale.find({ attendant: req.user._id })
        .sort({ createdAt: -1 })
        .limit(5);
    }

    // Admin/manager recent data
    let recentSales = [];
    let recentStock = [];
    let recentDeposits = [];
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      recentSales = await Sale.find().sort({ createdAt: -1 }).limit(5).populate('attendant', 'fullName');
      recentStock = await StockTransaction.find().sort({ createdAt: -1 }).limit(5);
    }
    if (req.user.role === 'admin') {
      recentDeposits = await DepositTransaction.find().sort({ createdAt: -1 }).limit(5).populate('memberId', 'fullName');
    }

    res.render('dashboard', {
      user: req.user,
      todaySales,
      stockValue,
      creditBalance,
      depositMembers,
      lowStockCount,
      transactionsToday,
      pendingInvoices,
      dailySales,
      productsInStock,
      recentSalesAttendant,
      recentSales,
      recentStock,
      recentDeposits
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to load dashboard data');
    res.redirect('/dashboard');
  }
});

module.exports = router;