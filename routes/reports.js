const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const DepositMember = require('../models/DepositMember');
const DepositTransaction = require('../models/DepositTransaction');
const CreditInvoice = require('../models/CreditInvoice');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Example aggregates – you'll need to compute from your models
    const totalRevenue = 42500000; // placeholder
    const grossProfit = 12800000;
    const avgOrderValue = 124500;
    const activeCustomers = 187;

    // Sales summary (last 3 days example)
    const salesSummary = [
      { date: '10 Apr 2026', sales: 4285000, transactions: 32, avgOrder: 133906 },
      { date: '09 Apr 2026', sales: 3620000, transactions: 28, avgOrder: 129285 },
      { date: '08 Apr 2026', sales: 4150000, transactions: 35, avgOrder: 118571 }
    ];

    // Stock summary by category
    const stockSummary = [
      { category: 'Cement', totalValue: 1890000, itemsCount: 2, status: 'Low Stock' },
      { category: 'Steel/Iron', totalValue: 2450000, itemsCount: 4, status: 'Adequate' },
      { category: 'Roofing', totalValue: 6300000, itemsCount: 3, status: 'Adequate' }
    ];

    // Deposit scheme top members
    const topDepositMembers = [
      { fullName: 'Okello Peter', balance: 675000, depositCount: 4, pickupCount: 0 },
      { fullName: 'Mukasa John', balance: 450000, depositCount: 3, pickupCount: 1 }
    ];

    // Supplier credit summary
    const supplierCreditSummary = [
      { supplierName: 'Tororo Cement', amount: 3500000, dueDate: new Date('2026-05-15'), status: 'Pending' },
      { supplierName: 'Hima Cement', amount: 2200000, dueDate: new Date('2026-04-20'), status: 'Overdue' }
    ];

    // Chart data
    const chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const chartRevenue = [28500000, 32400000, 38700000, 42500000, 46800000, 51200000];
    const chartProfit = [7560000, 8920000, 10850000, 12800000, 14200000, 15600000];

    res.render('reports', {
      totalRevenue, grossProfit, avgOrderValue, activeCustomers,
      salesSummary, stockSummary, topDepositMembers, supplierCreditSummary,
      chartLabels, chartRevenue, chartProfit,
      totalSkus: 47, lowStockCount: 6, outOfStockCount: 2,
      depositMembers: 47, totalDeposits: 6180000, activeDepositBalance: 4250000,
      totalCredit: 12500000, pendingCredit: 8200000, overdueCredit: 2000000,
      todaySales: 4280000, weeklySales: 18200000, monthlySales: 42500000,
      user: req.user
    });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

module.exports = router;