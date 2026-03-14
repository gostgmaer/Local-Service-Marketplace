'use strict';

const winston = require('winston');
const config = require('../config');

const { combine, timestamp, json, colorize, printf } = winston.format;

const prettyFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
});

const transports = [];

if (config.nodeEnv !== "test") {
	transports.push(
		new winston.transports.Console({
			format:
				config.logging.format === "pretty" ?
					combine(colorize(), timestamp(), prettyFormat)
				:	combine(timestamp(), json()),
		}),
	);

	// Enable file logging only in production, and set filePath only in production
	if (config.nodeEnv === "production") {
		const filePath = config.logging.filePath || "./logs/sms-service.log";
		transports.push(
			new winston.transports.File({
				filename: filePath,
				format: combine(timestamp(), json()),
				maxsize: 10 * 1024 * 1024, // 10 MB
				maxFiles: 5,
				tailable: true,
			}),
		);
	}
} else {
	// Silence logs during tests
	transports.push(new winston.transports.Console({ silent: true }));
}

const logger = winston.createLogger({
  level: config.logging.level,
  transports,
});

module.exports = logger;
