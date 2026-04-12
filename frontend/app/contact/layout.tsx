import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Contact Us',
	description:
		'Get in touch with the Local Service Marketplace team. We are here to help with questions, feedback, and support.',
	alternates: { canonical: '/contact' },
	openGraph: {
		title: 'Contact Us',
		description:
			'Get in touch with the Local Service Marketplace team. We are here to help with questions, feedback, and support.',
		url: '/contact',
		images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Local Service Marketplace' }],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Contact Us',
		description:
			'Get in touch with the Local Service Marketplace team. We are here to help with questions, feedback, and support.',
	},
};

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
