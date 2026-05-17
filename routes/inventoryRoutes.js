const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const { isManager } = require('../middleware/auth');

// Helper to map product type to category
function getCategoryFromProductType(productType) {
  if (productType.includes('Cement')) return 'Cement';
  if (productType.includes('Iron Bar')) return 'Steel / Iron Bars';
  if (productType.includes('Nail')) return 'Nails';
  if (productType === 'Wheelbarrow') return 'Equipment';
  if (productType === 'Wire Mesh') return 'Fencing / Wire Mesh';
  if (productType.includes('Barbed Wire')) return 'Fencing';
  if (productType.includes('Iron Sheet')) return 'Roofing Sheets';
  return 'Other';
}

// GET /inventory – main inventory page
router.get('/inventory', isManager, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const totalSkus = products.length;
    const lowStockCount = products.filter(p => p.currentStock <= (p.reorderLevel || 15) && p.currentStock > 0).length;
    const outOfStockCount = products.filter(p => p.currentStock === 0).length;
    const totalStockValue = products.reduce((sum, p) => sum + (p.currentStock * p.unitCost), 0);

    // Real low stock items for alerts
    const lowStockItems = products
      .filter(p => p.currentStock <= (p.reorderLevel || 15) && p.currentStock > 0)
      .map(p => ({ name: p.productName, quantity: p.currentStock, reorderLevel: p.reorderLevel || 15 }));

    // Stock transactions (last 20)
    const stockTransactions = await StockTransaction.find()
      .populate('productId', 'productName')
      .sort({ createdAt: -1 })
      .limit(20);

    res.render('inventory', {
      products,
      totalSkus,
      lowStockCount,
      outOfStockCount,
      totalStockValue,
      lowStockItems,
      stockTransactions,
      user: req.user,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/dashboard');
  }
});

// POST /inventory – add new product
router.post('/inventory', isManager, async (req, res) => {
  try {
    const { productType, unitCost, unitPrice, currentStock, reorderLevel, supplier, sku, description } = req.body;
    if (!productType || !unitCost || !unitPrice) throw new Error('Product type, cost, and price are required.');
    if (unitPrice <= unitCost) throw new Error('Selling price must be greater than unit cost.');
    const category = getCategoryFromProductType(productType);
    const product = new Product({
      productType,
      productName: productType,
      category,
      unitCost,
      unitPrice,
      currentStock: Number(currentStock) || 0,
      reorderLevel: reorderLevel || 15,
      supplier: supplier || '',
      sku: sku || '',
      description: description || ''
    });
    await product.save();

    // If initial stock >0, create a transaction
    if (currentStock > 0) {
      const transaction = new StockTransaction({
        productId: product._id,
        productName: product.productName,
        quantityAdded: Number(currentStock),
        unitCost,
        unitPrice,
        supplierName: supplier || 'Initial stock',
        paymentStatus: 'cash',
        recordedBy: req.user._id
      });
      await transaction.save();
    }

    req.flash('success_msg', `${productType} added successfully!`);
    res.redirect('/inventory');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/inventory');
  }
});

// POST /inventory/add-stock – add stock to existing product (AJAX or regular POST)
router.post('/inventory/add-stock', isManager, async (req, res) => {
  try {
    const { productId, quantityAdded, unitCost, unitPrice, supplierName, supplierPhone, factoryName, paymentStatus } = req.body;
    if (!productId || !quantityAdded || quantityAdded <= 0) throw new Error('Invalid product or quantity');
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');
    if (unitPrice <= unitCost) throw new Error('Selling price must be greater than unit cost');

    product.currentStock += Number(quantityAdded);
    product.unitCost = unitCost;
    product.unitPrice = unitPrice;
    await product.save();

    const transaction = new StockTransaction({
      productId: product._id,
      productName: product.productName,
      quantityAdded: Number(quantityAdded),
      unitCost,
      unitPrice,
      supplierName: supplierName || 'Unknown',
      supplierPhone,
      factoryName,
      paymentStatus: paymentStatus || 'cash',
      recordedBy: req.user._id
    });
    await transaction.save();

    req.flash('success_msg', `${quantityAdded} units added to ${product.productName}`);
    res.redirect('/inventory');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/inventory');
  }
});

// GET /inventory/:id/edit
router.get('/inventory/:id/edit', isManager, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new Error('Product not found');
    res.render('product-edit', { product, user: req.user });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/inventory');
  }
});

// POST /inventory/:id – update product
router.post('/inventory/:id', isManager, async (req, res) => {
  try {
    const { productType, unitCost, unitPrice, currentStock, reorderLevel, supplier, sku, description } = req.body;
    if (unitPrice <= unitCost) throw new Error('Selling price must be greater than unit cost.');
    const category = getCategoryFromProductType(productType);
    await Product.findByIdAndUpdate(req.params.id, {
      productType,
      productName: productType,
      category,
      unitCost,
      unitPrice,
      currentStock,
      reorderLevel,
      supplier,
      sku,
      description
    }, { runValidators: true });
    req.flash('success_msg', `${productType} updated successfully!`);
    res.redirect('/inventory');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect(`/inventory/${req.params.id}/edit`);
  }
});

// POST /inventory/:id/delete – delete product
router.post('/inventory/:id/delete', isManager, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new Error('Product not found');
    req.flash('success_msg', `${product.productType} deleted.`);
    res.redirect('/inventory');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/inventory');
  }
});

module.exports = router;