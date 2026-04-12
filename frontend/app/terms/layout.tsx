import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Terms of Service',
	description:
		'Review the terms of service for Local Service Marketplace — rules, policies, and legal agreements for using our platform.',
	alternates: { canonical: '/terms' },
	openGraph: {
		title: 'Terms of Service',
		description:
			'Review the terms of service for Local Service Marketplace — rules, policies, and legal agreements for using our platform.',
		url: '/terms',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Terms of Service',
		description:
			'Review the terms of service for Local Service Marketplace — rules, policies, and legal agreements for using our platform.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
