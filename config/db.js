const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI?.trim() || 'mongodb://127.0.0.1:27017/nyondoProject';

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    console.log(`Yaay🎉🎉MongoDB connected to ${mongoUri}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);

    if (mongoUri.includes('mongodb+srv://')) {
      try {
        const fallbackUri = 'mongodb://127.0.0.1:27017/nyondoProject';
        await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        console.log('MongoDB connected to local fallback');
      } catch (fallbackErr) {
        console.error('Local MongoDB fallback failed:', fallbackErr.message);
      }
    }
  }
};

module.exports = connectDB;