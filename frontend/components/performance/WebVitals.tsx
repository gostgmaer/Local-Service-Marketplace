'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Core Web Vitals performance thresholds (Google recommendations)
 * https://web.dev/vitals/
 */
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },   // Largest Contentful Paint (ms)
  FID: { good: 100, poor: 300 },     // First Input Delay (ms)
  CLS: { good: 0.1, poor: 0.25 },   // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 },   // First Contentful Paint (ms)
  TTFB: { good: 800, poor: 1800 },   // Time to First Byte (ms)
  INP: { good: 200, poor: 500 },     // Interaction to Next Paint (ms)
};

type MetricName = keyof typeof THRESHOLDS;

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as MetricName];
  if (!threshold) return 'good';
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

export function WebVitals() {
  useReportWebVitals((metric) => {
    const rating = getRating(metric.name, metric.value);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const color =
        rating === 'good' ? '\x1b[32m' :
        rating === 'needs-improvement' ? '\x1b[33m' :
        '\x1b[31m';
      console.log(`${color}[Web Vital] ${metric.name}: ${metric.value.toFixed(2)} (${rating})\x1b[0m`);
    }

    // Send to analytics endpoint in production
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating,
        id: metric.id,
        page: window.location.pathname,
        timestamp: Date.now(),
      });

      // Use sendBeacon for reliability (won't block page unload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, body);
      } else {
        fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => {/* silently fail */});
      }
    }
  });

  return null;
}
