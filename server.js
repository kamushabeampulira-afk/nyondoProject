// 1. DEPENDENCIES
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const flash = require('connect-flash');

const connectDB = require('./config/db');

// USER MODEL
const User = require('./models/User');

// AUTH MIDDLEWARE
const { ensureAuthenticated } = require('./middleware/auth');

// ROUTES – match your actual file names
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salesRoutes = require('./routes/saleRoutes');
const depositRoutes = require('./routes/depositSchemeRoutes');
const creditRoutes = require('./routes/supplierCreditRoutes');   // corrected name
const paymentRoutes = require('./routes/paymentRoutes');
const userRoutes = require('./routes/userRoutes');
const settingRoutes = require('./routes/settingRoutes');
const transportRoutes = require('./routes/transportRoutes');
const stockRoutes = require('./routes/stockRoutes');
const signupRoutes = require('./routes/signup');
const reportRoutes = require('./routes/reportRoutes');   // file is reports.js

// 2. INSTANTIATIONS
const app = express();
const PORT = process.env.PORT || 3000;

// 3. DATABASE CONNECTION
connectDB();

// 4. CONFIGURATIONS
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// STATIC FILES
app.use(express.static(path.join(__dirname, 'public')));

// BODY PARSING
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// SESSION
app.use(session({
  secret: 'Shussh',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 }
}));

// FLASH
app.use(flash());

// PASSPORT
app.use(passport.initialize());
app.use(passport.session());
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// GLOBAL VARIABLES – flash messages auto‑cleared
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// 5. ROUTES
app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/sales', salesRoutes);
app.use('/deposit-scheme', depositRoutes);
app.use('/supplier-credit', creditRoutes);
app.use('/payments', paymentRoutes);
app.use('/users', userRoutes);
app.use('/settings', settingRoutes);
app.use('/transport', transportRoutes);
app.use('/stock', stockRoutes);
app.use('/reports', reportRoutes);
app.use('/', signupRoutes)
// app.use('/', signRoute);

// Redirect /login to /auth/login for simplicity
app.get('/login', (req, res) => {
  res.redirect('/auth/login');
});

// DASHBOARD – with real database data
app.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const Sale = require('./models/Sale');
    const Product = require('./models/Product');
    const DepositMember = require('./models/DepositMember');
    const CreditInvoice = require('./models/CreditInvoice');

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    const todaySalesAgg = await Sale.aggregate([
      { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);
    const todaySales = todaySalesAgg[0]?.total || 0;

    const products = await Product.find();
    const stockValue = products.reduce((sum, p) => sum + (p.currentStock * p.unitCost), 0);

    const creditAgg = await CreditInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$outstanding' } } }
    ]);
    const creditBalance = creditAgg[0]?.total || 0;

    const depositMembers = await DepositMember.countDocuments();

    const lowStockCount = products.filter(p => p.currentStock <= (p.reorderLevel || 15) && p.currentStock > 0).length;

    const transactionsToday = await Sale.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    const pendingInvoices = await CreditInvoice.countDocuments({ outstanding: { $gt: 0 } });

    res.render('dashboard', {
      user: req.user,
      todaySales,
      stockValue,
      creditBalance,
      depositMembers,
      lowStockCount,
      transactionsToday,
      pendingInvoices
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to load dashboard data');
    res.redirect('/dashboard');
  }
});

// 404 HANDLER
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found', user: req.user });
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: err.message || 'Internal Server Error', user: req.user });
});

// 6. START SERVER
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});