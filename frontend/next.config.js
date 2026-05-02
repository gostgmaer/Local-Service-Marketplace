const path = require('path');
/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
	enabled: process.env.ANALYZE === 'true',
	openAnalyzer: false,
});

// Extra connect-src origins can be injected via env var (space-separated).
// Default to the easydev.in wildcard if not explicitly overridden.
const extraConnectSrcEnv = process.env.NEXT_PUBLIC_EXTRA_CONNECT_SRC || 'https://*.easydev.in';

// Always allow the configured API URL origin so the CSP works regardless of
// whether the app is running locally (http://localhost:*) or against a remote
// backend. Derive the origin from NEXT_PUBLIC_API_URL (e.g. http://localhost:3700
// → http://localhost:3700). Fall back gracefully if the env var is absent.
const apiOrigin = (() => {
	try {
		const u = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3700');
		// Allow the entire host on that scheme so port differences don't matter.
		return `${u.protocol}//${u.hostname}:*`;
	} catch {
		return '';
	}
})();

// Derive WebSocket origin for CSP so socket.io connections through the gateway
// are allowed (wss:// in production, ws:// in dev).
const wsOrigin = (() => {
	try {
		const u = new URL(process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3700');
		const wsScheme = u.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${wsScheme}//${u.hostname}:*`;
	} catch {
		return '';
	}
})();

const extraConnectSrc = [extraConnectSrcEnv, apiOrigin, wsOrigin].filter(Boolean).join(' ');

const configuredBuildId = (
	process.env.NEXT_BUILD_ID ||
	process.env.GITHUB_SHA ||
	process.env.VERCEL_GIT_COMMIT_SHA ||
	process.env.CI_COMMIT_SHA ||
	''
)
	.replace(/[^a-zA-Z0-9_-]/g, '')
	.slice(0, 64);

const nextConfig = {
	// Use standalone output only for Docker builds
	...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" } : {}),
	...(configuredBuildId ? { generateBuildId: async () => configuredBuildId } : {}),
	outputFileTracingRoot: path.join(__dirname, '..'),
	reactStrictMode: true,
	compress: true,
	poweredByHeader: false,

	// Environment variables
	env: {
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3700",
		NEXT_PUBLIC_EXTRA_CONNECT_SRC: process.env.NEXT_PUBLIC_EXTRA_CONNECT_SRC || "https://*.easydev.in",
	},

	// Image optimization
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "**.cloudinary.com" },
			{ protocol: "https", hostname: "**.amazonaws.com" },
			{ protocol: "https", hostname: "cloudflare-ipfs.com" },
			{ protocol: "https", hostname: "avatars.githubusercontent.com" },
			{ protocol: "https", hostname: "**.blob.core.windows.net" },
			{ protocol: "https", hostname: "chart.googleapis.com" },
			{ protocol: "http", hostname: "localhost" },
		],
		formats: ["image/avif", "image/webp"],
		deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
	},

	// Security headers
	async headers() {
		return [
			// Next.js static chunks are content-hashed and safe for immutable caching.
			{
				source: "/_next/static/:path*",
				headers: [
					{ key: "Cache-Control", value: "public, max-age=31536000, immutable" },
				],
			},
			// Prevent bfcache for all protected routes so that navigating back
			// after logout always triggers a fresh server request (which the
			// middleware will redirect to /login if the session cookie is gone).
			{
				source: "/(dashboard|onboarding|checkout)/:path*",
				headers: [
					{ key: "Cache-Control", value: "no-store, max-age=0" },
				],
			},
			{
				source: "/:path*",
				headers: [
					{
						key: "Content-Security-Policy",
						value:
							process.env.NODE_ENV === "production" ?
								`default-src 'self'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ${extraConnectSrc} https://*.cloudinary.com https://*.amazonaws.com https://maps.googleapis.com wss://*.easydev.in; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`
								: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ${extraConnectSrc} https://*.cloudinary.com https://*.amazonaws.com https://maps.googleapis.com http://localhost:* ws://localhost:*; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`,
					},
					{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
				{ key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
					{ key: "Cross-Origin-Resource-Policy", value: "same-origin" },
					{ key: "X-DNS-Prefetch-Control", value: "on" },
					{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
					{ key: "X-Frame-Options", value: "SAMEORIGIN" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "X-XSS-Protection", value: "1; mode=block" },
					{ key: "Referrer-Policy", value: "origin-when-cross-origin" },
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
					{ key: "Origin-Agent-Cluster", value: "?1" },
				],
			},
		];
	},

	// API rewrites — use INTERNAL_API_URL for server-side (Docker) if set,
	// otherwise fall back to the public URL (local dev)
	async rewrites() {
		const internalUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://api-gateway:3700";
		return [{ source: "/api/v1/:path*", destination: `${internalUrl}/api/v1/:path*` }];
	},

	// Webpack optimization
	webpack: (config, { isServer, dev }) => {
		if (!isServer) {
			config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };

			// Split large charting libraries into separate lazy-loaded chunks
			if (!dev) {
				config.optimization.splitChunks = {
					...config.optimization.splitChunks,
					cacheGroups: {
						...config.optimization.splitChunks?.cacheGroups,
						recharts: {
							test: /[\\/]node_modules[\\/]recharts[\\/]/,
							name: 'recharts-core',
							chunks: 'all',
							priority: 40,
						},
						d3Vendor: {
							test: /[\\/]node_modules[\\/](d3-.*|victory-vendor|internmap|delaunator|robust-predicates)[\\/]/,
							name: 'd3-vendor',
							chunks: 'all',
							priority: 30,
						},
					},
				};

				config.performance = {
					hints: 'warning',
					maxAssetSize: 300 * 1024,        // 300 KB per asset (recharts core ~273 KB)
					maxEntrypointSize: 512 * 1024,    // 512 KB per entry point
				};
			}
		}
		// Enable polling for file watching on Windows (fixes HMR not reflecting changes)
		if (dev) {
			config.watchOptions = { poll: 1000, aggregateTimeout: 300 };
		}
		return config;
	},
};

module.exports = withBundleAnalyzer(nextConfig);
