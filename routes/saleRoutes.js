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

function generateInvoiceNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.getTime().toString().slice(-6);
  return `INV-${datePart}-${timePart}`;
}

// VIEW SALES PAGE
router.get("/", allowRoles(["manager", "attendant", "admin"]), async (req, res) => {
  try {
    const products = await Product.find({ currentStock: { $gt: 0 } }).sort({ productType: 1 });
    const customers = await Customer.find().select("_id fullName phone").sort({ fullName: 1 });
    const cart = req.session.cart || [];
    const selectedCustomerId = req.session.selectedCustomerId || null;
    const selectedCustomer = selectedCustomerId
      ? await Customer.findById(selectedCustomerId)
      : null;
    const distance = req.session.deliveryDistance || 0;

    let subtotal = 0;
    for (let item of cart) subtotal += item.price * item.qty;
    const deliveryFee = calcDeliveryFee(subtotal, distance);
    const grandTotal = subtotal + deliveryFee;

    res.render("sales", {
      products,
      customers,
      selectedCustomer,
      selectedCustomerId,
      deliveryDistance: distance,
      cart,
      subtotal,
      deliveryFee,
      grandTotal,
      user: req.user,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/dashboard");
  }
});

// UPDATE CUSTOMER & DELIVERY DISTANCE
router.post(
  "/update-customer",
  allowRoles(["manager", "attendant", "admin"]),
  (req, res) => {
    req.session.selectedCustomerId = req.body.customerId || null;
    req.session.deliveryDistance = parseFloat(req.body.distance) || 0;
    res.redirect("/sales");
  }
);

// CHECKOUT
// The sales.pug uses fetch() with JSON body, so this route accepts JSON.
// It returns JSON { saleId } on success or { error } on failure.
// The view's JS then redirects to /sales/invoice/:id on success.
router.post(
  "/checkout",
  allowRoles(["manager", "attendant", "admin"]),
  async (req, res) => {
    try {
      const { items, customerName, paymentMethod, deliveryFee, distance, requireTransport } =
        req.body;

      // --- Validate inputs ---
      if (!items || !Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "Cart is empty. Please add items before checking out." });

      const cleanCustomerName = (customerName || "Walk-in Customer").trim();

      if (!paymentMethod || paymentMethod.trim() === "")
        return res.status(400).json({ error: "Please select a payment method." });

      // --- STEP 1: Validate ALL stock before touching the database ---
      for (let item of items) {
        if (!item.productId)
          return res.status(400).json({ error: `Invalid item in cart: missing product ID.` });
        const qty = parseInt(item.qty);
        if (!qty || qty < 1)
          return res.status(400).json({ error: `Invalid quantity for ${item.name || "a cart item"}.` });

        const product = await Product.findById(item.productId);
        if (!product)
          return res.status(400).json({ error: `Product "${item.name}" no longer exists. Please remove it from the cart.` });
        if (product.currentStock < qty)
          return res.status(400).json({
            error: `Insufficient stock for ${product.productType}. Available: ${product.currentStock}, requested: ${qty}.`
          });
      }

      // --- STEP 2: Build sale items and calculate totals ---
      let subtotal = 0;
      const saleItems = [];

      for (let item of items) {
        const product = await Product.findById(item.productId);
        const qty = parseInt(item.qty);
        const total = product.unitPrice * qty;
        subtotal += total;
        saleItems.push({
          productId: product._id,
          productName: product.productType,
          quantity: qty,
          unitPrice: product.unitPrice,
          total,
        });
      }

      // Delivery fee: use what the client calculated (already validated server-side logic)
      const fee = requireTransport ? (Number(deliveryFee) || calcDeliveryFee(subtotal, parseFloat(distance) || 0)) : 0;
      const grandTotal = subtotal + fee;

      // --- STEP 3: Handle Deposit Scheme ---
      if (paymentMethod === "Deposit Scheme") {
        const member = await DepositMember.findOne({
          fullName: { $regex: new RegExp("^" + cleanCustomerName + "$", "i") },
        });
        if (!member)
          return res.status(400).json({
            error: `No deposit scheme member found named "${cleanCustomerName}". Check the name and try again.`,
          });
        if (member.balance < grandTotal)
          return res.status(400).json({
            error: `Insufficient deposit balance. Balance: ${member.balance.toLocaleString()} UGX. Required: ${grandTotal.toLocaleString()} UGX.`,
          });

        member.balance -= grandTotal;
        await member.save();
        await DepositTransaction.create({
          memberId: member._id,
          type: "pickup",
          amount: -grandTotal,
          description: `Sale — ${saleItems.length} item(s)`,
          balanceAfter: member.balance,
        });
      }

      // --- STEP 4: Deduct stock atomically ---
      for (let item of saleItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { currentStock: -item.quantity },
        });
      }

      // --- STEP 5: Save the sale ---
      const invoiceNumber = generateInvoiceNumber();
      const sale = new Sale({
        invoiceNumber,
        customerName: cleanCustomerName,
        items: saleItems,
        subtotal,
        deliveryFee: fee,
        tax: 0,
        grandTotal,
        paymentMethod,
        status: "Paid",
        attendant: req.user._id,
      });
      await sale.save();

      // --- STEP 6: Clear session cart ---
      req.session.cart = [];
      req.session.selectedCustomerId = null;
      req.session.deliveryDistance = 0;

      // Return JSON for the fetch() call in sales.pug
      return res.json({ success: true, saleId: sale._id });
    } catch (err) {
      console.error("Checkout error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// VIEW INVOICE / RECEIPT
router.get(
  "/invoice/:id",
  allowRoles(["manager", "attendant", "admin"]),
  async (req, res) => {
    try {
      const sale = await Sale.findById(req.params.id).populate("attendant", "fullName");
      if (!sale) {
        req.flash("error_msg", "Sale not found.");
        return res.redirect("/sales");
      }
      res.render("receipt", { sale, user: req.user });
    } catch (err) {
      req.flash("error_msg", err.message);
      res.redirect("/sales");
    }
  }
);

// ADD NEW CUSTOMER (inline form in sales.pug uses fetch with form-urlencoded)
router.get(
  "/new-customer",
  allowRoles(["manager", "attendant", "admin"]),
  (req, res) => {
    res.render("new-customer", { user: req.user });
  }
);

// The registerCustomer() in sales.pug POSTs here via fetch (form-urlencoded).
// On success it redirects, and the fetch detects response.redirected = true.
router.post(
  "/new-customer",
  allowRoles(["manager", "attendant", "admin"]),
  async (req, res) => {
    try {
      const { fullName, phone, nin, email } = req.body;

      if (!fullName || fullName.trim() === "")
        throw new Error("Customer full name is required.");
      if (!phone || phone.trim() === "")
        throw new Error("Customer phone number is required.");

      const existing = await Customer.findOne({ phone: phone.trim() });
      if (existing) {
        req.flash("error_msg", "A customer with this phone number already exists.");
        return res.redirect("/sales/new-customer");
      }

      await Customer.create({
        fullName: fullName.trim(),
        phone: phone.trim(),
        nin: nin || "",
        email: email || "",
      });

      req.flash(
        "success_msg",
        `Customer ${fullName.trim()} added. Please select them from the customer list.`
      );
      res.redirect("/sales");
    } catch (err) {
      req.flash("error_msg", err.message);
      res.redirect("/sales/new-customer");
    }
  }
);

module.exports = router;