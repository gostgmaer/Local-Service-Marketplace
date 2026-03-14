'use strict';

require('dotenv').config();

const app = require('./app');
const connectDB = require('./src/config/database');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { startRetryWorker, stopRetryWorker } = require('./src/services/retry.service');

const PORT = config.port;

async function startServer() {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      logger.info(`SMS Delivery Service running`, {
        port: PORT,
        env: config.nodeEnv,
        provider: config.sms.provider,
      });
    });

    // Start retry worker (every 60s)
    const retryHandle = startRetryWorker(60 * 1000);

    // Graceful shutdown
    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      stopRetryWorker(retryHandle);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

startServer();
