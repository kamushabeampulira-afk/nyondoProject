require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const mongoose = require("mongoose");
const passport = require("passport");
const flash = require("connect-flash");

const connectDB = require("./config/db");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "Shussh",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 },
  }),
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Global user & flash
app.use(flash());
// ...
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
});

// ========= MOUNT ROUTES (all other routes) =========
app.use("/auth", require("./routes/authRoutes"));
app.use("/customers", require("./routes/customerRoutes"));
app.use("/suppliers", require("./routes/supplierRoutes"));
app.use("/inventory", require("./routes/inventoryRoutes"));
app.use("/sales", require("./routes/saleRoutes"));
app.use("/deposit-scheme", require("./routes/depositSchemeRoutes"));
app.use("/supplier-credit", require("./routes/supplierCreditRoutes"));
app.use("/payments", require("./routes/paymentRoutes"));
app.use("/users", require("./routes/userRoutes"));
app.use("/dashboard", require("./routes/dashboardRoutes"));
app.use("/settings", require("./routes/settingRoutes"));
// app.use('/transport', require('./routes/transportRoutes'));
app.use("/reports", require("./routes/reportRoutes"));
// app.use('/', require('./routes/signup'));

// Root route – show landing page for non‑authenticated users
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/dashboard");
  } else {
    res.render("index"); // Render your landing page (index.pug)
  }
});
// 404 handler
app.use((req, res) => {
  res
    .status(404)
    .render("error", { message: "Page not found", user: req.user });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { message: err.message, user: req.user });
});

app.listen(PORT, () => console.log(`✅ Running on http://localhost:${PORT}`));
