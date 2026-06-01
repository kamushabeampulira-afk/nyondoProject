const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const StockTransaction = require("../models/StockTransaction");
const CreditInvoice = require("../models/CreditInvoice");
const Supplier = require("../models/Supplier");
const { isManagerOrAdmin } = require("../middleware/auth");

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
router.get("/new", isManagerOrAdmin, async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ companyName: 1 });
    res.render("inventory-new", { suppliers, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/inventory");
  }
});

// ADD NEW PRODUCT - submit
router.post("/", isManagerOrAdmin, async (req, res) => {
  try {
    const {
      productType, unitCost, unitPrice, currentStock,
      reorderLevel, supplierId, supplierPhone, factoryName,
      paymentStatus, amountPaid, sku, description
    } = req.body;

    if (!productType || !unitCost || !unitPrice)
      throw new Error("Product type, cost, and price are required.");
    if (Number(unitPrice) <= Number(unitCost))
      throw new Error("Selling price must be greater than unit cost.");
    if (Number(unitCost) <= 0)
      throw new Error("Unit cost must be greater than zero.");

    //  Look up supplier by ID
    const supplier = supplierId ? await Supplier.findById(supplierId) : null;
    if (supplierId && !supplier)
      throw new Error("Selected supplier not found. Please refresh and try again.");

    const category = getCategoryFromProductType(productType);

    const existing = await Product.findOne({ productType });
    if (existing)
      throw new Error(`${productType} already exists in inventory. Use "Add Stock" to increase quantity.`);

    const product = new Product({
      productType,
      category,
      unitCost: Number(unitCost),
      unitPrice: Number(unitPrice),
      currentStock: Number(currentStock) || 0,
      reorderLevel: Number(reorderLevel) || 15,
      supplier: supplier ? supplier.companyName : "",
      sku: sku || "",
      description: description || "",
      createdBy: req.user._id,
    });
    await product.save();

    // Only create a StockTransaction if initial stock > 0
    if (Number(currentStock) > 0) {
      const normalizedPaymentStatus = (paymentStatus || "cash").toLowerCase();
      if (!["cash", "credit"].includes(normalizedPaymentStatus))
        throw new Error("Invalid payment status. Must be cash or credit.");

      const qty   = Number(currentStock);
      const cost  = Number(unitCost);
      const paid  = Number(amountPaid) || 0;
      const total = qty * cost;

      if (paid > total)
        throw new Error(`Amount paid (${paid.toLocaleString()} UGX) cannot exceed total cost (${total.toLocaleString()} UGX).`);

      const transaction = new StockTransaction({
        productId: product._id,
        productName: product.productType,
        quantityAdded: qty,
        unitCost: cost,
        unitPrice: Number(unitPrice),
        supplierId: supplier ? supplier._id : null,       // link to supplier
        supplierName: supplier ? supplier.companyName : "Initial stock",
        supplierPhone: supplierPhone || "",
        factoryName: factoryName || "",
        paymentStatus: normalizedPaymentStatus,
        amountPaid: paid,
        recordedBy: req.user._id,
      });
      await transaction.save();

      // Auto-create CreditInvoice for credit purchases
      if (normalizedPaymentStatus === "credit") {
        if (!supplier)
          throw new Error("A registered supplier is required for credit purchases.");

        const invoiceNumber = `STK-${transaction._id.toString().slice(-8).toUpperCase()}`;
        const invoice = new CreditInvoice({
          supplierId: supplier._id,
          invoiceNumber,
          purchaseDate: new Date(),
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          totalAmount: transaction.totalCost,
          paidAmount: paid,
          description: `Credit stock purchase — ${productType} x${qty} @ ${cost.toLocaleString()} UGX`,
          paymentTerms: "Net 15",
          stockTransactionId: transaction._id,
        });
        await invoice.save();
      }
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
    const suppliers = await Supplier.find().sort({ companyName: 1 }); // pass suppliers
    res.render("inventory-add-stock", { products, suppliers, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/inventory");
  }
});

// ADD STOCK - submit
router.post("/add-stock", isManagerOrAdmin, async (req, res) => {
  try {
    const {
      productId, quantityAdded, unitCost, unitPrice,
      supplierName, supplierPhone, factoryName,
      paymentStatus, amountPaid,
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
      throw new Error("Please select a supplier.");

    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found.");

    // Look up supplier by name (from the dropdown)
    const supplier = await Supplier.findOne({ companyName: supplierName.trim() });
    if (!supplier)
      throw new Error(`Supplier "${supplierName}" not found. Please add them under Suppliers first.`);

    const normalizedPaymentStatus = (paymentStatus || "cash").toLowerCase();
    if (!["cash", "credit"].includes(normalizedPaymentStatus))
      throw new Error("Invalid payment status. Must be cash or credit.");

    const qty   = Number(quantityAdded);
    const cost  = Number(unitCost);
    const price = Number(unitPrice);
    const paid  = Number(amountPaid) || 0;
    const total = qty * cost;

    if (paid > total)
      throw new Error(`Amount paid (${paid.toLocaleString()} UGX) cannot exceed total cost (${total.toLocaleString()} UGX).`);
    if (normalizedPaymentStatus === "credit" && paid >= total)
      throw new Error("If fully paid, please set payment status to 'Cash'.");

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
      supplierId: supplier._id,           
      supplierName: supplier.companyName,
      supplierPhone: supplierPhone || supplier.phone || "",
      factoryName: factoryName || "",
      paymentStatus: normalizedPaymentStatus,
      amountPaid: paid,
      recordedBy: req.user._id,
    });
    await transaction.save();

    // Auto-create CreditInvoice for credit purchases
    if (normalizedPaymentStatus === "credit") {
      const invoiceNumber = `STK-${transaction._id.toString().slice(-8).toUpperCase()}`;
      const invoice = new CreditInvoice({
        supplierId: supplier._id,
        invoiceNumber,
        purchaseDate: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        totalAmount: transaction.totalCost,
        paidAmount: paid,
        description: `Credit stock purchase — ${product.productType} x${qty} @ ${cost.toLocaleString()} UGX`,
        paymentTerms: "Net 15",
        stockTransactionId: transaction._id,
      });
      await invoice.save();
    }

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
      .populate("recordedBy", "fullName")
      .populate("supplierId", "companyName");
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

    product.productType  = productType  || product.productType;
    product.category     = category;
    product.unitCost     = Number(unitCost);
    product.unitPrice    = Number(unitPrice);
    product.currentStock = Number(currentStock) || product.currentStock;
    product.reorderLevel = Number(reorderLevel) || product.reorderLevel;
    product.supplier     = supplier    || product.supplier;
    product.sku          = sku         || product.sku;
    product.description  = description || product.description;

    await product.save();

    req.flash("success_msg", `${product.productType} updated successfully!`);
    res.redirect("/inventory");
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect(`/inventory/${req.params.id}/edit`);
  }
});

// DELETE PRODUCT
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