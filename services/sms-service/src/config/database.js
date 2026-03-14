'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sms_delivery_service';

  const options = {
    maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
    serverSelectionTimeoutMS: parseInt(process.env.MONGODB_TIMEOUT_MS || '5000', 10),
    socketTimeoutMS: 45000,
  };

  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('MongoDB connected', { uri: uri.replace(/\/\/[^@]*@/, '//***@') });
  });
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error', { error: err.message });
  });

  await mongoose.connect(uri, options);
}

function getConnectionStatus() {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  return states[mongoose.connection.readyState] || 'unknown';
}

module.exports = connectDB;
module.exports.getConnectionStatus = getConnectionStatus;
