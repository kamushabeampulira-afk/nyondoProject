const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');

// All routes require admin
router.use(isAdmin);

// GET /users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-hash -salt');
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'Active').length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const managerCount = users.filter(u => u.role === 'manager').length;
    res.render('users', {
      users,
      totalUsers,
      activeUsers,
      adminCount,
      managerCount,
      user: req.user
    });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/dashboard');
  }
});

// POST /users – create
router.post('/', async (req, res) => {
  try {
    const { email, password, fullName, nin, phone, nextOfKinName, nextOfKinPhone, role, status } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { nin }] });
    if (existing) throw new Error('Email or NIN already registered');

    // Convert role to lowercase for consistency
    let userRole = (role || 'sales').toLowerCase();
    if (userRole === 'administrator') userRole = 'admin';
    if (userRole === 'manager') userRole = 'manager';
    if (userRole === 'attendant') userRole = 'attendant';

    const user = new User({
      email,
      fullName,
      nin,
      phone,
      nextOfKinName,
      nextOfKinPhone,
      role: userRole,
      status: status || 'Active',
       
    });
    await User.register(user, password);
    req.flash('success_msg', `User ${fullName} created successfully`);
    res.redirect('/users');
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/users');
  }
});

// GET edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-hash -salt');
    if (!user) throw new Error('User not found');
    res.render('user-edit', { user, currentUser: req.user });
  } catch (err) {
    req.flash('error_msg', err.message);
    res.redirect('/users');
  }
});

// POST update
router.post('/:id', async (req, res) => {
  try {
    const { fullName, role, status, department } = req.body;
    let userRole = (role || 'sales').toLowerCase();
    if (userRole === 'administrator') userRole = 'admin';
    await User.findByIdAndUpdate(req.params.id, { fullName, role: userRole, status, department });
    req.flash('success_msg', 'User updated successfully');
  } catch (err) {
    req.flash('error_msg', err.message);
  }
  res.redirect('/users');
});

// POST delete
router.post('/:id/delete', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new Error('User not found');
    req.flash('success_msg', `User ${user.fullName} deleted`);
  } catch (err) {
    req.flash('error_msg', err.message);
  }
  res.redirect('/users');
});

module.exports = router;