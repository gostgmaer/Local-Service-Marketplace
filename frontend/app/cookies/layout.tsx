import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Cookie Policy',
	description:
		'Learn how Local Service Marketplace uses cookies to improve your experience and what choices you have.',
	alternates: { canonical: '/cookies' },
	openGraph: {
		title: 'Cookie Policy',
		description:
			'Learn how Local Service Marketplace uses cookies to improve your experience and what choices you have.',
		url: '/cookies',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Cookie Policy',
		description:
			'Learn how Local Service Marketplace uses cookies to improve your experience and what choices you have.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
