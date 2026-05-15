// routes/settings.js
const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const { isAdmin } = require('../middleware/auth');   // changed

// GET /settings – show settings form
router.get('/', isAdmin, async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      // Create default settings if none exist
      settings = new Setting();
      await settings.save();
    }
    res.render('settings', { settings, user: req.user });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

// POST /settings – update settings
router.post('/', isAdmin, async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) settings = new Setting();
    // Update nested fields
    settings.company = req.body.company || settings.company;
    settings.financial = req.body.financial || settings.financial;
    settings.delivery = req.body.delivery || settings.delivery;
    settings.security = req.body.security || settings.security;
    await settings.save();
    req.session.success_msg = 'Settings saved successfully!';
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/settings');
});

module.exports = router;