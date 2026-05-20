// routes/customers.js
const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const { isSalesOrAdmin } = require("../middleware/auth");

// GET /customers
router.get("/", isSalesOrAdmin, async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.render("customers", {
      customers,
      totalCustomers: customers.length,
      user: req.user,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/dashboard");
  }
});

// POST /customers
router.post("/", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    req.flash("success_msg", `Customer ${customer.fullName} added successfully!`);
    res.redirect("/customers");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/customers");
  }
});

// GET /customers/:id
router.get("/:id", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      req.flash("error_msg", "Customer not found");
      return res.redirect("/customers");
    }
    res.render("customer-detail", { customer, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/customers");
  }
});

// GET /customers/:id/edit
router.get("/:id/edit", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      req.flash("error_msg", "Customer not found");
      return res.redirect("/customers");
    }
    res.render("customer-edit", { customer, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/customers");
  }
});

// POST /customers/:id
router.post("/:id", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!customer) throw new Error("Customer not found");
    req.flash("success_msg", `Customer ${customer.fullName} updated successfully!`);
    res.redirect("/customers");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect(`/customers/${req.params.id}/edit`);
  }
});

// POST /customers/:id/delete
router.post("/:id/delete", isSalesOrAdmin, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) throw new Error("Customer not found");
    req.flash("success_msg", `Customer ${customer.fullName} deleted.`);
    res.redirect("/customers");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/customers");
  }
});

module.exports = router;