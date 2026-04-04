import { Loading } from "@/components/ui/Loading";

export default function BrowseRequestsLoading() {
	return (
		<div className='min-h-[60vh] flex items-center justify-center'>
			<Loading
				size='lg'
				text='Loading available requests...'
			/>
		</div>
	);
}
