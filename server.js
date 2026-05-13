// server.js – NYONDO Hardware Backend (Polished Version)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

// Import models (so they are registered with mongoose)
require('./models/User');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const supplierRoutes = require('./routes/suppliers');
const inventoryRoutes = require('./routes/inventory');
const salesRoutes = require('./routes/sales');
const depositRoutes = require('./routes/depositScheme');
const creditRoutes = require('./routes/supplierCredit');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');
const settingRoutes = require('./routes/settings');
const transportRoutes = require('./routes/transport');
const stockRoutes = require('./routes/stock');

// Import middleware
const { ensureAuthenticated } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/NyondoHardWare');
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};
connectDB();

// Middleware 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Express Session (store in memory – use connect-mongo for production)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 } // 30 minutes
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Make user and flash messages available to all templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.session.success_msg || null;
  res.locals.error_msg = req.session.error_msg || null;
  // Clear flash messages after they've been read
  req.session.success_msg = null;
  req.session.error_msg = null;
  next();
});

// Static files (CSS, images, client-side JS)
app.use(express.static(path.join(__dirname, 'public')));

// View engine – Pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Public Routes (no login required)
app.get('/', (req, res) => {
  res.render('index'); // your landing page (portal.pug)
});

app.get('/login', (req, res) => {
  res.render('login', { error_msg: req.query.error, success_msg: req.query.success });
});

app.get('/signup', (req, res) => {
  res.render('signup', { error_msg: null });
});

// Protected Routes (require login)
app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.user });
});

app.get('/invoice/:id', ensureAuthenticated, async (req, res) => {
  const Sale = require('./models/Sale');
  try {
    const sale = await Sale.findById(req.params.id).populate('attendant');
    if (!sale) return res.status(404).send('Invoice not found');
    res.render('invoice', { sale, user: req.user });
  } catch (err) {
    req.session.error_msg = err.message;
    res.redirect('/dashboard');
  }
});

// Routes
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

// 404 and Error Handlers
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found', user: req.user });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: err.message || 'Internal Server Error', user: req.user });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Yay🎉 Server running on http://localhost:${PORT}`);
});