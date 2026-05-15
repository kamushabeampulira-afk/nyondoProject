const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', 
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    req.flash('success_msg', `Welcome back, ${req.user.fullName}!`);
    res.redirect('/dashboard');
  }
);

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash('success_msg', 'You have been logged out successfully.');
    res.redirect('/login');
  });
});

module.exports = router;