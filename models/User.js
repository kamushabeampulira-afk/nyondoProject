const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true },
  email: { type: String, required: true, unique: true },
  nin: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  nextOfKinName: { type: String, required: true },
  nextOfKinPhone: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "manager", "attendant"],   // changed
    default: "admin",
  },
 
  status: { 
    type: String, enum: ["Active", "Inactive"], default: "Active" },
 
 
  createdAt:
   { type: Date, default: Date.now },
});

userSchema.plugin(passportLocalMongoose, { usernameField: "email" });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);