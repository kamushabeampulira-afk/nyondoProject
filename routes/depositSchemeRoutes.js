const express = require('express');
const router = express.Router();
const DepositMember = require('../models/DepositMember');
const DepositTransaction = require('../models/DepositTransaction');
const DepositReceipt = require('../models/DepositReceipt');
const Product = require('../models/Product');
const { isManagerOrAdmin } = require('../middleware/auth');

const DELIVERY_FEE = 30000;
const FREE_DELIVERY_THRESHOLD = 500000;
const FREE_DELIVERY_DISTANCE = 10;

function calcDeliveryFee(targetAmount, distance) {
  if (targetAmount >= FREE_DELIVERY_THRESHOLD && distance <= FREE_DELIVERY_DISTANCE) return 0;
  return DELIVERY_FEE;
}

// MAIN PAGE
router.get('/', isManagerOrAdmin, async (req, res) => {
  try {
    const members = await DepositMember.find();
    const products = await Product.find({ currentStock: { $gt: 0 } });
    const totalDepositsAgg = await DepositTransaction.aggregate([
      { $match: { type: 'deposit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalPickupsAgg = await DepositTransaction.aggregate([
      { $match: { type: 'pickup' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
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

// MEMBERS LIST
router.get('/members', isManagerOrAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = { $or: [
        { fullName: { $regex: search, $options: 'i' } },
        { nin: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]};
    }
    const members = await DepositMember.find(query).sort({ joinedAt: -1 });
    res.render('deposit-members', { members, search, user: req.user });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// REGISTER FORM
router.get('/register', isManagerOrAdmin, async (req, res) => {
  const products = await Product.find({ currentStock: { $gt: 0 } });
  res.render('deposit-register', { products, user: req.user });
});

router.post('/register', isManagerOrAdmin, async (req, res) => {
  try {
    const { fullName, nin, phone, address, employer, productId, quantity, distance, requiresDelivery } = req.body;
    const existing = await DepositMember.findOne({ $or: [{ nin }, { phone }] });
    if (existing) throw new Error('Member with same NIN or phone already exists');

    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const qty = parseInt(quantity) || 1;
    const targetAmount = product.unitPrice * qty;
    const needsDelivery = requiresDelivery === 'on' || requiresDelivery === true;
    const dist = parseFloat(distance) || 5;
    const deliveryFee = needsDelivery ? calcDeliveryFee(targetAmount, dist) : 0;
    const totalTarget = targetAmount + deliveryFee;

    const member = new DepositMember({
      fullName, nin, phone, address, employer,
      balance: 0,
      status: 'Active',
      goals: [{
        productId: product._id,
        productName: product.productName,
        quantity: qty,
        unitPrice: product.unitPrice,
        targetAmount: totalTarget,
        savedAmount: 0,
        requiresDelivery: needsDelivery,
        deliveryFee,
        status: 'Saving'
      }]
    });

    await member.save();
    req.flash('success_msg', `Member ${member.fullName} registered successfully!`);
    res.redirect('/deposit-scheme/members');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme/register');
  }
});

// DEPOSIT (POST) 
router.post('/deposit', isManagerOrAdmin, async (req, res) => {
  try {
    const { memberId, goalId, amount, paymentMethod } = req.body;
    if (!memberId || !goalId || !amount || amount < 1000) throw new Error('Invalid deposit amount');

    const member = await DepositMember.findById(memberId);
    if (!member) throw new Error('Member not found');

    const goal = member.goals.id(goalId);
    if (!goal) throw new Error('Goal not found');

    const depositAmount = Number(amount);
    const remaining = goal.targetAmount - goal.savedAmount;
    const actualDeposit = Math.min(depositAmount, remaining);

    goal.savedAmount += actualDeposit;
    member.balance += actualDeposit;

    if (goal.savedAmount >= goal.targetAmount) {
      goal.status = 'Goal Reached';
    }

    await member.save();

    // Save transaction
    const transaction = new DepositTransaction({
      memberId,
      type: 'deposit',
      amount: actualDeposit,
      description: `Deposit toward ${goal.productName} x${goal.quantity}`,
      balanceAfter: member.balance
    });
    await transaction.save();

    // Save receipt
    const receipt = new DepositReceipt({
      memberId,
      goalId,
      productName: goal.productName,
      quantity: goal.quantity,
      amountDeposited: actualDeposit,
      savedAmount: goal.savedAmount,
      targetAmount: goal.targetAmount,
      remainingAmount: Math.max(goal.targetAmount - goal.savedAmount, 0),
      deliveryFee: goal.deliveryFee,
      requiresDelivery: goal.requiresDelivery,
      paymentMethod: paymentMethod || 'Cash',
      recordedBy: req.user._id
    });
    await receipt.save();

    req.flash('success_msg', `Deposit of ${actualDeposit.toLocaleString()} UGX recorded for ${member.fullName} toward ${goal.productName}.`);
    res.redirect(`/deposit-scheme/receipt/${receipt._id}`);
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// RECEIPT PAGE
router.get('/receipt/:id', isManagerOrAdmin, async (req, res) => {
  try {
    const receipt = await DepositReceipt.findById(req.params.id)
      .populate('memberId')
      .populate('recordedBy', 'fullName');
    if (!receipt) throw new Error('Receipt not found');
    res.render('deposit-receipt-new', { receipt, user: req.user });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// ADD NEW GOAL TO EXISTING MEMBER
router.post('/add-goal', isManagerOrAdmin, async (req, res) => {
  try {
    const { memberId, productId, quantity, distance, requiresDelivery } = req.body;
    const member = await DepositMember.findById(memberId);
    if (!member) throw new Error('Member not found');

    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    const qty = parseInt(quantity) || 1;
    const targetAmount = product.unitPrice * qty;
    const needsDelivery = requiresDelivery === 'on' || requiresDelivery === true;
    const dist = parseFloat(distance) || 5;
    const deliveryFee = needsDelivery ? calcDeliveryFee(targetAmount, dist) : 0;
    const totalTarget = targetAmount + deliveryFee;

    member.goals.push({
      productId: product._id,
      productName: product.productName,
      quantity: qty,
      unitPrice: product.unitPrice,
      targetAmount: totalTarget,
      savedAmount: 0,
      requiresDelivery: needsDelivery,
      deliveryFee,
      status: 'Saving'
    });

    await member.save();
    req.flash('success_msg', `New goal added for ${member.fullName} — ${qty} x ${product.productName}`);
    res.redirect('/deposit-scheme');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// PICKUP (POST)
router.post('/pickup', isManagerOrAdmin, async (req, res) => {
  try {
    const { memberId, goalId } = req.body;
    const member = await DepositMember.findById(memberId);
    if (!member) throw new Error('Member not found');

    const goal = member.goals.id(goalId);
    if (!goal) throw new Error('Goal not found');
    if (goal.status !== 'Goal Reached') throw new Error('Goal not yet fully funded');

    const product = await Product.findById(goal.productId);
    if (!product) throw new Error('Product not found');
    if (product.currentStock < goal.quantity) throw new Error(`Only ${product.currentStock} units in stock`);

    product.currentStock -= goal.quantity;
    await product.save();

    member.balance -= goal.targetAmount;
    goal.status = 'Picked Up';
    await member.save();

    const transaction = new DepositTransaction({
      memberId,
      type: 'pickup',
      amount: -goal.targetAmount,
      description: `Pickup: ${goal.quantity} x ${goal.productName}`,
      productDetails: {
        productName: goal.productName,
        quantity: goal.quantity,
        unitPrice: goal.unitPrice
      },
      balanceAfter: member.balance
    });
    await transaction.save();

    req.flash('success_msg', `Pickup successful! ${goal.quantity} x ${goal.productName} released.`);
    res.redirect('/deposit-scheme');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// RECENT TRANSACTIONS
router.get('/transactions', isManagerOrAdmin, async (req, res) => {
  try {
    const transactions = await DepositTransaction.find()
      .populate('memberId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(50);
    res.render('deposit-transactions', { transactions, user: req.user });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/deposit-scheme');
  }
});

// MEMBER STATEMENT 
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

    let query = { memberId: targetMember._id };
    let startDate = null;
    const now = new Date();
    if (range === '30days') { startDate = new Date(); startDate.setDate(now.getDate() - 30); }
    else if (range === 'thisMonth') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (range === 'last3months') { startDate = new Date(); startDate.setMonth(now.getMonth() - 3); }
    if (startDate) query.createdAt = { $gte: startDate };

    const transactions = await DepositTransaction.find(query).sort({ createdAt: -1 });
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