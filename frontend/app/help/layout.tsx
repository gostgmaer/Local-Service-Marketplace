import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Help Center',
	description:
		'Find answers to common questions about Local Service Marketplace — guides, troubleshooting, and support resources.',
	alternates: { canonical: '/help' },
	openGraph: {
		title: 'Help Center',
		description:
			'Find answers to common questions about Local Service Marketplace — guides, troubleshooting, and support resources.',
		url: '/help',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Help Center',
		description:
			'Find answers to common questions about Local Service Marketplace — guides, troubleshooting, and support resources.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
