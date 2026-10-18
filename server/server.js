require('dotenv').config();
const app = require('./src/app');
const mongoose = require('mongoose');
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Signal API listening on ${PORT}`);
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
      console.log('MongoDB connected');
    } catch (error) {
      console.error('MongoDB connection failed:', error.message);
    }
  } else {
    console.warn('MONGODB_URI is not set. API starts in non-persistent mode.');
  }
});
