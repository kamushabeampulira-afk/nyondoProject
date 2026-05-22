const express = require("express");
const router = express.Router();
const Setting = require("../models/Setting");
const { isAdmin } = require("../middleware/auth");

router.get("/", isAdmin, async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting();
      await settings.save();
    }
    res.render("settings", { settings, user: req.user });
  } catch (err) {
    req.flash("error_msg", err.message);
    res.redirect("/dashboard");
  }
});

router.post("/", isAdmin, async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) settings = new Setting();
    settings.company = req.body.company || settings.company;
    settings.financial = req.body.financial || settings.financial;
    settings.delivery = req.body.delivery || settings.delivery;
    settings.security = req.body.security || settings.security;
    await settings.save();
    req.flash("success_msg", "Settings saved successfully!");
  } catch (err) {
    req.flash("error_msg", err.message);
  }
  res.redirect("/settings");
});

module.exports = router;