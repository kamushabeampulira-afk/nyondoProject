const express = require("express");
const router = express.Router();
const Supplier = require("../models/Supplier");
const CreditInvoice = require("../models/CreditInvoice");
const { isManagerOrAdmin } = require("../middleware/auth");

router.get("/", isManagerOrAdmin, async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ companyName: 1 });
    const totalSuppliers = suppliers.length;
    let totalOutstanding = 0;
    let overduePayments = 0;
    const suppliersWithOutstanding = await Promise.all(
      suppliers.map(async (sup) => {
        const invoices = await CreditInvoice.find({ supplierId: sup._id, status: { $ne: "Paid" } });
        const outstanding = invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
        totalOutstanding += outstanding;
        return { ...sup.toObject(), outstandingBalance: outstanding };
      }),
    );
    const activeOrders = 4;
    res.render("suppliers", {
      suppliers: suppliersWithOutstanding,
      totalSuppliers,
      totalOutstanding,
      totalOutstandingDisplay: totalOutstanding,
      overduePayments,
      activeOrders,
      user: req.user,
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/dashboard");
  }
});

router.post("/", isManagerOrAdmin, async (req, res) => {
  try {
    const { companyName, contactPerson, phone, email, address, paymentTerms, creditLimit, productsSupplied } = req.body;
    const existing = await Supplier.findOne({ companyName });
    if (existing) throw new Error("Supplier with that company name already exists");
    const supplier = new Supplier({ companyName, contactPerson, phone, email, address, paymentTerms, creditLimit, productsSupplied });
    await supplier.save();
    req.flash("success_msg", `Supplier ${companyName} added successfully!`);
  } catch (err) {
    req.flash("error_msg", err.message);
  }
  res.redirect("/suppliers");
});

router.get("/:id/edit", isManagerOrAdmin, async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) throw new Error("Supplier not found");
    res.render("supplier-edit", { supplier, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/suppliers");
  }
});

router.post("/:id", isManagerOrAdmin, async (req, res) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, req.body, { runValidators: true });
    req.flash("success_msg", "Supplier updated successfully");
  } catch (err) {
    req.flash("error_msg", err.message);
  }
  res.redirect("/suppliers");
});

module.exports = router;