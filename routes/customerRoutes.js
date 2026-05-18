// routes/customers.js
const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const { isSalesOrAdmin } = require("../middleware/auth"); // changed

// GET /customers – show list and “add” form
router.get("/", isSalesOrAdmin, async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.render("customers", {
      customers,
      totalCustomers: customers.length,
      user: req.user,
      success_msg: req.session.success_msg,
      error_msg: req.session.error_msg,
    });
    // clear flash messages after rendering
    req.session.success_msg = null;
    req.session.error_msg = null;
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect("/dashboard");
  }
});

// POST /customers – add a new customer
router.post("/", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    req.session.success_msg = `Customer ${customer.fullName} added successfully!`;
    res.redirect("/customers");
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect("/customers");
  }
});

// GET /customers/:id – view single customer details (optional)
router.get("/:id", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      req.session.error_msg = "Customer not found";
      return res.redirect("/customers");
    }
    res.render("customer-detail", { customer, user: req.user });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect("/customers");
  }
});

// GET /customers/:id/edit – show edit form
router.get("/:id/edit", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      req.session.error_msg = "Customer not found";
      return res.redirect("/customers");
    }
    res.render("customer-edit", { customer, user: req.user });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect("/customers");
  }
});

// POST /customers/:id – update customer
router.post("/:id", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!customer) throw new Error("Customer not found");
    req.session.success_msg = `Customer ${customer.fullName} updated successfully!`;
    res.redirect("/customers");
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect(`/customers/${req.params.id}/edit`);
  }
});

// POST /customers/:id/delete – delete customer (using POST for simplicity)
router.post("/:id/delete", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) throw new Error("Customer not found");
    req.session.success_msg = `Customer ${customer.fullName} deleted.`;
    res.redirect("/customers");
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect("/customers");
  }
});

module.exports = router;
