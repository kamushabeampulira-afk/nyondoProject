// middleware/auth.js
module.exports = {
  // Ensure user is logged in
  ensureAuthenticated: (req, res, next) => {
    if (req.isAuthenticated()) return next();
    req.session.returnTo = req.originalUrl;
    req.session.error_msg = 'Please log in to continue.';
    res.redirect('/login');
  },

  // Role-based access control
  allowRoles: (roles) => (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.session.error_msg = 'Unauthorized – please login.';
      return res.redirect('/login');
    }
    if (!roles.includes(req.user.role)) {
      req.session.error_msg = 'You do not have permission to access this page.';
      return res.redirect('/dashboard');
    }
    next();
  }
};