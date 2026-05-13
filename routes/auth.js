// routes/auth.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

// GET signup form
router.get('/signup', (req, res) => {
  res.render('signup', { error_msg: null, user: req.user });
});

// POST signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName, role, permissions, status, department } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      req.session.error_msg = 'Email already registered';
      return res.redirect('/signup');
    }
    const user = new User({
      email,
      fullName,
      role: role || 'Sales Attendant',
      permissions: permissions || {
        stockManagement: false,
        salesEntry: true,
        creditManagement: false,
        reports: false,
        userManagement: false,
        settings: false
      },
      status: status || 'Active',
      department: department || ''
    });
    await User.register(user, password);
    req.login(user, (err) => {
      if (err) {
        req.session.error_msg = err.message;
        return res.redirect('/signup');
      }
      req.session.success_msg = 'Account created! You are now logged in.';
      res.redirect('/dashboard');
    });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/signup');
  }
});

// GET login form
router.get('/login', (req, res) => {
  res.render('login', { error_msg: req.query.error, success_msg: req.query.success });
});

// POST login
router.post('/login', passport.authenticate('local', {
  failureRedirect: '/login?error=Invalid email or password',
  failureFlash: false // optional
}), (req, res) => {
  req.session.success_msg = `Welcome back, ${req.user.fullName}!`;
  res.redirect('/dashboard');
});

// GET logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      req.session.error_msg = err.message;
      return res.redirect('/dashboard');
    }
    req.session.success_msg = 'You have been logged out.';
    res.redirect('/login');
  });
});

module.exports = router;