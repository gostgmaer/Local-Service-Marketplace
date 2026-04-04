import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Account',
    template: '%s | Local Service Marketplace',
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
