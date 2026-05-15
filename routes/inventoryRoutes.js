// routes/inventory.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { isManager } = require('../middleware/auth');   // changed

// Helper to map product type to category (optional but good for reports)
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

// GET /inventory – show inventory page
router.get('/', isManager, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const totalSkus = products.length;
    const lowStockCount = products.filter(p => p.currentStock <= (p.reorderLevel || 15) && p.currentStock > 0).length;
    const outOfStockCount = products.filter(p => p.currentStock === 0).length;
    const inTransitCount = 0; // placeholder

    res.render('inventory', {
      products,
      totalSkus,
      lowStockCount,
      outOfStockCount,
      inTransitCount,
      user: req.user,
      success_msg: req.session.success_msg,
      error_msg: req.session.error_msg
    });

    req.session.success_msg = null;
    req.session.error_msg = null;
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

// POST /inventory – add new product (using productType dropdown)
router.post('/', isManager, async (req, res) => {
  try {
    const { productType, unitCost, unitPrice, currentStock, reorderLevel, supplier, sku, description } = req.body;
    if (!productType || !unitCost || !unitPrice) {
      throw new Error('Product type, unit cost, and unit price are required.');
    }
    if (unitPrice <= unitCost) {
      throw new Error('Selling price must be greater than unit cost.');
    }

    const category = getCategoryFromProductType(productType);

    const product = new Product({
      productType,
      productName: productType, // for backward compatibility
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
    req.session.success_msg = `${productType} added successfully!`;
    res.redirect('/inventory');
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/inventory');
  }
});

// GET /inventory/:id/edit – show edit form
router.get('/:id/edit', isManager, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new Error('Product not found');
    res.render('product-edit', { product, user: req.user });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/inventory');
  }
});

// POST /inventory/:id – update product
router.post('/:id', isManager, async (req, res) => {
  try {
    const { productType, unitCost, unitPrice, currentStock, reorderLevel, supplier, sku, description } = req.body;
    if (unitPrice <= unitCost) {
      throw new Error('Selling price must be greater than unit cost.');
    }
    const category = getCategoryFromProductType(productType);
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
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
      },
      { new: true, runValidators: true }
    );
    if (!product) throw new Error('Product not found');
    req.session.success_msg = `${product.productType} updated successfully!`;
    res.redirect('/inventory');
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect(`/inventory/${req.params.id}/edit`);
  }
});

// POST /inventory/:id/delete – delete product
router.post('/:id/delete', isManager, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new Error('Product not found');
    req.session.success_msg = `${product.productType} deleted.`;
    res.redirect('/inventory');
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/inventory');
  }
});

module.exports = router;