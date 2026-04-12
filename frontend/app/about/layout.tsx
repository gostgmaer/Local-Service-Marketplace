import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'About Us',
	description:
		'Learn about Local Service Marketplace — our mission, team, and how we connect local service providers with customers.',
	alternates: { canonical: '/about' },
	openGraph: {
		title: 'About Us',
		description:
			'Learn about Local Service Marketplace — our mission, team, and how we connect local service providers with customers.',
		url: '/about',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'About Us',
		description:
			'Learn about Local Service Marketplace — our mission, team, and how we connect local service providers with customers.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
