import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: {
		default: 'Dashboard',
		template: '%s - Dashboard | Local Service Marketplace',
	},
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className='flex min-h-screen bg-gray-50 dark:bg-gray-900'>
			<DashboardSidebar />
			<main className='flex-1 min-w-0'>{children}</main>
		</div>
	);
}
