// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ensureAuthenticated, allowRoles } = require('../middleware/auth');

// Helper: ensure only admin can access user management
router.use(ensureAuthenticated);
router.use(allowRoles(['Administrator']));

// GET /users – show user list
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-hash -salt');
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'Active').length;
    const adminCount = users.filter(u => u.role === 'Administrator').length;
    const managerCount = users.filter(u => u.role === 'Manager').length;
    res.render('users', {
      users,
      totalUsers,
      activeUsers,
      adminCount,
      managerCount,
      user: req.user
    });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

// POST /users – create new user (using passport-local-mongoose)
router.post('/', async (req, res) => {
  try {
    const { email, password, fullName, role, permissions, status, department } = req.body;
    const existing = await User.findOne({ email });
    if (existing) throw new Error('Email already registered');
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
    req.session.success_msg = `User ${fullName} created successfully`;
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/users');
});

// GET /users/:id/edit – show edit form (optional – you can create a `user-edit.pug`)
router.get('/:id/edit', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-hash -salt');
    if (!user) throw new Error('User not found');
    res.render('user-edit', { user, user: req.user });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/users');
  }
});

// POST /users/:id – update user (for edit form)
router.post('/:id', async (req, res) => {
  try {
    const { fullName, role, permissions, status, department } = req.body;
    await User.findByIdAndUpdate(req.params.id, { fullName, role, permissions, status, department });
    req.session.success_msg = 'User updated successfully';
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/users');
});

// POST /users/:id/delete – delete user
router.post('/:id/delete', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new Error('User not found');
    req.session.success_msg = `User ${user.fullName} deleted`;
  } catch (err) {
    req.session.error_msg = err.message;
  }
  res.redirect('/users');
});

module.exports = router;