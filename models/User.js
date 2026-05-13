// models/User.js
const mongoose = require('mongoose');
const passportLocalMongoose =
  require('passport-local-mongoose').default ||
  require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['Administrator', 'Manager', 'Sales Attendant'], default: 'Sales Attendant' },
  permissions: {
    stockManagement: { type: Boolean, default: false },
    salesEntry: { type: Boolean, default: true },
    creditManagement: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    userManagement: { type: Boolean, default: false },
    settings: { type: Boolean, default: false }
  },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  department: String,
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now }
});

// Plugin must be called with the function, not an object
userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);