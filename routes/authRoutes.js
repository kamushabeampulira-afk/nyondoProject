const express = require("express");
const passport = require("passport");
const router = express.Router();

router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash("error_msg", info.message || "Invalid email or password");
      return res.redirect("/auth/login");
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
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
