import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Careers',
	description:
		'Join the Local Service Marketplace team. View open positions and help connect communities with trusted local service providers.',
	alternates: { canonical: '/careers' },
	openGraph: {
		title: 'Careers at Local Service Marketplace',
		description:
			'Join the Local Service Marketplace team. View open positions and help connect communities with trusted local service providers.',
		url: '/careers',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Careers at Local Service Marketplace',
		description:
			'Join the Local Service Marketplace team. View open positions and help connect communities with trusted local service providers.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
