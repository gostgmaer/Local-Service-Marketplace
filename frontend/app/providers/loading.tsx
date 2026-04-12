export default function Loading() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{/* Header skeleton */}
				<div className="mb-8">
					<div className="h-9 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-3" />
					<div className="h-5 w-96 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
				</div>

				{/* Filters skeleton */}
				<div className="flex flex-wrap gap-3 mb-8">
					<div className="h-10 w-56 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
					<div className="h-10 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
					<div className="h-10 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
					<div className="h-10 w-28 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
				</div>

				{/* Provider card grid skeleton */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							key={i}
							className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 animate-pulse"
						>
							{/* Avatar + name row */}
							<div className="flex items-center gap-4 mb-4">
								<div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-800 flex-shrink-0" />
								<div className="flex-1 min-w-0">
									<div className="h-5 w-36 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
									<div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
								</div>
							</div>

							{/* Bio lines */}
							<div className="space-y-2 mb-4">
								<div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded" />
								<div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-800 rounded" />
								<div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
							</div>

							{/* Stats row */}
							<div className="flex gap-4 mb-5">
								<div className="h-4 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
								<div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
								<div className="h-4 w-14 bg-gray-200 dark:bg-gray-800 rounded" />
							</div>

							{/* CTA button */}
							<div className="h-10 w-full bg-gray-200 dark:bg-gray-800 rounded-lg" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
