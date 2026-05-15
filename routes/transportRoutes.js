const express = require('express');
const router = express.Router();
const DeliveryRecord = require('../models/DeliveryRecord');
const { isManagerOrAdmin } = require('../middleware/auth');

function calculateDeliveryFee(amount, distance) {
  if (amount >= 500000 && distance <= 10) return 0;
  let fee = 30000;
  if (distance > 10) fee += (distance - 10) * 1000;
  return fee;
}

router.get('/', isManagerOrAdmin, async (req, res) => {
  try {
    const deliveries = await DeliveryRecord.find().sort({ createdAt: -1 }).limit(20);
    let totalCollection = 0, freeDeliveries = 0;
    deliveries.forEach(d => { totalCollection += d.deliveryFee; if (d.deliveryFee === 0) freeDeliveries++; });
    res.render('transport', {
      deliveries,
      totalDeliveries: deliveries.length,
      totalCollection,
      freeDeliveries,
      user: req.user,
      resultFee: req.query.fee,
      resultAmount: req.query.amount,
      resultDistance: req.query.distance
    });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/dashboard');
  }
});

router.post('/calculate', isManagerOrAdmin, async (req, res) => {
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
    req.flash('success_msg', `Delivery recorded. Fee: ${fee === 0 ? 'Free' : fee.toLocaleString() + ' UGX'}`);
    res.redirect(`/transport?fee=${fee}&amount=${amount}&distance=${distance}`);
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/transport');
  }
});

router.post('/clear', isManagerOrAdmin, async (req, res) => {
  await DeliveryRecord.deleteMany({});
  req.flash('success_msg', 'All delivery history cleared.');
  res.redirect('/transport');
});

module.exports = router;