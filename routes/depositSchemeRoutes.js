const express = require('express');
const router = express.Router();
const DepositMember = require('../models/DepositMember');
const DepositTransaction = require('../models/DepositTransaction');
const Product = require('../models/Product');
const { isManagerOrAdmin } = require('../middleware/auth');

// ========= MAIN PAGE =========
router.get('/', isManagerOrAdmin, async (req, res) => {
  try {
    const members = await DepositMember.find();
    const products = await Product.find({ productName: { $in: [/Cement/i, /Iron Bar/i, /Iron Sheet/i] }, currentStock: { $gt: 0 } });
    const totalDepositsAgg = await DepositTransaction.aggregate([{ $match: { type: 'deposit' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const totalPickupsAgg = await DepositTransaction.aggregate([{ $match: { type: 'pickup' } }, { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }]);
    const currentBalance = members.reduce((sum, m) => sum + m.balance, 0);
    res.render('deposit-scheme', {
      members,
      products,
      activeMembers: members.length,
      totalDeposits: totalDepositsAgg[0]?.total || 0,
      totalPickups: totalPickupsAgg[0]?.total || 0,
      currentBalance,
      user: req.user
    });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/dashboard');
  }
});

// ========= MEMBERS LIST =========
router.get('/members', isManagerOrAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = { $or: [{ fullName: { $regex: search, $options: 'i' } }, { nin: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }] };
    }
    const members = await DepositMember.find(query).sort({ joinedAt: -1 });
    res.render('deposit-members', { members, search, user: req.user });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// ========= REGISTER FORM =========
router.get('/register', isManagerOrAdmin, (req, res) => {
  res.render('deposit-register', { user: req.user });
});

router.post('/register', isManagerOrAdmin, async (req, res) => {
  try {
    const { fullName, nin, phone, address, employer } = req.body;
    const existing = await DepositMember.findOne({ $or: [{ nin }, { phone }] });
    if (existing) throw new Error('Member with same NIN or phone already exists');
    const member = new DepositMember({ fullName, nin, phone, address, employer, balance: 0, status: 'Active' });
    await member.save();
    req.flash('success_msg', `Member ${member.fullName} registered successfully!`);
    res.redirect('/deposit-scheme/members');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme/register');
  }
});

// ========= RECENT TRANSACTIONS =========
router.get('/transactions', isManagerOrAdmin, async (req, res) => {
  try {
    const transactions = await DepositTransaction.find().populate('memberId', 'fullName').sort({ createdAt: -1 }).limit(50);
    res.render('deposit-transactions', { transactions, user: req.user });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// ========= DEPOSIT (POST) =========
router.post('/deposit', isManagerOrAdmin, async (req, res) => {
  try {
    const { memberId, amount, paymentMethod } = req.body;
    if (!memberId || !amount || amount < 1000) throw new Error('Invalid deposit amount');
    const member = await DepositMember.findById(memberId);
    if (!member) throw new Error('Member not found');
    member.balance += Number(amount);
    await member.save();
    const transaction = new DepositTransaction({
      memberId, type: 'deposit', amount: Number(amount),
      description: `Deposit via ${paymentMethod || 'Cash'}`,
      balanceAfter: member.balance
    });
    await transaction.save();
    req.flash('success_msg', `Deposit of ${Number(amount).toLocaleString()} UGX recorded for ${member.fullName}.`);
    res.redirect('/deposit-scheme');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// ========= PICKUP (POST) =========
router.post('/pickup', isManagerOrAdmin, async (req, res) => {
  try {
    const { memberId, productId, quantity } = req.body;
    if (!memberId || !productId || !quantity || quantity < 1) throw new Error('Invalid pickup data');
    const member = await DepositMember.findById(memberId);
    if (!member) throw new Error('Member not found');
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');
    if (product.currentStock < quantity) throw new Error(`Only ${product.currentStock} units of ${product.productName} in stock`);
    const total = product.unitPrice * quantity;
    if (member.balance < total) throw new Error(`Insufficient balance. Required: ${total.toLocaleString()} UGX`);
    product.currentStock -= quantity;
    await product.save();
    member.balance -= total;
    await member.save();
    const transaction = new DepositTransaction({
      memberId, type: 'pickup', amount: -total,
      description: `${quantity} x ${product.productName}`,
      productDetails: { productName: product.productName, quantity, unitPrice: product.unitPrice },
      balanceAfter: member.balance
    });
    await transaction.save();
    req.flash('success_msg', `Pickup successful! ${quantity} x ${product.productName} (${total.toLocaleString()} UGX).`);
    res.redirect('/deposit-scheme');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// GET /deposit-scheme/member-statement – View statement for a specific member
router.get('/member-statement', isManagerOrAdmin, async (req, res) => {
  try {
    const { memberId, range } = req.query;
    const membersList = await DepositMember.find().sort({ fullName: 1 });

    let targetMember = null;
    if (memberId) targetMember = await DepositMember.findById(memberId);
    else if (membersList.length) targetMember = membersList[0];

    if (!targetMember) {
      return res.render('member-statement', { member: null, membersList, user: req.user });
    }

    // Build transaction query with date filter
    let query = { memberId: targetMember._id };
    let startDate = null;
    const now = new Date();
    if (range === '30days') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 30);
    } else if (range === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'last3months') {
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 3);
    }
    if (startDate) query.createdAt = { $gte: startDate };

    const transactions = await DepositTransaction.find(query).sort({ createdAt: -1 });

    // Calculate totals
    let totalDeposits = 0, totalPickups = 0;
    transactions.forEach(tx => {
      if (tx.type === 'deposit') totalDeposits += tx.amount;
      else totalPickups += Math.abs(tx.amount);
    });
    const lastTransactionDate = transactions.length ? transactions[0].createdAt.toLocaleDateString() : null;

    res.render('member-statement', {
      member: targetMember,
      membersList,
      transactions,
      balance: targetMember.balance,
      totalDeposits,
      totalPickups,
      lastTransactionDate,
      rangeFilter: range || 'all',
      user: req.user
    });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

module.exports = router;