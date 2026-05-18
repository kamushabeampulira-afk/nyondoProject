module.exports = {
  ensureAuthenticated: (req, res, next) => {
    if (req.isAuthenticated()) return next();
    req.session.returnTo = req.originalUrl;
    req.session.error_msg = 'Please log in to continue.';
    res.redirect('auth/login');
  },

  allowRoles: (roles) => (req, res, next) => {
    if (!req.isAuthenticated()) {
      req.session.error_msg = 'Unauthorized – please login.';
      return res.redirect('auth/login');
    }
    if (!roles.includes(req.user.role)) {
      req.session.error_msg = 'You do not have permission to access this page.';
      return res.redirect('/dashboard');
    }
    next();
  },

  isAdmin: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'admin') return next();
    req.session.error_msg = 'Access denied. Admin rights required.';
    res.redirect('/dashboard');
  },

  isManager: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'manager') return next();
    req.session.error_msg = 'Access denied. Manager rights required.';
    res.redirect('/dashboard');
  },

  isAttendant: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'attendant') return next();
    req.session.error_msg = 'Access denied. Attendant rights required.';
    res.redirect('/dashboard');
  },

  isManagerOrAdmin: (req, res, next) => {
    if (req.isAuthenticated() && (req.user.role === 'manager' || req.user.role === 'admin')) return next();
    req.session.error_msg = 'Access denied. Manager or Admin rights required.';
    res.redirect('/dashboard');
  },

  isSalesOrAdmin: (req, res, next) => {
    if (req.isAuthenticated() && (req.user.role === 'sales' || req.user.role === 'admin')) return next();
    req.session.error_msg = 'Access denied. Sales or Admin rights required.';
    res.redirect('/dashboard');
  }
};