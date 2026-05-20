const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const DepositMember = require("../models/DepositMember");
const DepositTransaction = require("../models/DepositTransaction");
const { isSalesOrAdmin } = require("../middleware/auth");

// Helper to calculate delivery fee
function calcDeliveryFee(subtotal, distance) {
  if (subtotal >= 500000 && distance <= 10) return 0;
  return 30000;
}
// GET /sales – with optional product search
router.get("/", isSalesOrAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let productQuery = { currentStock: { $gt: 0 } };
    if (search) {
      productQuery.productName = { $regex: search, $options: "i" };
    }
    const products = await Product.find(productQuery).sort({ productName: 1 });

    const customers = await Customer.find().select("_id fullName phone");
    const cart = req.session.cart || [];
    const selectedCustomerId = req.session.selectedCustomerId || null;
    const selectedCustomer = selectedCustomerId
      ? await Customer.findById(selectedCustomerId)
      : null;
    const customerBalance = selectedCustomer
      ? selectedCustomer.totalPurchases
      : null; // or any balance field

    const distance = req.session.deliveryDistance || 5;
    let subtotal = 0;
    for (let item of cart) subtotal += item.price * item.qty;
    const deliveryFee = calcDeliveryFee(subtotal, distance);
    const grandTotal = subtotal + deliveryFee;

    res.render("sales", {
      products,
      customers,
      selectedCustomer,
      selectedCustomerId,
      customerBalance,
      deliveryDistance: distance,
      cart,
      subtotal,
      deliveryFee,
      grandTotal,
      searchQuery: search || "",
      user: req.user,
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/dashboard");
  }
});

// ========= SELECT CUSTOMER & DISTANCE =========
router.post("/update-customer", isSalesOrAdmin, async (req, res) => {
  const { customerId, distance } = req.body;
  req.session.selectedCustomerId = customerId || null;
  req.session.deliveryDistance = parseFloat(distance) || 0;
  res.redirect("/sales");
});

// ========= ADD ITEM TO CART =========
router.post("/add-item", isSalesOrAdmin, async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = parseInt(quantity);
  if (qty <= 0) {
    req.flash("error_msg", "Invalid quantity");
    return res.redirect("/sales");
  }
  const product = await Product.findById(productId);
  if (!product) {
    req.flash("error_msg", "Product not found");
    return res.redirect("/sales");
  }
  if (product.currentStock < qty) {
    req.flash(
      "error_msg",
      `Only ${product.currentStock} units of ${product.productName} left`,
    );
    return res.redirect("/sales");
  }
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
  res.redirect("/sales");
});

// ========= REMOVE ITEM FROM CART =========
router.post("/remove-item", isSalesOrAdmin, (req, res) => {
  const { index } = req.body;
  const cart = req.session.cart || [];
  cart.splice(parseInt(index), 1);
  req.session.cart = cart;
  res.redirect("/sales");
});

// ========= CLEAR CART =========
router.post("/clear-cart", isSalesOrAdmin, (req, res) => {
  req.session.cart = [];
  res.redirect("/sales");
});

// ========= CHECKOUT (process sale) =========
router.post("/checkout", isSalesOrAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) throw new Error("Cart is empty");
    const { paymentMethod } = req.body;
    const customerId = req.session.selectedCustomerId;
    const customerName = customerId
      ? (await Customer.findById(customerId)).fullName
      : "Walk-in Customer";
    const distance = req.session.deliveryDistance || 5;
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
    const deliveryFee = calcDeliveryFee(subtotal, distance);
    const grandTotal = subtotal + deliveryFee;
    // Deposit Scheme payment handling (if applicable)
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
      customerName,
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
    // Clear cart after successful sale
    req.session.cart = [];
    req.session.selectedCustomerId = null;
    req.flash("success_msg", `Sale completed! Invoice ${invoiceNumber}`);
    res.redirect(`/invoice/${sale._id}`);
  } catch (err) {
    await session.abortTransaction();
    req.flash("error_msg", err.message);
    res.redirect("/sales");
  } finally {
    session.endSession();
  }
});

// ========= NEW CUSTOMER FORM (optional separate page) =========
router.get("/new-customer", isSalesOrAdmin, (req, res) => {
  res.render("new-customer", { user: req.user });
});

router.post("/new-customer", isSalesOrAdmin, async (req, res) => {
  try {
    const { fullName, phone, nin, email } = req.body;
    const customer = new Customer({ fullName, phone, nin, email });
    await customer.save();
    req.flash(
      "success_msg",
      `Customer ${fullName} added. Please select them from the list.`,
    );
    res.redirect("/sales");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/sales/new-customer");
  }
});

module.exports = router;
