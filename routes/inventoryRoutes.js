const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const StockTransaction = require("../models/StockTransaction");
const { isManagerOrAdmin } = require("../middleware/auth");

// BUG FIX: Category names now match exactly what the reports route expects
// and what makes sense for the product types in the Product model
function getCategoryFromProductType(productType) {
  if (productType.includes("Cement")) return "Cement";
  if (productType.includes("Iron Bar")) return "Steel/Iron";
  if (productType.includes("Nail")) return "Nails";
  if (productType === "Wheelbarrow") return "Equipment";
  if (productType === "Wire Mesh") return "Fencing / Wire Mesh";
  if (productType.includes("Barbed Wire")) return "Fencing";
  if (productType.includes("Iron Sheet")) return "Roofing";
  return "Other";
}

// MAIN INVENTORY PAGE
router.get("/", isManagerOrAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).populate("createdBy", "fullName");
    const totalSkus = products.length;
    const outOfStockCount = products.filter(p => p.currentStock === 0).length;
    const lowStockCount = products.filter(p => p.currentStock < 15 && p.currentStock > 0).length;
    const totalStockValue = products.reduce((sum, p) => sum + p.currentStock * p.unitCost, 0);
    const lowStockItems = products
      .filter(p => p.currentStock < 15 && p.currentStock > 0)
      .map(p => ({ name: p.productType, quantity: p.currentStock, reorderLevel: p.reorderLevel || 15 }));

    res.render("inventory", {
      products,
      totalSkus,
      lowStockCount,
      outOfStockCount,
      totalStockValue,
      lowStockItems,
      user: req.user,
      success_msg: req.flash("success_msg"),
      error_msg: req.flash("error_msg"),
    });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/dashboard");
  }
});

// ADD NEW PRODUCT - form page
router.get("/new", isManagerOrAdmin, (req, res) => {
  res.render("inventory-new", { user: req.user });
});

// ADD NEW PRODUCT - submit
// BUG FIX: Removed invalid productName field (it's a virtual). 
// BUG FIX: paymentStatus is now forced to lowercase to match model enum ("cash"/"credit").
// BUG FIX: Validation order corrected — checks happen before any DB writes.
router.post("/", isManagerOrAdmin, async (req, res) => {
  try {
    const {
      productType, unitCost, unitPrice, currentStock,
      reorderLevel, supplierName, supplierPhone, factoryName,
      paymentStatus, amountPaid, sku, description
    } = req.body;

    if (!productType || !unitCost || !unitPrice)
      throw new Error("Product type, cost, and price are required.");
    if (Number(unitPrice) <= Number(unitCost))
      throw new Error("Selling price must be greater than unit cost.");
    if (Number(unitCost) <= 0)
      throw new Error("Unit cost must be greater than zero.");

    const category = getCategoryFromProductType(productType);

    // Check if this product type already exists
    const existing = await Product.findOne({ productType });
    if (existing) throw new Error(`${productType} already exists in inventory. Use "Add Stock" to increase quantity.`);

    const product = new Product({
      productType,
      category,
      unitCost: Number(unitCost),
      unitPrice: Number(unitPrice),
      currentStock: Number(currentStock) || 0,
      reorderLevel: Number(reorderLevel) || 15,
      supplier: supplierName || "",
      sku: sku || "",
      description: description || "",
      createdBy: req.user._id,
    });
    await product.save();

    // Only create a StockTransaction if initial stock > 0
    if (Number(currentStock) > 0) {
      // BUG FIX: paymentStatus forced to lowercase to match enum
      const normalizedPaymentStatus = (paymentStatus || "cash").toLowerCase();
      if (!["cash", "credit"].includes(normalizedPaymentStatus))
        throw new Error("Invalid payment status. Must be cash or credit.");

      const paid = Number(amountPaid) || 0;
      const transaction = new StockTransaction({
        productId: product._id,
        productName: product.productType,
        quantityAdded: Number(currentStock),
        unitCost: Number(unitCost),
        unitPrice: Number(unitPrice),
        supplierName: supplierName || "Initial stock",
        supplierPhone: supplierPhone || "",
        factoryName: factoryName || "",
        paymentStatus: normalizedPaymentStatus,
        amountPaid: paid,
        recordedBy: req.user._id,
      });
      await transaction.save();
    }

    req.flash("success_msg", `${productType} added successfully!`);
    res.redirect("/inventory");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/inventory/new");
  }
});

// ADD STOCK - form page
router.get("/add-stock", isManagerOrAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ productType: 1 });
    res.render("inventory-add-stock", { products, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/inventory");
  }
});

