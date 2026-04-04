import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: {
    default: 'Admin Panel',
    template: '%s - Admin | Local Service Marketplace',
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
