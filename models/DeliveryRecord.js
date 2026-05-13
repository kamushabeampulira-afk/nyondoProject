const mongoose = require("mongoose");

const deliveryRecordSchema = new mongoose.Schema({
  customerName: String,
  purchaseAmount: {
    type: Number,
    required: true,
  },
  distance: {
    type: Number,
    required: true,
  },
  deliveryFee: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    default: "Completed",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports =
  mongoose.models.DeliveryRecord ||
  mongoose.model("DeliveryRecord", deliveryRecordSchema);
