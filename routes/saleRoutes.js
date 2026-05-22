const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const DepositMember = require("../models/DepositMember");
const DepositTransaction = require("../models/DepositTransaction");
const { allowRoles } = require("../middleware/auth");

function calcDeliveryFee(subtotal, distance) {
  if (subtotal >= 500000 && distance <= 10) return 0;
  return 30000;
}

router.get("/", allowRoles(["manager", "attendant"]), async (req, res) => {
  try {
    const products = await Product.find({ currentStock: { $gt: 0 } });
    const customers = await Customer.find().select("_id fullName phone");
    const cart = req.session.cart || [];
    const selectedCustomerId = req.session.selectedCustomerId || null;
    const selectedCustomer = selectedCustomerId ? await Customer.findById(selectedCustomerId) : null;
    const distance = req.session.deliveryDistance || 5;
    let subtotal = 0;
    for (let item of cart) subtotal += item.price * item.qty;
    const deliveryFee = calcDeliveryFee(subtotal, distance);
    const grandTotal = subtotal + deliveryFee;
    res.render("sales", {
      products, customers, selectedCustomer, selectedCustomerId,
      deliveryDistance: distance, cart, subtotal, deliveryFee, grandTotal, user: req.user,
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/dashboard");
  }
});

router.post("/update-customer", allowRoles(["manager", "attendant"]), (req, res) => {
  req.session.selectedCustomerId = req.body.customerId || null;
  req.session.deliveryDistance = parseFloat(req.body.distance) || 0;
  res.redirect("/sales");
});

router.post("/add-item", allowRoles(["manager", "attendant"]), async (req, res) => {
  const qty = parseInt(req.body.quantity);
  if (qty <= 0) { req.flash("error_msg", "Invalid quantity"); return res.redirect("/sales"); }
  const product = await Product.findById(req.body.productId);
  if (!product) { req.flash("error_msg", "Product not found"); return res.redirect("/sales"); }
  if (product.currentStock < qty) { req.flash("error_msg", `Only ${product.currentStock} units left`); return res.redirect("/sales"); }
  const cart = req.session.cart || [];
  const existing = cart.find((i) => i.productId == req.body.productId);
  if (existing) existing.qty += qty;
  else cart.push({ productId: product._id, name: product.productName, price: product.unitPrice, qty });
  req.session.cart = cart;
  req.flash("success_msg", `${qty} x ${product.productName} added`);
  res.redirect("/sales");
});

router.post("/remove-item", allowRoles(["manager", "attendant"]), (req, res) => {
  const cart = req.session.cart || [];
  cart.splice(parseInt(req.body.index), 1);
  req.session.cart = cart;
  res.redirect("/sales");
});

router.post("/clear-cart", allowRoles(["manager", "attendant"]), (req, res) => {
  req.session.cart = [];
  res.redirect("/sales");
});

router.post("/checkout", allowRoles(["manager", "attendant"]), async (req, res) => {
  try {
    const { items, customerName, paymentMethod, deliveryFee, distance } = req.body;
    if (!items || items.length === 0) throw new Error("Cart empty");
    let subtotal = 0;
    const saleItems = [];
    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error(`Product ${item.name} not found`);
      if (product.currentStock < item.qty) throw new Error(`Insufficient stock for ${product.productName}`);
      product.currentStock -= item.qty;
      await product.save();
      const total = product.unitPrice * item.qty;
      subtotal += total;
      saleItems.push({ productId: product._id, productName: product.productName, quantity: item.qty, unitPrice: product.unitPrice, total });
    }
    const delivery = parseFloat(deliveryFee) || 0;
    const grandTotal = subtotal + delivery;
    if (paymentMethod === "Deposit Scheme") {
      const member = await DepositMember.findOne({ fullName: customerName });
      if (!member || member.balance < grandTotal) throw new Error("Insufficient deposit balance");
      member.balance -= grandTotal;
      await member.save();
      await DepositTransaction.create({ memberId: member._id, type: "pickup", amount: -grandTotal, description: `Sale items - ${items.length} product(s)`, balanceAfter: member.balance });
    }
    const invoiceNumber = "INV-" + Date.now();
    const sale = new Sale({ invoiceNumber, customerName, items: saleItems, subtotal, deliveryFee: delivery, tax: 0, grandTotal, paymentMethod, status: "Paid", attendant: req.user._id });
    await sale.save();
    req.session.cart = [];
    req.session.selectedCustomerId = null;
    return res.json({ success: true, saleId: sale._id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/invoice/:id", allowRoles(["manager", "attendant", "admin"]), async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate("attendant", "fullName");
  if (!sale) { req.flash("error_msg", "Sale not found"); return res.redirect("/sales"); }
  res.render("receipt", { sale, user: req.user });
});

router.get("/new-customer", allowRoles(["manager", "attendant"]), (req, res) => {
  res.render("new-customer", { user: req.user });
});

router.post("/new-customer", allowRoles(["manager", "attendant"]), async (req, res) => {
  try {
    const { fullName, phone, nin, email } = req.body;
    const existing = await Customer.findOne({ phone });
    if (existing) { req.flash("error_msg", "Customer with this phone already exists."); return res.redirect("/sales/new-customer"); }
    await Customer.create({ fullName, phone, nin, email });
    req.flash("success_msg", `Customer ${fullName} added. Please select them from the list.`);
    res.redirect("/sales");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/sales/new-customer");
  }
});

module.exports = router;