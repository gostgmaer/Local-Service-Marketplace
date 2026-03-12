export const servicesConfig = {
  auth: {
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    name: 'auth-service',
  },
  user: {
    url: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    name: 'user-service',
  },
  request: {
    url: process.env.REQUEST_SERVICE_URL || 'http://localhost:3003',
    name: 'request-service',
  },
  proposal: {
    url: process.env.PROPOSAL_SERVICE_URL || 'http://localhost:3004',
    name: 'proposal-service',
  },
  job: {
    url: process.env.JOB_SERVICE_URL || 'http://localhost:3005',
    name: 'job-service',
  },
  payment: {
    url: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006',
    name: 'payment-service',
  },
  messaging: {
    url: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3007',
    name: 'messaging-service',
  },
  notification: {
    url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008',
    name: 'notification-service',
  },
  review: {
    url: process.env.REVIEW_SERVICE_URL || 'http://localhost:3009',
    name: 'review-service',
  },
  admin: {
    url: process.env.ADMIN_SERVICE_URL || 'http://localhost:3010',
    name: 'admin-service',
  },
  analytics: {
    url: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3011',
    name: 'analytics-service',
  },
  infrastructure: {
    url: process.env.INFRASTRUCTURE_SERVICE_URL || 'http://localhost:3012',
    name: 'infrastructure-service',
  },
};

export const routingConfig = {
  '/auth': 'auth',
  '/users': 'user',
  '/providers': 'user',
  '/requests': 'request',
  '/proposals': 'proposal',
  '/jobs': 'job',
  '/payments': 'payment',
  '/messages': 'messaging',
  '/notifications': 'notification',
  '/reviews': 'review',
  '/admin': 'admin',
  '/analytics': 'analytics',
  '/events': 'infrastructure',
  '/background-jobs': 'infrastructure',
  '/rate-limits': 'infrastructure',
  '/feature-flags': 'infrastructure',
};

export const publicRoutes = [
	"/auth/signup",
	"/auth/login",
	"/auth/refresh",
	"/auth/password-reset/request",
	"/auth/password-reset/confirm",
	"/health",
	"/health/services",
];
