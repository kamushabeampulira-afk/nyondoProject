// routes/stock.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const { isManager } = require('../middleware/auth');   // changed

router.get('/add', isManager, async (req, res) => {
  const products = await Product.find().select('_id productName currentStock');
  res.render('add-stock', { products, user: req.user });
});

// Process stock addition – only managers
router.post('/add', isManager, async (req, res) => {
  try {
    const { productId, quantityAdded, unitCost, unitPrice, supplierName, supplierPhone, factoryName, paymentStatus } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).send('Product not found');
    if (unitPrice <= unitCost) return res.status(400).send('Selling price must be greater than unit cost');

    product.currentStock += Number(quantityAdded);
    product.unitCost = unitCost;
    product.unitPrice = unitPrice;
    await product.save();

    const transaction = new StockTransaction({
      productId, productName: product.productName, quantityAdded, unitCost,
      unitPrice, supplierName, supplierPhone, factoryName, paymentStatus,
      recordedBy: req.user._id
    });
    await transaction.save();

    res.redirect('/stock/add?success=true');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;