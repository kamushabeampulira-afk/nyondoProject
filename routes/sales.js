// routes/sales.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');          // needed for transactions
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const DepositMember = require('../models/DepositMember');
const DepositTransaction = require('../models/DepositTransaction');
const { ensureAuthenticated } = require('../middleware/auth');

// Show sales page (cart + product list)
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const products = await Product.find({ currentStock: { $gt: 0 } });
    const cart = req.session.cart || [];
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let deliveryFee = 0;
    const distance = req.session.deliveryDistance || 5;
    if (!(subtotal >= 500000 && distance <= 10)) {
      deliveryFee = 30000;
      if (distance > 10) deliveryFee += (distance - 10) * 1000;
    }
    const grandTotal = subtotal + deliveryFee;
    res.render('sales', { products, cart, subtotal, deliveryFee, grandTotal, user: req.user });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Add item to cart
router.post('/add', ensureAuthenticated, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).send('Product not found');
    if (product.currentStock < quantity) return res.status(400).send('Not enough stock');

    const cart = req.session.cart || [];
    const existing = cart.find(i => i.productId == productId);
    if (existing) existing.qty += Number(quantity);
    else cart.push({ productId, name: product.productName, price: product.unitPrice, qty: Number(quantity) });
    req.session.cart = cart;
    res.redirect('/sales');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Remove item from cart
router.post('/remove/:index', ensureAuthenticated, (req, res) => {
  const cart = req.session.cart || [];
  cart.splice(req.params.index, 1);
  req.session.cart = cart;
  res.redirect('/sales');
});

// Set delivery distance (optional)
router.post('/delivery', ensureAuthenticated, (req, res) => {
  req.session.deliveryDistance = Number(req.body.distance);
  res.redirect('/sales');
});

// Checkout – process sale, update stock, handle deposit scheme, create invoice
router.post('/checkout', ensureAuthenticated, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) throw new Error('Cart is empty');

    const { customerName, customerPhone, customerAddress, paymentMethod } = req.body;
    let subtotal = 0;

    // Deduct stock and calculate subtotal
    for (let item of cart) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product ${item.name} not found`);
      if (product.currentStock < item.qty) throw new Error(`Insufficient stock for ${product.productName}`);
      product.currentStock -= item.qty;
      await product.save({ session });
      subtotal += item.price * item.qty;
    }

    // Calculate delivery fee
    const distance = req.session.deliveryDistance || 5;
    let deliveryFee = 0;
    if (!(subtotal >= 500000 && distance <= 10)) {
      deliveryFee = 30000;
      if (distance > 10) deliveryFee += (distance - 10) * 1000;
    }
    const grandTotal = subtotal + deliveryFee;

    // Handle Deposit Scheme payment
    if (paymentMethod === 'Deposit Scheme') {
      const member = await DepositMember.findOne({ fullName: customerName }).session(session);
      if (!member || member.balance < grandTotal) throw new Error('Insufficient deposit balance');
      member.balance -= grandTotal;
      await member.save({ session });
      await DepositTransaction.create([{
        memberId: member._id,
        type: 'pickup',
        amount: -grandTotal,
        description: 'Sale items',
        balanceAfter: member.balance
      }], { session });
    }

    // Create sale record
    const invoiceNumber = 'INV-' + Date.now();
    const sale = new Sale({
      invoiceNumber,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      customerAddress: customerAddress || '',
      items: cart,
      subtotal,
      deliveryFee,
      tax: 0,
      grandTotal,
      paymentMethod,
      status: 'Paid',
      attendant: req.user._id
    });
    await sale.save({ session });

    await session.commitTransaction();

    // Clear cart and distance from session
    req.session.cart = [];
    req.session.deliveryDistance = null;

    res.redirect(`/invoice/${sale._id}`);
  } catch (err) {
    await session.abortTransaction();
    res.status(400).send(err.message);
  } finally {
    session.endSession();
  }
});

module.exports = router;