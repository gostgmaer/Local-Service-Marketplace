'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useAuth";
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { DataTable } from "@/components/ui";
import { adminService } from '@/services/admin-service';
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDate } from '@/utils/helpers';
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import Link from "next/link";
import { Loading } from "@/components/ui";
import { useMemo, useState } from "react";
import type { ColumnFiltersState, SortingState, Table } from "@tanstack/react-table";

type DisputeRow = { id: string; job_id?: string; reason?: string; status: string; created_at: string };

const mapDisputeSortBy = (field?: string): "createdAt" | "status" | "resolvedAt" => {
	switch (field) {
		case "status":
			return "status";
		default:
			return "createdAt";
	}
};


export default function AdminDisputesPage() {
  const { user } = useAuth();
	const [serverSorting, setServerSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
	const [serverFilters, setServerFilters] = useState<ColumnFiltersState>([]);
	const [serverPageIndex, setServerPageIndex] = useState(0);
	const [serverPageSize, setServerPageSize] = useState(10);

	const statusFilter = String(serverFilters.find((f) => f.id === "status")?.value || "");
	const activeSort = serverSorting[0];

  const {
		data: disputes,
		isLoading,
		isFetching,
		error,
		refetch,
	} = useQuery({
		queryKey: ["admin-disputes", serverPageIndex, serverPageSize, statusFilter, activeSort?.id, activeSort?.desc],
		queryFn: () =>
			adminService.getDisputes({
				page: serverPageIndex + 1,
				limit: serverPageSize,
				status: statusFilter || undefined,
				sortBy: mapDisputeSortBy(activeSort?.id),
				sortOrder: activeSort?.desc ? "desc" : "asc",
			}),
		enabled: user?.role === "admin",
		placeholderData: (previousData) => previousData,
	});

	const disputeList: DisputeRow[] = disputes?.data || [];

  return (
		<ProtectedRoute requiredRoles={["admin"]}>
			<Layout>
				<div className='container-custom py-12'>
					<div className='mb-8'>
						<h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>Dispute Management</h1>
						<p className='text-gray-600 dark:text-gray-400'>
							Review and resolve disputes between customers and providers
						</p>
					</div>

					<Card>
						<CardHeader>
							<h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
								All Disputes ({disputes?.total || disputeList.length})
							</h2>
						</CardHeader>
						<CardContent>
							{isLoading && !disputes ?
								<Loading size='sm' />
							: error ?
								<ErrorState
									title='Failed to load disputes'
									message="We couldn't load dispute data. Please try again."
									retry={() => refetch()}
								/>
							:	<DataTable<DisputeRow>
									data={disputeList}
									getRowKey={(row: DisputeRow) => row.id}
									processingMode='server'
									serverTotalRows={disputes?.total ?? disputeList.length}
									serverPageIndex={serverPageIndex}
									serverPageSize={serverPageSize}
									serverSorting={serverSorting}
									serverColumnFilters={serverFilters}
									onServerPageIndexChange={setServerPageIndex}
									onServerPageSizeChange={setServerPageSize}
									onServerSortingChange={setServerSorting}
									onServerColumnFiltersChange={setServerFilters}
									initialSortField='created_at'
									initialSortDirection='desc'
									enableSearch={false}
									renderToolbarFields={(table: Table<DisputeRow>) => {
										const statusOptions = Array.from(new Set(disputeList.map((d) => d.status).filter(Boolean)));

										return (
											<select
												value={(table.getColumn("status")?.getFilterValue() as string) || ""}
												onChange={(e) => table.getColumn("status")?.setFilterValue(e.target.value || undefined)}
												className='rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'>
												<option value=''>All statuses</option>
												{statusOptions.map((status) => (
													<option
														key={status}
														value={status}>
														{status}
													</option>
												))}
											</select>
										);
									}}
									quickSorts={[
										{ label: "Newest Filed", field: "created_at", direction: "desc" },
										{ label: "Oldest Filed", field: "created_at", direction: "asc" },
										{ label: "Status (A-Z)", field: "status", direction: "asc" },
									]}
									quickSortLabel='Quick sort'
									enableExport
									exportLabel='Export Disputes'
									exportFileName='admin-disputes'
									emptyMessage='No disputes found'
									isLoading={isFetching && !!disputes}
									searchDebounceMs={300}
									columns={[
										{
											id: "id",
											header: "Dispute",
											sortable: true,
											accessor: (row: DisputeRow) => row.id,
											cell: (row: DisputeRow) => <span className='font-medium'>#{row.id.slice(0, 8)}</span>,
										},
										{
											id: "job_id",
											header: "Job ID",
											accessor: (row: DisputeRow) => row.job_id || "",
											cell: (row: DisputeRow) => (row.job_id ? row.job_id.slice(0, 8) : "-"),
										},
										{
											id: "reason",
											header: "Reason",
											cell: (row: DisputeRow) => (
												<span className='line-clamp-2 text-gray-700 dark:text-gray-300'>
													{row.reason || "No description provided"}
												</span>
											),
										},
										{
											id: "status",
											header: "Status",
											sortable: true,
											filterable: true,
											accessor: (row: DisputeRow) => row.status,
											cell: (row: DisputeRow) => <StatusBadge status={row.status} />,
											align: "center",
										},
										{
											id: "created_at",
											header: "Filed Date",
											sortable: true,
											accessor: (row: DisputeRow) => new Date(row.created_at),
											cell: (row: DisputeRow) => formatDate(row.created_at),
										},
										{
											id: "action",
											header: "Action",
											align: "right",
											cell: (row: DisputeRow) => (
												<Link href={`/dashboard/admin/disputes/${row.id}`}>
													<Button
														variant='outline'
														size='sm'>
														Review Dispute
													</Button>
												</Link>
											),
										},
									]}
								/>
							}
						</CardContent>
					</Card>
				</div>
			</Layout>
		</ProtectedRoute>
	);
}
