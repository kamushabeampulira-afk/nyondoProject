const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const DepositMember = require('../models/DepositMember');
const DepositTransaction = require('../models/DepositTransaction');
const CreditInvoice = require('../models/CreditInvoice');
const { isAdmin } = require('../middleware/auth');

router.get('/', isAdmin, async (req, res) => {
  try {
    const revenueAgg = await Sale.aggregate([{ $group: { _id: null, total: { $sum: '$grandTotal' } } }]);
    const totalRevenue = revenueAgg[0]?.total || 0;
    const grossProfit = totalRevenue * 0.3;
    const orderCount = await Sale.countDocuments();
    const avgOrderValue = orderCount ? totalRevenue / orderCount : 0;
    const activeCustomersAgg = await Sale.aggregate([{ $group: { _id: '$customerName' } }, { $count: 'count' }]);
    const activeCustomers = activeCustomersAgg[0]?.count || 0;

    const today = new Date();
    const days = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(); d.setDate(today.getDate() - i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const salesData = await Sale.aggregate([
        { $match: { createdAt: { $gte: d, $lt: next } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, transactions: { $sum: 1 } } }
      ]);
      const total = salesData[0]?.total || 0;
      const trans = salesData[0]?.transactions || 0;
      days.unshift({ date: d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }), sales: total, transactions: trans, avgOrder: trans ? total / trans : 0 });
    }
    const salesSummary = days;

    const categories = ['Cement', 'Steel/Iron', 'Roofing', 'Other'];
    const stockSummary = [];
    for (let cat of categories) {
      const products = await Product.find({ category: cat });
      const totalValue = products.reduce((sum, p) => sum + (p.currentStock * p.unitCost), 0);
      const itemsCount = products.length;
      const lowStock = products.filter(p => p.currentStock <= (p.reorderLevel || 15)).length;
      let status = lowStock > 0 ? 'Low Stock' : 'Adequate';
      stockSummary.push({ category: cat, totalValue, itemsCount, status });
    }

    const topDepositMembers = await DepositMember.find().sort({ balance: -1 }).limit(5);
    const topMembersFormatted = topDepositMembers.map(m => ({ fullName: m.fullName, balance: m.balance, depositCount: 0, pickupCount: 0 }));

    const now = new Date();
    const supplierCreditSummary = await CreditInvoice.find({ outstanding: { $gt: 0 } }).populate('supplierId', 'companyName').limit(5);
    const supplierCreditFormatted = supplierCreditSummary.map(inv => ({ supplierName: inv.supplierId?.companyName || 'Unknown', amount: inv.outstanding, dueDate: inv.dueDate, status: inv.dueDate < now ? 'Overdue' : 'Pending' }));

    const months = [];
    const revenue = [];
    const profit = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthSales = await Sale.aggregate([{ $match: { createdAt: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]);
      const total = monthSales[0]?.total || 0;
      months.push(d.toLocaleDateString('en', { month:'short', year:'numeric' }));
      revenue.push(total);
      profit.push(total * 0.3);
    }

    const totalSkus = await Product.countDocuments();
    const lowStockCount = (await Product.find()).filter(p => p.currentStock <= (p.reorderLevel || 15) && p.currentStock > 0).length;
    const outOfStockCount = await Product.countDocuments({ currentStock: 0 });
    const depositMembersCount = await DepositMember.countDocuments();
    const totalDepositsAgg = await DepositTransaction.aggregate([{ $match: { type: 'deposit' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const totalDeposits = totalDepositsAgg[0]?.total || 0;
    const activeDepositBalanceAgg = await DepositMember.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
    const activeDepositBalance = activeDepositBalanceAgg[0]?.total || 0;
    const totalCreditAgg = await CreditInvoice.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]);
    const totalCredit = totalCreditAgg[0]?.total || 0;
    const pendingCreditAgg = await CreditInvoice.aggregate([{ $match: { outstanding: { $gt: 0 }, dueDate: { $gte: new Date() } } }, { $group: { _id: null, total: { $sum: '$outstanding' } } }]);
    const pendingCredit = pendingCreditAgg[0]?.total || 0;
    const overdueCreditAgg = await CreditInvoice.aggregate([{ $match: { outstanding: { $gt: 0 }, dueDate: { $lt: new Date() } } }, { $group: { _id: null, total: { $sum: '$outstanding' } } }]);
    const overdueCredit = overdueCreditAgg[0]?.total || 0;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    const todaySalesAgg = await Sale.aggregate([{ $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]);
    const todaySales = todaySalesAgg[0]?.total || 0;
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay())); weekEnd.setHours(23,59,59,999);
    const weekSalesAgg = await Sale.aggregate([{ $match: { createdAt: { $gte: weekStart, $lte: weekEnd } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]);
    const weeklySales = weekSalesAgg[0]?.total || 0;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const monthEnd = new Date(); monthEnd.setMonth(monthEnd.getMonth()+1, 0); monthEnd.setHours(23,59,59,999);
    const monthSalesAgg = await Sale.aggregate([{ $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]);
    const monthlySales = monthSalesAgg[0]?.total || 0;

    res.render('reports', {
      totalRevenue, grossProfit, avgOrderValue, activeCustomers,
      salesSummary, stockSummary, topDepositMembers: topMembersFormatted,
      supplierCreditSummary: supplierCreditFormatted,
      chartLabels: months, chartRevenue: revenue, chartProfit: profit,
      totalSkus, lowStockCount, outOfStockCount,
      depositMembers: depositMembersCount, totalDeposits, activeDepositBalance,
      totalCredit, pendingCredit, overdueCredit,
      todaySales, weeklySales, monthlySales,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', err.message);
    res.redirect('/dashboard');
  }
});

module.exports = router;