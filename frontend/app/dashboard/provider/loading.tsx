import { Loading } from "@/components/ui/Loading";

export default function ProviderDashboardLoading() {
	return (
		<div className='min-h-[60vh] flex items-center justify-center'>
			<Loading
				size='lg'
				text='Loading provider dashboard...'
			/>
		</div>
	);
}
