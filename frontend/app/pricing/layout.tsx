import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Pricing Plans',
	description:
		'View pricing plans and fees for Local Service Marketplace — transparent costs for customers and service providers.',
	alternates: { canonical: '/pricing' },
	openGraph: {
		title: 'Pricing Plans',
		description:
			'View pricing plans and fees for Local Service Marketplace — transparent costs for customers and service providers.',
		url: '/pricing',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Pricing Plans',
		description:
			'View pricing plans and fees for Local Service Marketplace — transparent costs for customers and service providers.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
