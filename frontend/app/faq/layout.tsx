import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'FAQ',
	description:
		'Frequently asked questions about Local Service Marketplace — answers about accounts, services, payments, and more.',
	alternates: { canonical: '/faq' },
	openGraph: {
		title: 'Frequently Asked Questions',
		description:
			'Frequently asked questions about Local Service Marketplace — answers about accounts, services, payments, and more.',
		url: '/faq',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Frequently Asked Questions',
		description:
			'Frequently asked questions about Local Service Marketplace — answers about accounts, services, payments, and more.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