// ADD STOCK - submit
// BUG FIX: paymentStatus forced to lowercase. 
// BUG FIX: amountPaid validated against totalCost to prevent impossible values.
// BUG FIX: unitPrice/unitCost comparison uses Number() to avoid string comparison bugs.
router.post("/add-stock", isManagerOrAdmin, async (req, res) => {
  try {
    const {
      productId, quantityAdded, unitCost, unitPrice,
      supplierName, supplierPhone, factoryName,
      paymentStatus, amountPaid
    } = req.body;

    if (!productId || !quantityAdded || Number(quantityAdded) <= 0)
      throw new Error("Invalid product or quantity. Quantity must be greater than zero.");
    if (!unitCost || Number(unitCost) <= 0)
      throw new Error("Unit cost must be greater than zero.");
    if (!unitPrice || Number(unitPrice) <= 0)
      throw new Error("Unit price must be greater than zero.");
    if (Number(unitPrice) <= Number(unitCost))
      throw new Error("Selling price must be greater than unit cost.");
    if (!supplierName || supplierName.trim() === "")
      throw new Error("Supplier name is required.");

    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found.");

    const normalizedPaymentStatus = (paymentStatus || "cash").toLowerCase();
    if (!["cash", "credit"].includes(normalizedPaymentStatus))
      throw new Error("Invalid payment status. Must be cash or credit.");

    const qty = Number(quantityAdded);
    const cost = Number(unitCost);
    const price = Number(unitPrice);
    const paid = Number(amountPaid) || 0;
    const totalCost = qty * cost;

    if (paid > totalCost)
      throw new Error(`Amount paid (${paid.toLocaleString()}) cannot exceed total cost (${totalCost.toLocaleString()}).`);

    // Update product stock and prices
    product.currentStock += qty;
    product.unitCost = cost;
    product.unitPrice = price;
    await product.save();

    const transaction = new StockTransaction({
      productId: product._id,
      productName: product.productType,
      quantityAdded: qty,
      unitCost: cost,
      unitPrice: price,
      supplierName: supplierName.trim(),
      supplierPhone: supplierPhone || "",
      factoryName: factoryName || "",
      paymentStatus: normalizedPaymentStatus,
      amountPaid: paid,
      recordedBy: req.user._id,
    });
    await transaction.save();

    req.flash("success_msg", `${qty} units of ${product.productType} added successfully. New stock: ${product.currentStock}.`);
    res.redirect("/inventory");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/inventory/add-stock");
  }
});

// STOCK TRANSACTIONS PAGE
router.get("/transactions", isManagerOrAdmin, async (req, res) => {
  try {
    const transactions = await StockTransaction.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("recordedBy", "fullName");
    res.render("inventory-transactions", { transactions, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/inventory");
  }
});

// EDIT PRODUCT - form page
router.get("/:id/edit", isManagerOrAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new Error("Product not found.");
    res.render("product-edit", { product, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/inventory");
  }
});

// EDIT PRODUCT - submit
// BUG FIX: Removed productName (it's a virtual, not a real field).
// BUG FIX: Used findById then save() instead of findByIdAndUpdate so pre-save hooks run.
// BUG FIX: Proper Number() coercion before comparison.
router.post("/:id", isManagerOrAdmin, async (req, res) => {
  try {
    const { productType, unitCost, unitPrice, currentStock, reorderLevel, supplier, sku, description } = req.body;

    if (!unitCost || !unitPrice)
      throw new Error("Unit cost and unit price are required.");
    if (Number(unitPrice) <= Number(unitCost))
      throw new Error("Selling price must be greater than unit cost.");
    if (Number(unitCost) <= 0)
      throw new Error("Unit cost must be greater than zero.");

    const product = await Product.findById(req.params.id);
    if (!product) throw new Error("Product not found.");

    const category = getCategoryFromProductType(productType || product.productType);

    product.productType = productType || product.productType;
    product.category = category;
    product.unitCost = Number(unitCost);
    product.unitPrice = Number(unitPrice);
    product.currentStock = Number(currentStock) || product.currentStock;
    product.reorderLevel = Number(reorderLevel) || product.reorderLevel;
    product.supplier = supplier || product.supplier;
    product.sku = sku || product.sku;
    product.description = description || product.description;

    await product.save();

    req.flash("success_msg", `${product.productType} updated successfully!`);
    res.redirect("/inventory");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect(`/inventory/${req.params.id}/edit`);
  }
});

// DELETE PRODUCT
// BUG FIX: Added check to prevent deleting products that still have stock
router.post("/:id/delete", isManagerOrAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new Error("Product not found.");
    if (product.currentStock > 0)
      throw new Error(`Cannot delete ${product.productType} — it still has ${product.currentStock} units in stock. Set stock to 0 first.`);

    await Product.findByIdAndDelete(req.params.id);
    req.flash("success_msg", `${product.productType} deleted successfully.`);
    res.redirect("/inventory");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/inventory");
  }
});

module.exports = router;