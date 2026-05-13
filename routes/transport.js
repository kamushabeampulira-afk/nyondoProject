// routes/transport.js
const express = require('express');
const router = express.Router();
const DeliveryRecord = require('../models/DeliveryRecord');
const { ensureAuthenticated } = require('../middleware/auth');

// Helper: calculate delivery fee
function calculateDeliveryFee(amount, distance) {
  if (amount >= 500000 && distance <= 10) return 0;
  let fee = 30000;
  if (distance > 10) fee += (distance - 10) * 1000;
  return fee;
}

// GET /transport – show all deliveries
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const deliveries = await DeliveryRecord.find().sort({ createdAt: -1 }).limit(20);
    let totalCollection = 0;
    let freeDeliveries = 0;
    deliveries.forEach(d => {
      totalCollection += d.deliveryFee;
      if (d.deliveryFee === 0) freeDeliveries++;
    });
    res.render('transport', {
      deliveries,
      totalDeliveries: deliveries.length,
      totalCollection,
      freeDeliveries,
      user: req.user,
      // For result message (if coming from a POST)
      resultFee: req.query.fee,
      resultAmount: req.query.amount,
      resultDistance: req.query.distance
    });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

// POST /transport/calculate – save a new delivery
router.post('/calculate', ensureAuthenticated, async (req, res) => {
  try {
    let { amount, distance, customerName } = req.body;
    amount = parseFloat(amount);
    distance = parseFloat(distance);
    if (isNaN(amount) || amount <= 0) throw new Error('Invalid purchase amount');
    if (isNaN(distance) || distance < 0) throw new Error('Invalid distance');
    const fee = calculateDeliveryFee(amount, distance);
    const record = new DeliveryRecord({
      customerName: customerName || 'Walk-in Customer',
      purchaseAmount: amount,
      distance,
      deliveryFee: fee,
      status: 'Completed'
    });
    await record.save();
    req.session.success_msg = `Delivery recorded. Fee: ${fee === 0 ? 'Free' : fee.toLocaleString() + ' UGX'}`;
    // Redirect with query parameters to show result in alert
    res.redirect(`/transport?fee=${fee}&amount=${amount}&distance=${distance}`);
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/transport');
  }
});

// POST /transport/clear – delete all delivery records
router.post('/clear', ensureAuthenticated, async (req, res) => {
  try {
    await DeliveryRecord.deleteMany({});
    req.session.success_msg = 'All delivery history cleared.';
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/transport');
});

module.exports = router;