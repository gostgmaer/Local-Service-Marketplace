import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Privacy Policy',
	description:
		'Read our privacy policy — how we collect, use, and protect your personal information on Local Service Marketplace.',
	alternates: { canonical: '/privacy' },
	openGraph: {
		title: 'Privacy Policy',
		description:
			'Read our privacy policy — how we collect, use, and protect your personal information on Local Service Marketplace.',
		url: '/privacy',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Privacy Policy',
		description:
			'Read our privacy policy — how we collect, use, and protect your personal information on Local Service Marketplace.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
