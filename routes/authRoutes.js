const express = require("express");
const passport = require("passport");
const User = require("../models/User");
const router = express.Router();

// Setup route - for creating first admin user
router.get("/setup", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return res.redirect("/auth/login");
    }
    res.render("setup");
  } catch (err) {
    console.error(err);
    res.render("setup", { error_msg: ["Error checking database"] });
  }
});

router.post("/setup", async (req, res) => {
  try {
    const { fullName, email, password, nin, phone, nextOfKinName, nextOfKinPhone } = req.body;

    // Check if users already exist
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("setup", { error_msg: ["User with this email already exists"] });
    }

    // Validate inputs
    if (!fullName || !email || !password || !nin || !phone || !nextOfKinName || !nextOfKinPhone) {
      return res.render("setup", { error_msg: ["All fields are required"] });
    }

    // Create new user
    const user = new User({
      fullName,
      email,
      nin,
      phone,
      nextOfKinName,
      nextOfKinPhone,
      role: "admin",
      status: "Active"
    });

    // Register with password using passport-local-mongoose
    await User.register(user, password);
    
    req.flash("success_msg", "Admin user created successfully! You can now login.");
    res.redirect("/auth/login");
  } catch (err) {
    console.error(err);
    const errorMsg = err.message || "Error creating user";
    res.render("setup", { error_msg: [errorMsg] });
  }
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/login", (req, res, next) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  console.log("=== LOGIN ATTEMPT ===");
  console.log("Email:", email);
  console.log("Password provided:", !!password);

  // Client-side validation checks
  if (!email || !password) {
    console.log("Missing email or password");
    req.flash("error_msg", "Please provide both email and password");
    return res.render("login", { 
      error_msg: ["Please provide both email and password"],
      email
    });
  }

  req.body.email = email;

  passport.authenticate("local", { failureFlash: true }, (err, user, info) => {
    console.log("Passport callback:");
    console.log("  Error:", err);
    console.log("  User found:", !!user);
    console.log("  Info:", info);

    if (err) {
      console.error("Passport error:", err);
      return next(err);
    }
    if (!user) {
      const errorMsg = info?.message || "Invalid email or password. Please check your credentials.";
      console.log("Auth failed:", errorMsg);
      return res.render("login", {
        error_msg: [errorMsg],
        email
      });
    }

    console.log("User authenticated:", user.email);
    req.logIn(user, (err) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      console.log("Session created for:", user.email);
      req.flash("success_msg", `Welcome back, ${user.fullName}!`);
      return res.redirect("/dashboard");
    });
  })(req, res, next);
});

router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success_msg", "You have been logged out successfully.");
    res.redirect("/auth/login");
  });
});

module.exports = router;
