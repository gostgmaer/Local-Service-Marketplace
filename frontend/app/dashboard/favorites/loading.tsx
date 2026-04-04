import { Loading } from "@/components/ui/Loading";

export default function FavoritesLoading() {
	return (
		<div className='min-h-[60vh] flex items-center justify-center'>
			<Loading
				size='lg'
				text='Loading favorites...'
			/>
		</div>
	);
}
