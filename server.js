// 1. DEPENDENCIES
require('dotenv').config();
const express = require('express');
const expressSession = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const flash = require('connect-flash');

const connectDB = require('./config/db');

// MODELS
const User = require('./models/User');

// 2. INSTANTIATION
const app = express();
const PORT = process.env.PORT || 3000;

// 3. DATABASE CONNECTION
connectDB();   // this should use process.env.MONGO_URI

// 4. CONFIGURATIONS
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'images')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// SESSION (in‑memory – fine for development)
app.use(expressSession({
  secret: process.env.SESSION_SECRET || 'Shussh',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 hours
}));

// FLASH
app.use(flash());

// PASSPORT
app.use(passport.initialize());
app.use(passport.session());
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// GLOBAL VARIABLES
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// 5. ROUTES (all mounted at '/')
app.use('/', require('./routes/authRoutes'));
app.use('/', require('./routes/dashboardRoutes'));
app.use('/', require('./routes/customerRoutes'));
app.use('/', require('./routes/supplierRoutes'));
app.use('/', require('./routes/inventoryRoutes'));
app.use('/', require('./routes/saleRoutes'));
app.use('/', require('./routes/depositSchemeRoutes'));
app.use('/', require('./routes/supplierCreditRoutes'));
app.use('/', require('./routes/paymentRoutes'));
app.use('/', require('./routes/userRoutes'));
app.use('/', require('./routes/settingRoutes'));
app.use('/', require('./routes/transportRoutes'));
// app.use('/', require('./routes/stock'));          
app.use('/', require('./routes/reportRoutes'));         
app.use('/', require('./routes/signup'));       

// Root route
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
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