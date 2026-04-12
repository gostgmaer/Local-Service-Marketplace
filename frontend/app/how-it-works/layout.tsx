import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'How It Works',
	description:
		'Discover how Local Service Marketplace works — post a request, get proposals from verified providers, and hire the best fit.',
	alternates: { canonical: '/how-it-works' },
	openGraph: {
		title: 'How It Works',
		description:
			'Discover how Local Service Marketplace works — post a request, get proposals from verified providers, and hire the best fit.',
		url: '/how-it-works',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'How It Works',
		description:
			'Discover how Local Service Marketplace works — post a request, get proposals from verified providers, and hire the best fit.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
