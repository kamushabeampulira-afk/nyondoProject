// routes/sales.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose"); // needed for transactions
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const DepositMember = require("../models/DepositMember");
const DepositTransaction = require("../models/DepositTransaction");
const { isSalesOrAdmin } = require("../middleware/auth"); // changed

// Existing cart routes (add, update, remove, clear, checkout)

// GET /sales – show sales page with current cart and product list
router.get("/", isSalesOrAdmin, async (req, res) => {
  try {
    const products = await Product.find({ currentStock: { $gt: 0 } });
    const cart = req.session.cart || [];
    let subtotal = 0;
    for (let item of cart) subtotal += item.price * item.qty;
    let deliveryFee = 0;
    const distance = req.session.deliveryDistance || 5;
    if (!(subtotal >= 500000 && distance <= 10)) deliveryFee = 30000;
    const grandTotal = subtotal + deliveryFee;
    // console.table(products);
    res.render("sales", {
      products,
      cart,
      subtotal,
      deliveryFee,
      grandTotal,
      user: req.user,
    });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect("/dashboard");
  }
});

// POST /sales/add – add item to cart
router.post("/add", isSalesOrAdmin, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");
    const qty = parseInt(quantity);
    if (product.currentStock < qty)
      throw new Error(
        `Only ${product.currentStock} of ${product.productName} in stock`,
      );
    const cart = req.session.cart || [];
    const existing = cart.find((i) => i.productId == productId);
    if (existing) existing.qty += qty;
    else
      cart.push({
        productId,
        name: product.productName,
        price: product.unitPrice,
        qty,
      });
    req.session.cart = cart;
    req.session.success_msg = `${qty} x ${product.productName} added to cart.`;
    res.redirect("/sales");
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect("/sales");
  }
});

// POST /sales/update – update item quantity
router.post("/update", isSalesOrAdmin, (req, res) => {
  const { index, quantity } = req.body;
  const cart = req.session.cart || [];
  const idx = parseInt(index);
  if (cart[idx]) {
    cart[idx].qty = parseInt(quantity);
    req.session.cart = cart;
  }
  res.redirect("/sales");
});

// POST /sales/remove – remove item from cart
router.post("/remove", isSalesOrAdmin, (req, res) => {
  const { index } = req.body;
  const cart = req.session.cart || [];
  cart.splice(parseInt(index), 1);
  req.session.cart = cart;
  res.redirect("/sales");
});

// POST /sales/clear – clear entire cart
router.post("/clear", isSalesOrAdmin, (req, res) => {
  req.session.cart = [];
  res.redirect("/sales");
});

// POST /sales/checkout – process sale using session cart (multiple items)
router.post("/checkout", isSalesOrAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) throw new Error("Cart is empty");
    const { customerName, distance, paymentMethod } = req.body;
    let subtotal = 0;
    const saleItems = [];
    for (let item of cart) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error(`Product ${item.name} not found`);
      if (product.currentStock < item.qty)
        throw new Error(`Insufficient stock for ${product.productName}`);
      product.currentStock -= item.qty;
      await product.save({ session });
      const total = product.unitPrice * item.qty;
      subtotal += total;
      saleItems.push({
        productId: product._id,
        productName: product.productName,
        quantity: item.qty,
        unitPrice: product.unitPrice,
        total,
      });
    }
    const dist = parseFloat(distance) || 0;
    let deliveryFee = 0;
    if (!(subtotal >= 500000 && dist <= 10)) deliveryFee = 30000;
    const grandTotal = subtotal + deliveryFee;
    if (paymentMethod === "Deposit Scheme") {
      const member = await DepositMember.findOne({
        fullName: customerName,
      }).session(session);
      if (!member || member.balance < grandTotal)
        throw new Error("Insufficient deposit balance");
      member.balance -= grandTotal;
      await member.save({ session });
      await DepositTransaction.create(
        [
          {
            memberId: member._id,
            type: "pickup",
            amount: -grandTotal,
            description: `Sale items`,
            balanceAfter: member.balance,
          },
        ],
        { session },
      );
    }
    const invoiceNumber = "INV-" + Date.now();
    const sale = new Sale({
      invoiceNumber,
      customerName: customerName || "Walk-in Customer",
      items: saleItems,
      subtotal,
      deliveryFee,
      tax: 0,
      grandTotal,
      paymentMethod,
      status: "Paid",
      attendant: req.user._id,
    });
    await sale.save({ session });
    await session.commitTransaction();
    req.session.cart = [];
    req.session.success_msg = "Sale completed!";
    res.redirect(`/invoice/${sale._id}`);
  } catch (err) {
    await session.abortTransaction();
    req.session.error_msg = err.message;
    res.redirect("/sales");
  } finally {
    session.endSession();
  }
});

// New: One‑product quick checkout (no cart, single item)
router.post("/quick-checkout", isSalesOrAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { productId, quantity, customerName, distance, paymentMethod } =
      req.body;
    const qty = parseInt(quantity);
    if (qty <= 0) throw new Error("Invalid quantity");

    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error("Product not found");
    if (product.currentStock < qty)
      throw new Error(
        `Only ${product.currentStock} of ${product.productName} in stock`,
      );

    const subtotal = product.unitPrice * qty;
    let deliveryFee = 0;
    const dist = parseFloat(distance) || 0;
    if (!(subtotal >= 500000 && dist <= 10)) {
      deliveryFee = 30000;
    }
    const grandTotal = subtotal + deliveryFee;

    // Deduct stock
    product.currentStock -= qty;
    await product.save({ session });

    // Handle Deposit Scheme payment
    if (paymentMethod === "Deposit Scheme") {
      const member = await DepositMember.findOne({
        fullName: customerName,
      }).session(session);
      if (!member || member.balance < grandTotal)
        throw new Error("Insufficient deposit balance");
      member.balance -= grandTotal;
      await member.save({ session });
      await DepositTransaction.create(
        [
          {
            memberId: member._id,
            type: "pickup",
            amount: -grandTotal,
            description: `${qty} x ${product.productName}`,
            balanceAfter: member.balance,
          },
        ],
        { session },
      );
    }

    // Create sale record
    const invoiceNumber = "INV-" + Date.now();
    const sale = new Sale({
      invoiceNumber,
      customerName: customerName || "Walk-in Customer",
      items: [
        {
          productId: product._id,
          productName: product.productName,
          quantity: qty,
          unitPrice: product.unitPrice,
          total: subtotal,
        },
      ],
      subtotal,
      deliveryFee,
      tax: 0,
      grandTotal,
      paymentMethod,
      status: "Paid",
      attendant: req.user._id,
    });
    await sale.save({ session });

    await session.commitTransaction();
    req.session.success_msg = "Sale completed!";
    res.redirect(`/invoice/${sale._id}`);
  } catch (err) {
    await session.abortTransaction();
    req.session.error_msg = err.message;
    res.redirect("/sales");
  } finally {
    session.endSession();
  }
});

// Optional: set delivery distance from a form (if you want to keep it in session)
router.post("/delivery", isSalesOrAdmin, (req, res) => {
  req.session.deliveryDistance = Number(req.body.distance);
  res.redirect("/sales");
});
router.get("/invoice/:id", isSalesOrAdmin, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate(
      "attendant",
      "fullName",
    );
    if (!sale) throw new Error("Sale not found");
    res.render("receipt", { sale, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/sales");
  }
});

module.exports = router;
