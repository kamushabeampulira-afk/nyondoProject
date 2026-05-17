// routes/depositScheme.js
const express = require('express');
const router = express.Router();
const DepositMember = require('../models/DepositMember');
const DepositTransaction = require('../models/DepositTransaction');
const Product = require('../models/Product');
const { isManagerOrAdmin } = require('../middleware/auth');   // changed

// GET /deposit-scheme – main page
router.get('/', isManagerOrAdmin, async (req, res) => {
  try {
    const members = await DepositMember.find().sort({ joinedAt: -1 });
    const transactions = await DepositTransaction.find()
      .populate('memberId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(10);
    const products = await Product.find({
      productName: { $in: [/Cement/i, /Iron Bar/i, /Iron Sheet/i] },
      currentStock: { $gt: 0 }
    }).select('_id productName unitPrice currentStock');

    let totalDeposits = 0, totalPickups = 0, currentBalance = 0;
    for (const member of members) currentBalance += member.balance;
    const allTransactions = await DepositTransaction.find();
    for (const tx of allTransactions) {
      if (tx.type === 'deposit') totalDeposits += tx.amount;
      else totalPickups += Math.abs(tx.amount);
    }

    res.render('deposit-scheme', {
      members, transactions, products,
      activeMembers: members.length,
      totalDeposits, totalPickups, currentBalance,
      user: req.user,
      success_msg: req.session.success_msg,
      error_msg: req.session.error_msg
    });

    req.session.success_msg = null;
    req.session.error_msg = null;
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

// POST /deposit-scheme/members – register member
router.post('/members', isManagerOrAdmin, async (req, res) => {
  try {
    const { fullName, nin, phone, address, employer } = req.body;
    const existing = await DepositMember.findOne({ $or: [{ nin }, { phone }] });
    if (existing) throw new Error('Member with same NIN or phone already exists');
    const member = new DepositMember({ fullName, nin, phone, address, employer, balance: 0, status: 'Active' });
    await member.save();
    req.session.success_msg = `Member ${member.fullName} registered successfully!`;
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/deposit-scheme');
});

// POST /deposit-scheme/deposit – record deposit
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
    req.session.success_msg = `Deposit of ${Number(amount).toLocaleString()} UGX recorded for ${member.fullName}. New balance: ${member.balance.toLocaleString()} UGX`;
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/deposit-scheme');
});

// POST /deposit-scheme/pickup – pick goods
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
    if (member.balance < total) throw new Error(`Insufficient balance. Required: ${total.toLocaleString()} UGX, Available: ${member.balance.toLocaleString()} UGX`);
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
    req.session.success_msg = `Pickup successful! ${quantity} x ${product.productName} (${total.toLocaleString()} UGX). Remaining balance: ${member.balance.toLocaleString()} UGX`;
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/deposit-scheme');
});

// GET /deposit-scheme/member-statement – full member statement with filtering (preferred)
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

    let transactions = await DepositTransaction.find(query).sort({ createdAt: -1 });

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
    req.session.error_msg = err.message;
    res.redirect('/deposit-scheme');
  }
});
// GET /deposit-scheme/receipt/:id – show receipt for a deposit/pickup transaction
router.get('/deposit-scheme/receipt/:id', isManagerOrAdmin, async (req, res) => {
  try {
    const transaction = await DepositTransaction.findById(req.params.id)
      .populate('memberId', 'fullName nin phone balance')
      .populate('recordedBy', 'fullName');
    if (!transaction) throw new Error('Transaction not found');
    // Attach member and recordedBy as plain objects for template
    const member = transaction.memberId;
    const recordedBy = transaction.recordedBy;
    res.render('deposit-receipt', { 
      transaction: {
        ...transaction.toObject(),
        member,
        recordedBy
      },
      user: req.user 
    });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// GET /deposit-scheme/statement/:id – simple statement (legacy, kept for compatibility)
router.get('/statement/:id', isManagerOrAdmin, async (req, res) => {
  try {
    const member = await DepositMember.findById(req.params.id);
    if (!member) throw new Error('Member not found');
    const transactions = await DepositTransaction.find({ memberId: req.params.id }).sort({ createdAt: -1 });
    res.render('member-statement', { member, transactions, user: req.user });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/deposit-scheme');
  }
});

// GET /deposit-scheme/export – placeholder
router.get('/export', isManagerOrAdmin, async (req, res) => {
  req.session.error_msg = 'Export feature coming soon';
  res.redirect('/deposit-scheme');
});

module.exports = router;