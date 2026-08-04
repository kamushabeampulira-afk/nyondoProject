const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true },
  email: {
  type: String,
  trim: true,
  lowercase: true,
  match: [
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    "Please enter a valid email address"
  ]
},  
  nin: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (value) {
        if (!value) return false;
        const normalized = value.replace(/\s+/g, '').toUpperCase();
        return /^[A-Z]{2}\d{14}$/.test(normalized);
      },
      message: "NIN must be a valid NIRA-style number with 2 letters followed by 14 digits"
    }
  },
  phone: { 
    type: String, 
    required: true,
    match: [/^0\d{9}$/, "Phone number must be 10 digits and start with 0"] 
  },
  nextOfKinName: { 
    type: String, 
    required: true 
  },
  nextOfKinPhone: { 
    type: String, 
    required: true 
  },
  role: {
    type: String,
    enum: ["admin", "manager", "attendant"],
    default: "admin",
  },
 
  status: { 
    type: String, enum: ["Active", "Inactive"], 
    default: "Active" 
  },
 
 
  createdAt:
   { 
    type: Date, 
    default: Date.now 
  },
});

userSchema.plugin(passportLocalMongoose, { usernameField: "email" });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);